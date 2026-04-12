import { inject, injectable } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
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
    category?: string | null;
    receiptUrl?: string | null;
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
    category?: string | null;
    receiptUrl?: string | null;
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
}

export default ExpenseRepositoryImpl;
