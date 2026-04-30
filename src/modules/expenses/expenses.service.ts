import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IExpenseRepository } from './expenses.repository';
import { IExpense, IExpenseFilter, IExpenseSplit, IParsedReceipt } from './expenses.interface';
import { CreateExpenseDTO, ExpenseResponseDTO } from './expenses.dto';
import { RecurrenceFrequency } from './expenses.enum';
import { IPagination, IGeneralResponse } from '@/common/types/interface';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { ICategoryRepository } from '@/modules/categories/categories.repository';
import { IUserRepository } from '@/modules/users/users.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import { IActivityRepository } from '@/modules/activities/activities.repository';
import { uploadFile } from '@/common/lib/storage';
import { parseReceipt } from '@/common/lib/ai-parser';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { getCurrencySymbol } from '@/common/utils/currency';

export interface IExpenseService {
  createExpense(
    poolId: string,
    userId: string,
    data: CreateExpenseDTO,
    file?: Express.Multer.File,
  ): Promise<ExpenseResponseDTO>;
  parseReceipt(file: Express.Multer.File): Promise<{
    parsed: (Omit<IParsedReceipt, 'category'> & { category_id: string | null }) | null;
    receipt_url: string;
  }>;
  listExpenses(
    poolId: string,
    userId: string,
    page: number,
    limit: number,
    filter?: IExpenseFilter,
  ): Promise<IPagination<ExpenseResponseDTO>>;
  getExpense(
    expenseId: string,
    userId: string,
  ): Promise<ExpenseResponseDTO & { splits: unknown[] }>;
  deleteExpense(expenseId: string, userId: string): Promise<{ success: boolean; message: string }>;
  cancelRecurrence(expenseId: string, userId: string): Promise<IGeneralResponse<null>>;
  listUpcomingExpenses(
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<ExpenseResponseDTO>>;
  listExpensesByGroup(
    groupId: string,
    userId: string,
    page: number,
    limit: number,
    filter?: IExpenseFilter,
  ): Promise<IPagination<ExpenseResponseDTO>>;
}

@injectable()
class ExpenseService implements IExpenseService {
  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('ICategoryRepository') private categoryRepository: ICategoryRepository,
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
    @inject('IActivityRepository') private activityRepository: IActivityRepository,
  ) {}

  async createExpense(
    poolId: string,
    userId: string,
    data: CreateExpenseDTO,
    file?: Express.Multer.File,
  ): Promise<ExpenseResponseDTO> {
    logger.info(
      `Creating expense in pool ${poolId} by user ${userId}, amount: ${data.amount} ${data.currency}`,
    );
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      // Validate categoryId if provided
      let category: { id: string; name: string; emoji: string } | null = null;
      if (data.categoryId) {
        category = await this.categoryRepository.findById(data.categoryId);
        if (!category) {
          logger.warn(`Invalid categoryId: ${data.categoryId}`);
          throw new BadRequestException('Invalid categoryId — category not found.');
        }
      }

      // Upload receipt if provided (non-blocking if parse fails)
      let receiptUrl: string | null = null;
      if (file) {
        logger.info(`Uploading receipt for expense in pool ${poolId}`);
        const path = `receipts/${poolId}/${uuidv4()}-${file.originalname}`;
        receiptUrl = await uploadFile('billbot/receipts', path, file.buffer, file.mimetype);
        logger.info(`Receipt uploaded successfully`);
      }

      const now = new Date();
      const nextOccurrenceAt =
        data.isRecurring && data.recurrenceFrequency
          ? computeNextOccurrence(now, data.recurrenceFrequency as RecurrenceFrequency)
          : null;

      const expense = await this.expenseRepository.create({
        id: uuidv4(),
        poolId,
        paidBy: userId,
        amount: data.amount.toString(),
        currency: data.currency,
        description: data.description ?? null,
        categoryId: data.categoryId ?? null,
        receiptUrl,
        isRecurring: data.isRecurring ?? false,
        recurrenceFrequency: data.recurrenceFrequency ?? null,
        recurrenceEndDate: data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null,
        recurrenceParentId: null,
        nextOccurrenceAt,
      });

      // Build splits — exact if caller provided them, otherwise equal among all members
      const members = await this.poolRepository.getMembers(poolId);

      type SplitEntry = { userId: string; amount: string };
      let resolvedSplits: SplitEntry[];

      if (data.splits && data.splits.length > 0) {
        logger.info(`Using exact splits for expense ${expense.id}`);
        const memberIds = new Set(members.map((m) => m.userId));
        const outsiders = data.splits.filter((s) => !memberIds.has(s.userId));
        if (outsiders.length > 0) {
          logger.warn(
            `Split contains non-pool members: ${outsiders.map((u) => u.userId).join(', ')}`,
          );
          throw new BadRequestException(
            `The following users are not members of this pool: ${outsiders.map((u) => u.userId).join(', ')}`,
          );
        }

        const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(splitTotal - data.amount) > 0.01) {
          logger.warn(`Split total ${splitTotal} does not match expense amount ${data.amount}`);
          throw new BadRequestException(
            `Split amounts (${splitTotal.toFixed(2)}) must sum to the expense total (${data.amount.toFixed(2)}).`,
          );
        }

        resolvedSplits = data.splits.map((s) => ({
          userId: s.userId,
          amount: s.amount.toFixed(2),
        }));
      } else {
        logger.info(`Splitting expense ${expense.id} equally among ${members.length} member(s)`);
        const splitAmount = (data.amount / members.length).toFixed(2);
        resolvedSplits = members.map((m) => ({ userId: m.userId, amount: splitAmount }));
      }

      const splitCreatedAt = new Date();
      for (const s of resolvedSplits) {
        const isPayerSplit = s.userId === userId;
        await this.expenseRepository.createSplit({
          id: uuidv4(),
          expenseId: expense.id,
          owedBy: s.userId,
          amount: s.amount,
          settled: isPayerSplit,
          settledAt: isPayerSplit ? splitCreatedAt : null,
        });
      }

      this.webhookDispatcher.dispatch(pool.groupId, 'expense.created', {
        expense_id: expense.id,
        pool_id: poolId,
        amount: data.amount,
      });
      this.logActivity(userId, poolId, 'expense.created', {
        expense_id: expense.id,
        amount: data.amount,
        currency: data.currency,
        description: data.description ?? null,
        category: category ? { id: category.id, name: category.name, emoji: category.emoji } : null,
      });

      logger.info(`Expense ${expense.id} created successfully in pool ${poolId}`);
      return this.mapToDTO(expense, category?.emoji ?? null);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error creating expense: ${error}`);
      throw new InternalServerException('Failed to create expense.');
    }
  }

  async parseReceipt(file: Express.Multer.File): Promise<{
    parsed: (Omit<IParsedReceipt, 'category'> & { category_id: string | null }) | null;
    receipt_url: string;
  }> {
    logger.info(`Receipt parse request received for file: ${file.originalname}`);
    // Always store the image first — parsing is non-blocking
    const path = `receipts/parse/${uuidv4()}-${file.originalname}`;
    let receiptUrl = '';
    try {
      receiptUrl = await uploadFile('billbot/receipts', path, file.buffer, file.mimetype);
      logger.info(`Receipt uploaded for parsing: ${receiptUrl}`);
    } catch (err) {
      logger.warn(`Receipt upload failed during parse: ${err}`);
    }

    // Attempt AI parse — never fail the request if this fails
    const parsed = await parseReceipt(file.buffer, file.mimetype);
    logger.info(`Receipt parse ${parsed ? 'succeeded' : 'returned no result'}`);

    if (!parsed) return { parsed: null, receipt_url: receiptUrl };

    const { category, ...rest } = parsed;
    let categoryId: string | null = null;
    if (category) {
      const found = await this.categoryRepository.findBySlug(category);
      categoryId = found?.id ?? null;
    }

    return { parsed: { ...rest, category_id: categoryId }, receipt_url: receiptUrl };
  }

  async listExpenses(
    poolId: string,
    userId: string,
    page: number,
    limit: number,
    filter?: IExpenseFilter,
  ): Promise<IPagination<ExpenseResponseDTO>> {
    logger.info(
      `Listing expenses for pool ${poolId}, page ${page}, limit ${limit}, requested by user ${userId}`,
    );
    try {
      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      const offset = (page - 1) * limit;
      const { expenses, total } = await this.expenseRepository.findByPool(
        poolId,
        limit,
        offset,
        filter,
      );

      logger.info(`Returning ${expenses.length} of ${total} expense(s) for pool ${poolId}`);
      const expenseIds = expenses.map((e) => e.id);
      const [emojiMap, allSplits] = await Promise.all([
        this.buildCategoryEmojiMap(expenses),
        this.expenseRepository.getSplitsByExpenseIds(expenseIds),
      ]);
      const splitsMap = new Map<string, IExpenseSplit[]>();
      for (const s of allSplits)
        splitsMap.set(s.expenseId, [...(splitsMap.get(s.expenseId) ?? []), s]);
      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: expenses.map((e) => ({
          ...this.mapToDTO(e, e.categoryId ? emojiMap.get(e.categoryId) : null),
          splits: splitsMap.get(e.id) ?? [],
        })),
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing expenses: ${error}`);
      throw new InternalServerException('Failed to list expenses.');
    }
  }

  async getExpense(
    expenseId: string,
    userId: string,
  ): Promise<ExpenseResponseDTO & { splits: unknown[] }> {
    logger.info(`Fetching expense ${expenseId}, requested by user ${userId}`);
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) {
        logger.warn(`Expense not found: ${expenseId}`);
        throw new ResourceNotFoundException('Expense not found.');
      }

      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${expense.poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      const [splits, category] = await Promise.all([
        this.expenseRepository.getSplitsByExpense(expenseId),
        expense.categoryId ? this.categoryRepository.findById(expense.categoryId) : null,
      ]);

      const owedByIds = [...new Set(splits.map((s) => s.owedBy).filter(Boolean))] as string[];
      const users = await this.userRepository.findByIds(owedByIds);
      const userMap = new Map(users.map((u) => [u.id, u]));

      const enrichedSplits = splits.map((s) => {
        const user = s.owedBy ? userMap.get(s.owedBy) : null;
        return { ...s, name: user?.name ?? null, avatar_url: user?.avatarUrl ?? null };
      });

      logger.info(`Expense ${expenseId} fetched with ${splits.length} split(s)`);
      return { ...this.mapToDTO(expense, category?.emoji ?? null), splits: enrichedSplits };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching expense: ${error}`);
      throw new InternalServerException('Failed to fetch expense.');
    }
  }

  async deleteExpense(
    expenseId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    logger.info(`Delete expense ${expenseId} requested by user ${userId}`);
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) {
        logger.warn(`Expense not found: ${expenseId}`);
        throw new ResourceNotFoundException('Expense not found.');
      }

      // Only payer or admin can delete
      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${expense.poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      if (expense.paidBy !== userId) {
        logger.warn(`User ${userId} is not the payer for expense ${expenseId} — delete denied`);
        throw new ForbiddenException('Only the payer can delete an expense.');
      }

      const hasSettled = await this.expenseRepository.hasSettledSplits(expenseId);
      if (hasSettled) {
        logger.warn(`Expense ${expenseId} has settled splits — delete denied`);
        throw new BadRequestException('Cannot delete an expense with settled splits.');
      }

      const pool = await this.poolRepository.findById(expense.poolId);
      await this.expenseRepository.delete(expenseId);

      if (pool) {
        this.webhookDispatcher.dispatch(pool.groupId, 'expense.deleted', {
          expense_id: expenseId,
          pool_id: expense.poolId,
        });
        this.logActivity(userId, expense.poolId, 'expense.deleted', {
          expense_id: expenseId,
        });
      }

      logger.info(`Expense ${expenseId} deleted successfully by user ${userId}`);
      return { success: true, message: 'Expense deleted successfully.' };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error deleting expense: ${error}`);
      throw new InternalServerException('Failed to delete expense.');
    }
  }

  async cancelRecurrence(expenseId: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Cancel recurrence for expense ${expenseId} requested by user ${userId}`);
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) {
        logger.warn(`Expense not found: ${expenseId}`);
        throw new ResourceNotFoundException('Expense not found.');
      }

      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of pool ${expense.poolId}`);
        throw new ForbiddenException('You are not a member of this pool.');
      }

      if (expense.paidBy !== userId) {
        logger.warn(
          `User ${userId} is not the payer for expense ${expenseId} — cancel recurrence denied`,
        );
        throw new ForbiddenException('Only the payer can cancel a recurring expense.');
      }

      if (!expense.isRecurring) {
        logger.warn(`Expense ${expenseId} is not recurring — cannot cancel`);
        throw new BadRequestException('This expense is not set as recurring.');
      }

      await this.expenseRepository.updateRecurring(expenseId, {
        isRecurring: false,
        nextOccurrenceAt: null,
      });

      logger.info(`Recurring schedule cancelled for expense ${expenseId}`);
      return {
        success: true,
        message: 'Recurring schedule cancelled. No further instances will be generated.',
        data: null,
      };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error cancelling recurrence: ${error}`);
      throw new InternalServerException('Failed to cancel recurring expense.');
    }
  }

  async listUpcomingExpenses(
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<ExpenseResponseDTO>> {
    logger.info(
      `Listing upcoming recurring expenses for user ${userId}, page ${page}, limit ${limit}`,
    );
    try {
      const offset = (page - 1) * limit;
      const { expenses, total } = await this.expenseRepository.findUpcomingRecurringForUser(
        userId,
        limit,
        offset,
      );

      logger.info(`Found ${total} upcoming recurring expense(s) for user ${userId}`);
      const expenseIds = expenses.map((e) => e.id);
      const [emojiMap, allSplits] = await Promise.all([
        this.buildCategoryEmojiMap(expenses),
        this.expenseRepository.getSplitsByExpenseIds(expenseIds),
      ]);
      const splitsMap = new Map<string, IExpenseSplit[]>();
      for (const s of allSplits)
        splitsMap.set(s.expenseId, [...(splitsMap.get(s.expenseId) ?? []), s]);
      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: expenses.map((e) => ({
          ...this.mapToDTO(e, e.categoryId ? emojiMap.get(e.categoryId) : null),
          splits: splitsMap.get(e.id) ?? [],
        })),
      };
    } catch (error) {
      logger.error(`Error listing upcoming expenses for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to list upcoming expenses.');
    }
  }

  async listExpensesByGroup(
    groupId: string,
    userId: string,
    page: number,
    limit: number,
    filter?: IExpenseFilter,
  ): Promise<IPagination<ExpenseResponseDTO>> {
    logger.info(`Listing expenses for group ${groupId}, requested by user ${userId}`);
    try {
      const offset = (page - 1) * limit;
      const { expenses, total } = await this.expenseRepository.findByGroup(
        groupId,
        limit,
        offset,
        filter,
      );
      logger.info(`Found ${total} expense(s) for group ${groupId}`);
      const expenseIds = expenses.map((e) => e.id);
      const [emojiMap, allSplits] = await Promise.all([
        this.buildCategoryEmojiMap(expenses),
        this.expenseRepository.getSplitsByExpenseIds(expenseIds),
      ]);
      const splitsMap = new Map<string, IExpenseSplit[]>();
      for (const s of allSplits)
        splitsMap.set(s.expenseId, [...(splitsMap.get(s.expenseId) ?? []), s]);
      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: expenses.map((e) => ({
          ...this.mapToDTO(e, e.categoryId ? emojiMap.get(e.categoryId) : null),
          splits: splitsMap.get(e.id) ?? [],
        })),
      };
    } catch (error) {
      logger.error(`Error listing expenses for group ${groupId}: ${error}`);
      throw new InternalServerException('Failed to list expenses.');
    }
  }

  private logActivity(
    actorId: string,
    poolId: string,
    type: string,
    metadata: Record<string, unknown>,
  ): void {
    this.activityRepository
      .create({ id: uuidv4(), actorId, poolId, type, metadata })
      .catch((err: unknown) => logger.warn(`Failed to log activity (${type}): ${err}`));
  }

  private async buildCategoryEmojiMap(expenses: IExpense[]): Promise<Map<string, string>> {
    const ids = [...new Set(expenses.map((e) => e.categoryId).filter(Boolean))] as string[];
    if (ids.length === 0) return new Map();
    const categories = await this.categoryRepository.findAll();
    return new Map(categories.filter((c) => ids.includes(c.id)).map((c) => [c.id, c.emoji]));
  }

  private mapToDTO(expense: IExpense, categoryEmoji?: string | null): ExpenseResponseDTO {
    return {
      id: expense.id,
      pool_id: expense.poolId,
      paid_by: expense.paidBy,
      amount: expense.amount,
      currency: getCurrencySymbol(expense.currency),
      description: expense.description,
      category_id: expense.categoryId,
      category_emoji: categoryEmoji ?? null,
      receipt_url: expense.receiptUrl,
      created_at: expense.createdAt,
      is_recurring: expense.isRecurring,
      recurrence_frequency: expense.recurrenceFrequency,
      recurrence_end_date: expense.recurrenceEndDate,
      recurrence_parent_id: expense.recurrenceParentId,
      next_occurrence_at: expense.nextOccurrenceAt,
    };
  }
}

export default ExpenseService;

/**
 * Calculates the next occurrence date from a given base date and frequency.
 * Always advances from the base to prevent drift.
 */
export function computeNextOccurrence(from: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(from);
  switch (frequency) {
    case RecurrenceFrequency.DAILY:
      next.setDate(next.getDate() + 1);
      break;
    case RecurrenceFrequency.WEEKLY:
      next.setDate(next.getDate() + 7);
      break;
    case RecurrenceFrequency.BIWEEKLY:
      next.setDate(next.getDate() + 14);
      break;
    case RecurrenceFrequency.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      break;
    case RecurrenceFrequency.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}
