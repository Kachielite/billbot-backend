import { inject, injectable } from 'tsyringe';
import { eq, and, lte, gte, gt, or, isNull, ne, sql, inArray } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ExpenseSchema, ExpenseSplitSchema } from './expenses.schema';
import { ExpensePoolSchema, PoolMemberSchema } from '@/modules/pools/pools.schema';
import { IExpense, IExpenseFilter, IExpenseSplit } from './expenses.interface';

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
  findByPool(
    poolId: string,
    limit: number,
    offset: number,
    filter?: IExpenseFilter,
  ): Promise<{ expenses: IExpense[]; total: number }>;
  getActivityStatusByPools(
    poolIds: string[],
  ): Promise<Map<string, 'empty' | 'ongoing' | 'settled'>>;
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
  findByGroup(
    groupId: string,
    limit: number,
    offset: number,
    filter?: IExpenseFilter,
  ): Promise<{ expenses: IExpense[]; total: number }>;
  findAllByPool(poolId: string): Promise<IExpense[]>;
  findAllByGroup(groupId: string): Promise<IExpense[]>;
  getSplitsByGroup(groupId: string): Promise<IExpenseSplit[]>;
  getTotalOwedByUser(userId: string): Promise<number>;
  getTotalOwedToUser(userId: string): Promise<number>;
  getGroupBalancesForUser(
    userId: string,
    groupIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>>;
  getExpenseCountByPools(poolIds: string[]): Promise<Map<string, number>>;
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

  async findByPool(
    poolId: string,
    limit: number,
    offset: number,
    filter?: IExpenseFilter,
  ): Promise<{ expenses: IExpense[]; total: number }> {
    const conditions = this.buildExpenseConditions(eq(ExpenseSchema.poolId, poolId), filter);

    const [countRow] = await this.db.client
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(ExpenseSchema)
      .where(conditions);

    const rows = await this.db.client
      .select()
      .from(ExpenseSchema)
      .where(conditions)
      .orderBy(ExpenseSchema.createdAt)
      .limit(limit)
      .offset(offset);

    return { expenses: rows as unknown as IExpense[], total: countRow?.total ?? 0 };
  }

  async getActivityStatusByPools(
    poolIds: string[],
  ): Promise<Map<string, 'empty' | 'ongoing' | 'settled'>> {
    if (poolIds.length === 0) return new Map();

    const rows = await this.db.client
      .select({
        poolId: ExpenseSchema.poolId,
        hasExpenses: sql<number>`COUNT(DISTINCT ${ExpenseSchema.id})::int`,
        unsettledSplits: sql<number>`COUNT(CASE WHEN ${ExpenseSplitSchema.settled} = false THEN 1 END)::int`,
      })
      .from(ExpensePoolSchema)
      .leftJoin(ExpenseSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .leftJoin(ExpenseSplitSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(inArray(ExpensePoolSchema.id, poolIds))
      .groupBy(ExpenseSchema.poolId, ExpensePoolSchema.id);

    const map = new Map<string, 'empty' | 'ongoing' | 'settled'>();
    for (const r of rows) {
      if (!r.poolId) continue;
      const status = r.hasExpenses === 0 ? 'empty' : r.unsettledSplits > 0 ? 'ongoing' : 'settled';
      map.set(r.poolId, status);
    }
    // Pools with no rows (no expenses, no splits) default to empty
    for (const id of poolIds) {
      if (!map.has(id)) map.set(id, 'empty');
    }
    return map;
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

  async findByGroup(
    groupId: string,
    limit: number,
    offset: number,
    filter?: IExpenseFilter,
  ): Promise<{ expenses: IExpense[]; total: number }> {
    const baseCondition = eq(ExpensePoolSchema.groupId, groupId);
    const conditions = this.buildExpenseConditions(baseCondition, filter);

    const [countRow] = await this.db.client
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(ExpenseSchema)
      .innerJoin(ExpensePoolSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .where(conditions);

    const rows = await this.db.client
      .select({ expense: ExpenseSchema })
      .from(ExpenseSchema)
      .innerJoin(ExpensePoolSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .where(conditions)
      .orderBy(ExpenseSchema.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      expenses: rows.map((r) => r.expense) as unknown as IExpense[],
      total: countRow?.total ?? 0,
    };
  }

  async findAllByPool(poolId: string): Promise<IExpense[]> {
    const rows = await this.db.client
      .select()
      .from(ExpenseSchema)
      .where(eq(ExpenseSchema.poolId, poolId));
    return rows as unknown as IExpense[];
  }

  async findAllByGroup(groupId: string): Promise<IExpense[]> {
    const rows = await this.db.client
      .select({ expense: ExpenseSchema })
      .from(ExpenseSchema)
      .innerJoin(ExpensePoolSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .where(eq(ExpensePoolSchema.groupId, groupId));
    return rows.map((r) => r.expense) as unknown as IExpense[];
  }

  async getSplitsByGroup(groupId: string): Promise<IExpenseSplit[]> {
    const rows = await this.db.client
      .select({ split: ExpenseSplitSchema })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .innerJoin(ExpensePoolSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .where(and(eq(ExpensePoolSchema.groupId, groupId), eq(ExpenseSplitSchema.settled, false)));
    return rows.map((r) => r.split) as unknown as IExpenseSplit[];
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

  async getExpenseCountByPools(poolIds: string[]): Promise<Map<string, number>> {
    if (poolIds.length === 0) return new Map();

    const rows = await this.db.client
      .select({
        poolId: ExpenseSchema.poolId,
        count: sql<number>`COUNT(${ExpenseSchema.id})::int`,
      })
      .from(ExpenseSchema)
      .where(inArray(ExpenseSchema.poolId, poolIds))
      .groupBy(ExpenseSchema.poolId);

    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.poolId) map.set(row.poolId, row.count);
    }
    return map;
  }

  private buildExpenseConditions(base: ReturnType<typeof eq>, filter?: IExpenseFilter) {
    const parts: ReturnType<typeof eq>[] = [base];

    if (filter?.from) parts.push(gte(ExpenseSchema.createdAt, filter.from) as never);
    if (filter?.to) parts.push(lte(ExpenseSchema.createdAt, filter.to) as never);

    if (filter?.status === 'pending') {
      parts.push(
        sql`EXISTS (SELECT 1 FROM expense_splits s WHERE s.expense_id = ${ExpenseSchema.id} AND s.settled = false)` as never,
      );
    } else if (filter?.status === 'settled') {
      parts.push(
        sql`NOT EXISTS (SELECT 1 FROM expense_splits s WHERE s.expense_id = ${ExpenseSchema.id} AND s.settled = false)` as never,
      );
    }

    return parts.length === 1 ? parts[0] : and(...(parts as Parameters<typeof and>));
  }
}

export default ExpenseRepositoryImpl;
