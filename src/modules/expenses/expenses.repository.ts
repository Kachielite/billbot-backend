import { inject, injectable } from 'tsyringe';
import { eq, and, lte, gte, gt, or, isNull, ne, sql, inArray, desc } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ExpenseSchema, ExpenseSplitSchema } from './expenses.schema';
import { ExpensePoolSchema, PoolMemberSchema } from '@/modules/pools/pools.schema';
import { SettlementSchema } from '@/modules/settlements/settlements.schema';
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
    settled?: boolean;
    settledAt?: Date | null;
  }): Promise<IExpenseSplit>;
  getSplitsByExpense(expenseId: string): Promise<IExpenseSplit[]>;
  getSplitsByExpenseIds(expenseIds: string[]): Promise<IExpenseSplit[]>;
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
  getPoolBalancesForUser(
    userId: string,
    poolIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>>;
  getPoolStats(
    poolId: string,
  ): Promise<{ total_amount: number; amount_collected: number; outstanding: number }>;
  markAllPoolSplitsSettled(poolId: string): Promise<void>;
  getTotalSpendByGroup(groupId: string): Promise<number>;
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
      .orderBy(desc(ExpenseSchema.createdAt))
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
    settled?: boolean;
    settledAt?: Date | null;
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

  async getSplitsByExpenseIds(expenseIds: string[]): Promise<IExpenseSplit[]> {
    if (expenseIds.length === 0) return [];
    const rows = await this.db.client
      .select()
      .from(ExpenseSplitSchema)
      .where(inArray(ExpenseSplitSchema.expenseId, expenseIds));
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
    const rows = await this.db.client
      .select({ split: ExpenseSplitSchema })
      .from(ExpenseSplitSchema)
      .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
      .where(
        and(
          eq(ExpenseSchema.poolId, poolId),
          eq(ExpenseSplitSchema.owedBy, owedBy),
          eq(ExpenseSplitSchema.settled, false),
          eq(ExpenseSchema.paidBy, _toUserId),
        ),
      )
      .orderBy(ExpenseSchema.createdAt);
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
    const [unsettledRow, settledRow, confirmedSentRow, confirmedReceivedRow, settledForMeRow] =
      await Promise.all([
        this.db.client
          .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}), '0')` })
          .from(ExpenseSplitSchema)
          .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
          .where(
            and(
              eq(ExpenseSplitSchema.owedBy, userId),
              eq(ExpenseSplitSchema.settled, false),
              ne(ExpenseSchema.paidBy, userId),
            ),
          ),
        this.db.client
          .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}), '0')` })
          .from(ExpenseSplitSchema)
          .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
          .where(
            and(
              eq(ExpenseSplitSchema.owedBy, userId),
              eq(ExpenseSplitSchema.settled, true),
              ne(ExpenseSchema.paidBy, userId),
            ),
          ),
        this.db.client
          .select({ total: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')` })
          .from(SettlementSchema)
          .where(
            and(eq(SettlementSchema.fromUser, userId), eq(SettlementSchema.status, 'settled')),
          ),
        // Excess-received: settlements where this user was the payee
        this.db.client
          .select({ total: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')` })
          .from(SettlementSchema)
          .where(and(eq(SettlementSchema.toUser, userId), eq(SettlementSchema.status, 'settled'))),
        // Splits on this user's expenses that were settled by others
        this.db.client
          .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}), '0')` })
          .from(ExpenseSplitSchema)
          .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
          .where(
            and(
              eq(ExpenseSchema.paidBy, userId),
              ne(ExpenseSplitSchema.owedBy, userId),
              eq(ExpenseSplitSchema.settled, true),
            ),
          ),
      ]);
    const unsettled = parseFloat(unsettledRow[0]?.total ?? '0');
    const settled = parseFloat(settledRow[0]?.total ?? '0');
    const confirmedSent = parseFloat(confirmedSentRow[0]?.total ?? '0');
    const confirmedReceived = parseFloat(confirmedReceivedRow[0]?.total ?? '0');
    const settledForMe = parseFloat(settledForMeRow[0]?.total ?? '0');
    const excessCredit = Math.max(0, confirmedSent - settled);
    const excessReceived = Math.max(0, confirmedReceived - settledForMe);
    return Math.max(0, unsettled - excessCredit - excessReceived);
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
      .orderBy(desc(ExpenseSchema.createdAt))
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
      .where(eq(ExpensePoolSchema.groupId, groupId));
    return rows.map((r) => r.split) as unknown as IExpenseSplit[];
  }

  async getGroupBalancesForUser(
    userId: string,
    groupIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>> {
    if (groupIds.length === 0) return new Map();

    const [splitRows, sentSettlementRows, receivedSettlementRows] = await Promise.all([
      this.db.client
        .select({
          groupId: ExpensePoolSchema.groupId,
          unsettledOwed: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSplitSchema.owedBy} = ${userId} AND ${ExpenseSchema.paidBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          settledOwed: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSplitSchema.owedBy} = ${userId} AND ${ExpenseSchema.paidBy} != ${userId} AND ${ExpenseSplitSchema.settled} = true THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          settledForMe: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSchema.paidBy} = ${userId} AND ${ExpenseSplitSchema.owedBy} != ${userId} AND ${ExpenseSplitSchema.settled} = true THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          totalOwedToMe: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSchema.paidBy} = ${userId} AND ${ExpenseSplitSchema.owedBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(ExpensePoolSchema)
        .innerJoin(ExpenseSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
        .innerJoin(ExpenseSplitSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
        .where(inArray(ExpensePoolSchema.groupId, groupIds))
        .groupBy(ExpensePoolSchema.groupId),
      this.db.client
        .select({
          groupId: ExpensePoolSchema.groupId,
          confirmedSent: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')`,
        })
        .from(SettlementSchema)
        .innerJoin(ExpensePoolSchema, eq(ExpensePoolSchema.id, SettlementSchema.poolId))
        .where(
          and(
            inArray(ExpensePoolSchema.groupId, groupIds),
            eq(SettlementSchema.fromUser, userId),
            eq(SettlementSchema.status, 'settled'),
          ),
        )
        .groupBy(ExpensePoolSchema.groupId),
      this.db.client
        .select({
          groupId: ExpensePoolSchema.groupId,
          confirmedReceived: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')`,
        })
        .from(SettlementSchema)
        .innerJoin(ExpensePoolSchema, eq(ExpensePoolSchema.id, SettlementSchema.poolId))
        .where(
          and(
            inArray(ExpensePoolSchema.groupId, groupIds),
            eq(SettlementSchema.toUser, userId),
            eq(SettlementSchema.status, 'settled'),
          ),
        )
        .groupBy(ExpensePoolSchema.groupId),
    ]);

    const confirmedSentMap = new Map<string, number>();
    for (const r of sentSettlementRows) {
      confirmedSentMap.set(r.groupId, parseFloat(r.confirmedSent));
    }
    const confirmedReceivedMap = new Map<string, number>();
    for (const r of receivedSettlementRows) {
      confirmedReceivedMap.set(r.groupId, parseFloat(r.confirmedReceived));
    }

    const map = new Map<string, { totalOwed: number; totalOwedToMe: number }>();
    for (const row of splitRows) {
      const unsettledOwed = parseFloat(row.unsettledOwed);
      const settledOwed = parseFloat(row.settledOwed);
      const settledForMe = parseFloat(row.settledForMe);
      const confirmedSent = confirmedSentMap.get(row.groupId) ?? 0;
      const confirmedReceived = confirmedReceivedMap.get(row.groupId) ?? 0;
      const excessCredit = Math.max(0, confirmedSent - settledOwed);
      const excessReceived = Math.max(0, confirmedReceived - settledForMe);
      map.set(row.groupId, {
        totalOwed: Math.max(0, unsettledOwed - excessCredit - excessReceived),
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

  async getPoolBalancesForUser(
    userId: string,
    poolIds: string[],
  ): Promise<Map<string, { totalOwed: number; totalOwedToMe: number }>> {
    if (poolIds.length === 0) return new Map();

    const [splitRows, sentSettlementRows, receivedSettlementRows] = await Promise.all([
      this.db.client
        .select({
          poolId: ExpenseSchema.poolId,
          unsettledOwed: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSplitSchema.owedBy} = ${userId} AND ${ExpenseSchema.paidBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          settledOwed: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSplitSchema.owedBy} = ${userId} AND ${ExpenseSchema.paidBy} != ${userId} AND ${ExpenseSplitSchema.settled} = true THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          settledForMe: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSchema.paidBy} = ${userId} AND ${ExpenseSplitSchema.owedBy} != ${userId} AND ${ExpenseSplitSchema.settled} = true THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
          totalOwedToMe: sql<string>`COALESCE(SUM(CASE WHEN ${ExpenseSchema.paidBy} = ${userId} AND ${ExpenseSplitSchema.owedBy} != ${userId} AND ${ExpenseSplitSchema.settled} = false THEN ${ExpenseSplitSchema.amount}::numeric ELSE 0 END), 0)`,
        })
        .from(ExpenseSchema)
        .innerJoin(ExpenseSplitSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
        .where(inArray(ExpenseSchema.poolId, poolIds))
        .groupBy(ExpenseSchema.poolId),
      this.db.client
        .select({
          poolId: SettlementSchema.poolId,
          confirmedSent: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')`,
        })
        .from(SettlementSchema)
        .where(
          and(
            inArray(SettlementSchema.poolId, poolIds),
            eq(SettlementSchema.fromUser, userId),
            eq(SettlementSchema.status, 'settled'),
          ),
        )
        .groupBy(SettlementSchema.poolId),
      this.db.client
        .select({
          poolId: SettlementSchema.poolId,
          confirmedReceived: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')`,
        })
        .from(SettlementSchema)
        .where(
          and(
            inArray(SettlementSchema.poolId, poolIds),
            eq(SettlementSchema.toUser, userId),
            eq(SettlementSchema.status, 'settled'),
          ),
        )
        .groupBy(SettlementSchema.poolId),
    ]);

    const confirmedSentMap = new Map<string, number>();
    for (const r of sentSettlementRows) {
      if (r.poolId) confirmedSentMap.set(r.poolId, parseFloat(r.confirmedSent));
    }
    const confirmedReceivedMap = new Map<string, number>();
    for (const r of receivedSettlementRows) {
      if (r.poolId) confirmedReceivedMap.set(r.poolId, parseFloat(r.confirmedReceived));
    }

    const map = new Map<string, { totalOwed: number; totalOwedToMe: number }>();
    for (const row of splitRows) {
      if (row.poolId) {
        const unsettledOwed = parseFloat(row.unsettledOwed);
        const settledOwed = parseFloat(row.settledOwed);
        const settledForMe = parseFloat(row.settledForMe);
        const confirmedSent = confirmedSentMap.get(row.poolId) ?? 0;
        const confirmedReceived = confirmedReceivedMap.get(row.poolId) ?? 0;
        const excessCredit = Math.max(0, confirmedSent - settledOwed);
        const excessReceived = Math.max(0, confirmedReceived - settledForMe);
        map.set(row.poolId, {
          totalOwed: Math.max(0, unsettledOwed - excessCredit - excessReceived),
          totalOwedToMe: parseFloat(row.totalOwedToMe),
        });
      }
    }
    return map;
  }

  async getPoolStats(
    poolId: string,
  ): Promise<{ total_amount: number; amount_collected: number; outstanding: number }> {
    const [totalRow, collectedRow, settlementRows, settledForMeRow] = await Promise.all([
      this.db.client
        .select({ total: sql<string>`COALESCE(SUM(${ExpenseSchema.amount}::numeric), '0')` })
        .from(ExpenseSchema)
        .where(eq(ExpenseSchema.poolId, poolId)),
      this.db.client
        .select({ total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}::numeric), '0')` })
        .from(ExpenseSplitSchema)
        .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
        .where(and(eq(ExpenseSchema.poolId, poolId), eq(ExpenseSplitSchema.settled, true))),
      // All confirmed settlements in this pool, grouped by fromUser
      this.db.client
        .select({
          fromUser: SettlementSchema.fromUser,
          toUser: SettlementSchema.toUser,
          total: sql<string>`COALESCE(SUM(${SettlementSchema.amount}::numeric), '0')`,
        })
        .from(SettlementSchema)
        .where(and(eq(SettlementSchema.poolId, poolId), eq(SettlementSchema.status, 'settled')))
        .groupBy(SettlementSchema.fromUser, SettlementSchema.toUser),
      // Settled splits per (owedBy, paidBy) pair — to compute what each settlement directly matched
      this.db.client
        .select({
          owedBy: ExpenseSplitSchema.owedBy,
          paidBy: ExpenseSchema.paidBy,
          total: sql<string>`COALESCE(SUM(${ExpenseSplitSchema.amount}::numeric), '0')`,
        })
        .from(ExpenseSplitSchema)
        .innerJoin(ExpenseSchema, eq(ExpenseSplitSchema.expenseId, ExpenseSchema.id))
        .where(and(eq(ExpenseSchema.poolId, poolId), eq(ExpenseSplitSchema.settled, true)))
        .groupBy(ExpenseSplitSchema.owedBy, ExpenseSchema.paidBy),
    ]);

    const total_amount = parseFloat(totalRow[0]?.total ?? '0');
    let amount_collected = parseFloat(collectedRow[0]?.total ?? '0');

    // Add excess credit from confirmed settlements (amount sent beyond directly matched settled splits)
    const settledPairMap = new Map<string, number>();
    for (const r of settledForMeRow) {
      if (r.owedBy && r.paidBy) {
        settledPairMap.set(`${r.owedBy}:${r.paidBy}`, parseFloat(r.total));
      }
    }
    for (const s of settlementRows) {
      if (!s.fromUser || !s.toUser) continue;
      const matched = settledPairMap.get(`${s.fromUser}:${s.toUser}`) ?? 0;
      const excess = Math.max(0, parseFloat(s.total) - matched);
      amount_collected += excess;
    }

    amount_collected = Math.min(amount_collected, total_amount);
    return { total_amount, amount_collected, outstanding: total_amount - amount_collected };
  }

  async markAllPoolSplitsSettled(poolId: string): Promise<void> {
    const now = new Date();
    const expenseIds = await this.db.client
      .select({ id: ExpenseSchema.id })
      .from(ExpenseSchema)
      .where(eq(ExpenseSchema.poolId, poolId));
    if (expenseIds.length === 0) return;
    const ids = expenseIds.map((e) => e.id);
    await this.db.client
      .update(ExpenseSplitSchema)
      .set({ settled: true, settledAt: now })
      .where(
        and(inArray(ExpenseSplitSchema.expenseId, ids), eq(ExpenseSplitSchema.settled, false)),
      );
  }

  async getTotalSpendByGroup(groupId: string): Promise<number> {
    const [row] = await this.db.client
      .select({ total: sql<string>`COALESCE(SUM(${ExpenseSchema.amount}::numeric), '0')` })
      .from(ExpenseSchema)
      .innerJoin(ExpensePoolSchema, eq(ExpenseSchema.poolId, ExpensePoolSchema.id))
      .where(eq(ExpensePoolSchema.groupId, groupId));
    return parseFloat(row?.total ?? '0');
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
