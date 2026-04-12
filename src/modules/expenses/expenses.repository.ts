import { inject, injectable } from 'tsyringe';
import { eq, and, lte, gte, or, isNull } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ExpenseSchema, ExpenseSplitSchema } from './expenses.schema';
import { IExpense, IExpenseSplit } from './expenses.interface';

export interface IExpenseRepository {
  create(data: {
    id: string;
    poolId: string;
    paidBy: string;
    amount: string;
    currency: string;
    description?: string | null;
    categoryId?: string | null;
    receiptUrl?: string | null;
    isRecurring?: boolean;
    recurrenceFrequency?: string | null;
    recurrenceEndDate?: Date | null;
    recurrenceParentId?: string | null;
    nextOccurrenceAt?: Date | null;
  }): Promise<IExpense>;
  findById(id: string): Promise<IExpense | null>;
  findByPool(poolId: string): Promise<IExpense[]>;
  delete(id: string): Promise<void>;
  createSplit(data: {
    id: string;
    expenseId: string;
    owedBy: string;
    amount: string;
  }): Promise<IExpenseSplit>;
  getSplitsByExpense(expenseId: string): Promise<IExpenseSplit[]>;
  getSplitsByPool(poolId: string): Promise<IExpenseSplit[]>;
  hasSettledSplits(expenseId: string): Promise<boolean>;
  markSplitSettled(splitId: string): Promise<void>;
  getUnsettledSplitsOwedBy(
    poolId: string,
    owedBy: string,
    toUserId: string,
  ): Promise<IExpenseSplit[]>;
  getDueRecurring(): Promise<IExpense[]>;
  updateRecurring(
    id: string,
    data: { nextOccurrenceAt?: Date | null; isRecurring?: boolean },
  ): Promise<void>;
}

@injectable()
class ExpenseRepositoryImpl implements IExpenseRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: {
    id: string;
    poolId: string;
    paidBy: string;
    amount: string;
    currency: string;
    description?: string | null;
    categoryId?: string | null;
    receiptUrl?: string | null;
    isRecurring?: boolean;
    recurrenceFrequency?: string | null;
    recurrenceEndDate?: Date | null;
    recurrenceParentId?: string | null;
    nextOccurrenceAt?: Date | null;
  }): Promise<IExpense> {
    const [row] = await this.db.client.insert(ExpenseSchema).values(data).returning();
    return row as unknown as IExpense;
  }

  async findById(id: string): Promise<IExpense | null> {
    const rows = await this.db.client
      .select()
      .from(ExpenseSchema)
      .where(eq(ExpenseSchema.id, id))
      .limit(1);
    return (rows[0] as unknown as IExpense) ?? null;
  }

  async findByPool(poolId: string): Promise<IExpense[]> {
    const rows = await this.db.client
      .select()
      .from(ExpenseSchema)
      .where(eq(ExpenseSchema.poolId, poolId));
    return rows as unknown as IExpense[];
  }

  async delete(id: string): Promise<void> {
    await this.db.client.delete(ExpenseSchema).where(eq(ExpenseSchema.id, id));
  }

  async createSplit(data: {
    id: string;
    expenseId: string;
    owedBy: string;
    amount: string;
  }): Promise<IExpenseSplit> {
    const [row] = await this.db.client.insert(ExpenseSplitSchema).values(data).returning();
    return row as unknown as IExpenseSplit;
  }

  async getSplitsByExpense(expenseId: string): Promise<IExpenseSplit[]> {
    const rows = await this.db.client
      .select()
      .from(ExpenseSplitSchema)
      .where(eq(ExpenseSplitSchema.expenseId, expenseId));
    return rows as unknown as IExpenseSplit[];
  }

  async getSplitsByPool(poolId: string): Promise<IExpenseSplit[]> {
    const rows = await this.db.client
      .select({ split: ExpenseSplitSchema })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(eq(ExpenseSchema.poolId, poolId));
    return rows.map((r) => r.split) as unknown as IExpenseSplit[];
  }

  async hasSettledSplits(expenseId: string): Promise<boolean> {
    const rows = await this.db.client
      .select()
      .from(ExpenseSplitSchema)
      .where(and(eq(ExpenseSplitSchema.expenseId, expenseId), eq(ExpenseSplitSchema.settled, true)))
      .limit(1);
    return rows.length > 0;
  }

  async markSplitSettled(splitId: string): Promise<void> {
    await this.db.client
      .update(ExpenseSplitSchema)
      .set({ settled: true, settledAt: new Date() })
      .where(eq(ExpenseSplitSchema.id, splitId));
  }

  async getUnsettledSplitsOwedBy(
    poolId: string,
    owedBy: string,
    _toUserId: string,
  ): Promise<IExpenseSplit[]> {
    // Get all unsettled splits for owedBy in pool (we'll filter by expense.paidBy in service)
    const rows = await this.db.client
      .select({ split: ExpenseSplitSchema, paidBy: ExpenseSchema.paidBy })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(
        and(
          eq(ExpenseSchema.poolId, poolId),
          eq(ExpenseSplitSchema.owedBy, owedBy),
          eq(ExpenseSplitSchema.settled, false),
          eq(ExpenseSchema.paidBy, _toUserId),
        ),
      );
    return rows.map((r) => r.split) as unknown as IExpenseSplit[];
  }

  /**
   * Returns all active recurring expense templates whose next_occurrence_at is due now
   * and whose recurrence_end_date has not yet passed (or has no end date).
   */
  async getDueRecurring(): Promise<IExpense[]> {
    const now = new Date();
    const rows = await this.db.client
      .select()
      .from(ExpenseSchema)
      .where(
        and(
          eq(ExpenseSchema.isRecurring, true),
          lte(ExpenseSchema.nextOccurrenceAt, now),
          or(isNull(ExpenseSchema.recurrenceEndDate), gte(ExpenseSchema.recurrenceEndDate, now)),
        ),
      );
    return rows as unknown as IExpense[];
  }

  async updateRecurring(
    id: string,
    data: { nextOccurrenceAt?: Date | null; isRecurring?: boolean },
  ): Promise<void> {
    const updateData: Partial<typeof ExpenseSchema.$inferInsert> = {};
    if (data.nextOccurrenceAt !== undefined) updateData.nextOccurrenceAt = data.nextOccurrenceAt;
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    await this.db.client.update(ExpenseSchema).set(updateData).where(eq(ExpenseSchema.id, id));
  }
}

export default ExpenseRepositoryImpl;
