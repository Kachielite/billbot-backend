import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import {
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IBalanceEntry {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
  currency: string;
}

export interface IMemberSummary {
  user: { id: string; name: string };
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface IBalanceResult {
  balances: IBalanceEntry[];
  memberSummary: IMemberSummary[];
}

export interface IUserBalanceSummary {
  totalOwed: number;
  totalOwedToMe: number;
  currency: string;
}

export interface IBalanceService {
  getPoolBalances(poolId: string, userId: string): Promise<IBalanceResult>;
  getUserBalanceSummary(userId: string): Promise<IUserBalanceSummary>;
}

@injectable()
class BalanceService implements IBalanceService {
  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
  ) {}

  async getPoolBalances(poolId: string, userId: string): Promise<IBalanceResult> {
    logger.info(`Calculating balances for pool ${poolId}, requested by user ${userId}`);
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

      const members = await this.poolRepository.getMembers(poolId);
      const memberMap = new Map(members.map((m) => [m.userId, m]));

      const expenses = await this.expenseRepository.findByPool(poolId);
      const splits = await this.expenseRepository.getSplitsByPool(poolId);

      logger.info(
        `Computing balances from ${expenses.length} expense(s) and ${splits.length} split(s) for pool ${poolId}`,
      );

      // Calculate totals per user
      const totals = new Map<string, { paid: number; owed: number }>();
      for (const m of members) {
        totals.set(m.userId, { paid: 0, owed: 0 });
      }

      for (const expense of expenses) {
        if (expense.paidBy && totals.has(expense.paidBy)) {
          totals.get(expense.paidBy)!.paid += parseFloat(expense.amount);
        }
      }

      for (const split of splits) {
        if (split.owedBy && totals.has(split.owedBy) && !split.settled) {
          totals.get(split.owedBy)!.owed += parseFloat(split.amount);
        }
      }

      // Member summaries
      const memberSummary: IMemberSummary[] = [];
      const nets = new Map<string, number>();

      for (const [uid, t] of totals) {
        const m = memberMap.get(uid);
        if (!m) continue;
        const net = t.paid - t.owed;
        nets.set(uid, net);
        memberSummary.push({
          user: { id: uid, name: m.name },
          totalPaid: t.paid,
          totalOwed: t.owed,
          netBalance: net,
        });
      }

      // Simplify debts using greedy algorithm
      const balances = this.simplifyDebts(nets, memberMap);

      logger.info(
        `Balance calculation complete for pool ${poolId}: ${balances.length} balance entry/entries`,
      );
      return { balances, memberSummary };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error calculating balances for pool ${poolId}: ${error}`);
      throw new InternalServerException('Failed to calculate balances.');
    }
  }

  async getUserBalanceSummary(userId: string): Promise<IUserBalanceSummary> {
    logger.info(`Fetching balance summary for user ${userId}`);
    try {
      const [totalOwed, totalOwedToMe] = await Promise.all([
        this.expenseRepository.getTotalOwedByUser(userId),
        this.expenseRepository.getTotalOwedToUser(userId),
      ]);
      logger.info(
        `Balance summary for user ${userId}: owed=${totalOwed}, owed to me=${totalOwedToMe}`,
      );
      return { totalOwed, totalOwedToMe, currency: 'NGN' };
    } catch (error) {
      logger.error(`Error calculating balance summary for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to calculate balance summary.');
    }
  }

  private simplifyDebts(
    nets: Map<string, number>,
    memberMap: Map<string, { userId: string; name: string }>,
  ): IBalanceEntry[] {
    const creditors: Array<{ id: string; amount: number }> = [];
    const debtors: Array<{ id: string; amount: number }> = [];

    for (const [id, net] of nets) {
      if (net > 0.01) creditors.push({ id, amount: net });
      else if (net < -0.01) debtors.push({ id, amount: -net });
    }

    // Sort descending by amount
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const result: IBalanceEntry[] = [];

    let ci = 0;
    let di = 0;

    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci];
      const d = debtors[di];
      const settled = Math.min(c.amount, d.amount);

      result.push({
        from: { id: d.id, name: memberMap.get(d.id)?.name || d.id },
        to: { id: c.id, name: memberMap.get(c.id)?.name || c.id },
        amount: Math.round(settled * 100) / 100,
        currency: 'NGN',
      });

      c.amount -= settled;
      d.amount -= settled;

      if (c.amount < 0.01) ci++;
      if (d.amount < 0.01) di++;
    }

    return result;
  }
}

export default BalanceService;
