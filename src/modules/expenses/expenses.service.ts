import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IExpenseRepository } from './expenses.repository';
import { IExpense, IParsedReceipt } from './expenses.interface';
import { CreateExpenseDTO, ExpenseResponseDTO } from './expenses.dto';
import { RecurrenceFrequency } from './expenses.enum';
import { IPagination, IGeneralResponse } from '@/common/types/interface';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { ICategoryRepository } from '@/modules/categories/categories.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import { uploadFile } from '@/common/lib/storage';
import { parseReceipt } from '@/common/lib/ai-parser';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IExpenseService {
  createExpense(
    poolId: string,
    userId: string,
    data: CreateExpenseDTO,
    file?: Express.Multer.File,
  ): Promise<ExpenseResponseDTO>;
  parseReceipt(
    file: Express.Multer.File,
  ): Promise<{ parsed: IParsedReceipt | null; receipt_url: string }>;
  listExpenses(
    poolId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<ExpenseResponseDTO>>;
  getExpense(
    expenseId: string,
    userId: string,
  ): Promise<ExpenseResponseDTO & { splits: unknown[] }>;
  deleteExpense(expenseId: string, userId: string): Promise<{ success: boolean; message: string }>;
  cancelRecurrence(expenseId: string, userId: string): Promise<IGeneralResponse<null>>;
}

@injectable()
class ExpenseService implements IExpenseService {
  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('ICategoryRepository') private categoryRepository: ICategoryRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  async createExpense(
    poolId: string,
    userId: string,
    data: CreateExpenseDTO,
    file?: Express.Multer.File,
  ): Promise<ExpenseResponseDTO> {
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      // Validate categoryId if provided
      if (data.categoryId) {
        const category = await this.categoryRepository.findById(data.categoryId);
        if (!category) throw new BadRequestException('Invalid categoryId — category not found.');
      }

      // Upload receipt if provided (non-blocking if parse fails)
      let receiptUrl: string | null = null;
      if (file) {
        const path = `receipts/${poolId}/${uuidv4()}-${file.originalname}`;
        receiptUrl = await uploadFile('billbot/receipts', path, file.buffer, file.mimetype);
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

      // Calculate equal splits among all pool members
      const members = await this.poolRepository.getMembers(poolId);
      const splitAmount = (data.amount / members.length).toFixed(2);

      for (const m of members) {
        await this.expenseRepository.createSplit({
          id: uuidv4(),
          expenseId: expense.id,
          owedBy: m.userId,
          amount: splitAmount,
        });
      }

      this.webhookDispatcher.dispatch(pool.groupId, 'expense.created', {
        expense_id: expense.id,
        pool_id: poolId,
        amount: data.amount,
      });

      return this.mapToDTO(expense);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error creating expense: ${error}`);
      throw new InternalServerException('Failed to create expense.');
    }
  }

  async parseReceipt(
    file: Express.Multer.File,
  ): Promise<{ parsed: IParsedReceipt | null; receipt_url: string }> {
    // Always store the image first — parsing is non-blocking
    const path = `receipts/parse/${uuidv4()}-${file.originalname}`;
    let receiptUrl = '';
    try {
      receiptUrl = await uploadFile('billbot/receipts', path, file.buffer, file.mimetype);
    } catch (err) {
      logger.warn(`Receipt upload failed during parse: ${err}`);
    }

    // Attempt AI parse — never fail the request if this fails
    const parsed = await parseReceipt(file.buffer, file.mimetype);

    return { parsed, receipt_url: receiptUrl };
  }

  async listExpenses(
    poolId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<ExpenseResponseDTO>> {
    try {
      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      const allExpenses = await this.expenseRepository.findByPool(poolId);
      const total = allExpenses.length;
      const start = (page - 1) * limit;
      const paged = allExpenses.slice(start, start + limit);

      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: paged.map((e) => this.mapToDTO(e)),
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
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) throw new ResourceNotFoundException('Expense not found.');

      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      const splits = await this.expenseRepository.getSplitsByExpense(expenseId);
      return { ...this.mapToDTO(expense), splits };
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
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) throw new ResourceNotFoundException('Expense not found.');

      // Only payer or admin can delete
      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      if (expense.paidBy !== userId) {
        throw new ForbiddenException('Only the payer can delete an expense.');
      }

      const hasSettled = await this.expenseRepository.hasSettledSplits(expenseId);
      if (hasSettled) {
        throw new BadRequestException('Cannot delete an expense with settled splits.');
      }

      const pool = await this.poolRepository.findById(expense.poolId);
      await this.expenseRepository.delete(expenseId);

      if (pool) {
        this.webhookDispatcher.dispatch(pool.groupId, 'expense.deleted', {
          expense_id: expenseId,
          pool_id: expense.poolId,
        });
      }

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
    try {
      const expense = await this.expenseRepository.findById(expenseId);
      if (!expense) throw new ResourceNotFoundException('Expense not found.');

      const member = await this.poolRepository.getMember(expense.poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      if (expense.paidBy !== userId) {
        throw new ForbiddenException('Only the payer can cancel a recurring expense.');
      }

      if (!expense.isRecurring) {
        throw new BadRequestException('This expense is not set as recurring.');
      }

      await this.expenseRepository.updateRecurring(expenseId, {
        isRecurring: false,
        nextOccurrenceAt: null,
      });

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

  private mapToDTO(expense: IExpense): ExpenseResponseDTO {
    return {
      id: expense.id,
      pool_id: expense.poolId,
      paid_by: expense.paidBy,
      amount: expense.amount,
      currency: expense.currency,
      description: expense.description,
      category_id: expense.categoryId,
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
