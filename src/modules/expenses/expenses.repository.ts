import { inject, injectable } from 'tsyringe';
import { eq, and, lte, gte, gt, or, isNull, ne, sql, inArray } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ExpenseSchema, ExpenseSplitSchema } from './expenses.schema';
import { ExpensePoolSchema, PoolMemberSchema } from '@/modules/pools/pools.schema';
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
  findUpcomingRecurringForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ expenses: IExpense[]; total: number }>;
  getTotalOwedByUser(userId: string): Promise<number>;
  getTotalOwedToUser(userId: string): Promise<number>;
  getGroupBalancesForUser(
    userId: string,
    groupIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>>;
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

  async findUpcomingRecurringForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ expenses: IExpense[]; total: number }> {
    const now = new Date();

    const [countRow] = await this.db.client
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(ExpenseSchema)
      .innerJoin(PoolMemberSchema, eq(PoolMemberSchema.poolId, ExpenseSchema.poolId))
      .where(
        and(
          eq(PoolMemberSchema.userId, userId),
          eq(ExpenseSchema.isRecurring, true),
          gt(ExpenseSchema.nextOccurrenceAt, now),
          or(isNull(ExpenseSchema.recurrenceEndDate), gte(ExpenseSchema.recurrenceEndDate, now)),
        ),
      );

    const rows = await this.db.client
      .select({ expense: ExpenseSchema })
      .from(ExpenseSchema)
      .innerJoin(PoolMemberSchema, eq(PoolMemberSchema.poolId, ExpenseSchema.poolId))
      .where(
        and(
          eq(PoolMemberSchema.userId, userId),
          eq(ExpenseSchema.isRecurring, true),
          gt(ExpenseSchema.nextOccurrenceAt, now),
          or(isNull(ExpenseSchema.recurrenceEndDate), gte(ExpenseSchema.recurrenceEndDate, now)),
        ),
      )
      .orderBy(ExpenseSchema.nextOccurrenceAt)
      .limit(limit)
      .offset(offset);

    return {
      expenses: rows.map((r) => r.expense) as unknown as IExpense[],
      total: countRow?.total ?? 0,
    };
  }

  async getTotalOwedByUser(userId: string): Promise<number> {
    const rows = await this.db.client
      .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}), '0')` })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(
        and(
          eq(ExpenseSplitSchema.owedBy, userId),
          eq(ExpenseSplitSchema.settled, false),
          ne(ExpenseSchema.paidBy, userId),
        ),
      );
    return parseFloat(rows[0]?.total ?? '0');
  }

  async getTotalOwedToUser(userId: string): Promise<number> {
    const rows = await this.db.client
      .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}), '0')` })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(
        and(
          eq(ExpenseSchema.paidBy, userId),
          eq(ExpenseSplitSchema.settled, false),
          ne(ExpenseSplitSchema.owedBy, userId),
        ),
      );
    return parseFloat(rows[0]?.total ?? '0');
  }

  async getGroupBalancesForUser(
    userId: string,
    groupIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>> {
    if (groupIds.length === 0) return new Map();

    const rows = await this.db.client
      .select({
        groupId: ExpensePoolSchema.groupId,
        totalOwed: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSplitSchema.owedBy} = ${userId} AND ${ExpenseSchema.paidBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
        totalOwedToMe: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSchema.paidBy} = ${userId} AND ${ExpenseSplitSchema.owedBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(ExpensePoolSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .innerJoin(ExpenseSplitSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(inArray(ExpensePoolSchema.groupId, groupIds))
      .groupBy(ExpensePoolSchema.groupId);

    const map = new Map<string, { totalOwed: number; totalOwedToMe: number }>();
    for (const row of rows) {
      map.set(row.groupId, {
        totalOwed: parseFloat(row.totalOwed),
        totalOwedToMe: parseFloat(row.totalOwedToMe),
      });
    }
    return map;
  }
}

export default ExpenseRepositoryImpl;
