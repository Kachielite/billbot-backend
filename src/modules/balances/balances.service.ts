import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import {
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { getCurrencySymbol } from '@/common/utils/currency';

export interface IBalanceEntry {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
  currency: string;
}

export interface IMemberSummary {
  user: { id: string; name: string };
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

export interface IBalanceResult {
  balances: IBalanceEntry[];
  member_summary: IMemberSummary[];
  total_amount: number;
  amount_collected: number;
  outstanding: number;
}

export interface IUserBalanceSummary {
  total_owed: number;
  total_owed_to_me: number;
  currency: string;
}

export interface IBalanceService {
  getPoolBalances(poolId: string, userId: string): Promise<IBalanceResult>;
  getGroupBalances(groupId: string, userId: string): Promise<IBalanceResult>;
  getUserBalanceSummary(userId: string): Promise<IUserBalanceSummary>;
}

@injectable()
class BalanceService implements IBalanceService {
  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
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

      const expenses = await this.expenseRepository.findAllByPool(poolId);
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
      const member_summary: IMemberSummary[] = [];
      const nets = new Map<string, number>();

      for (const [uid, t] of totals) {
        const m = memberMap.get(uid);
        if (!m) continue;
        const net = t.paid - t.owed;
        nets.set(uid, net);
        member_summary.push({
          user: { id: uid, name: m.name },
          total_paid: t.paid,
          total_owed: t.owed,
          net_balance: net,
        });
      }

      // Simplify debts using greedy algorithm
      const balances = this.simplifyDebts(nets, memberMap);
      const total_amount = member_summary.reduce((sum, m) => sum + m.total_paid, 0);
      const amount_collected = splits.reduce(
        (sum, s) => (s.settled ? sum + parseFloat(s.amount) : sum),
        0,
      );
      const outstanding = total_amount - amount_collected;

      logger.info(
        `Balance calculation complete for pool ${poolId}: ${balances.length} balance entry/entries`,
      );
      return { balances, member_summary, total_amount, amount_collected, outstanding };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error calculating balances for pool ${poolId}: ${error}`);
      throw new InternalServerException('Failed to calculate balances.');
    }
  }

  async getGroupBalances(groupId: string, userId: string): Promise<IBalanceResult> {
    logger.info(`Calculating balances for group ${groupId}, requested by user ${userId}`);
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) {
        logger.warn(`Group not found: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of group ${groupId}`);
        throw new ForbiddenException('You are not a member of this group.');
      }

      const membersMap = await this.groupRepository.getMembersForGroups([groupId]);
      const members = membersMap.get(groupId) ?? [];
      const memberMap = new Map(members.map((m) => [m.user_id, m]));

      const [expenses, splits] = await Promise.all([
        this.expenseRepository.findAllByGroup(groupId),
        this.expenseRepository.getSplitsByGroup(groupId),
      ]);

      logger.info(
        `Computing group balances from ${expenses.length} expense(s) and ${splits.length} split(s) for group ${groupId}`,
      );

      const totals = new Map<string, { paid: number; owed: number }>();
      for (const m of members) {
        totals.set(m.user_id, { paid: 0, owed: 0 });
      }

      for (const expense of expenses) {
        if (expense.paidBy && totals.has(expense.paidBy)) {
          totals.get(expense.paidBy)!.paid += parseFloat(expense.amount);
        }
      }

      for (const split of splits) {
        if (split.owedBy && totals.has(split.owedBy)) {
          totals.get(split.owedBy)!.owed += parseFloat(split.amount);
        }
      }

      const member_summary: IMemberSummary[] = [];
      const nets = new Map<string, number>();

      for (const [uid, t] of totals) {
        const m = memberMap.get(uid);
        if (!m) continue;
        const net = t.paid - t.owed;
        nets.set(uid, net);
        member_summary.push({
          user: { id: uid, name: m.name },
          total_paid: t.paid,
          total_owed: t.owed,
          net_balance: net,
        });
      }

      const poolMemberMap = new Map(
        members.map((m) => [m.user_id, { userId: m.user_id, name: m.name }]),
      );
      const balances = this.simplifyDebts(nets, poolMemberMap);
      const total_amount = member_summary.reduce((sum, m) => sum + m.total_paid, 0);
      const outstanding = splits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const amount_collected = total_amount - outstanding;

      logger.info(
        `Group balance calculation complete for group ${groupId}: ${balances.length} balance entry/entries`,
      );
      return { balances, member_summary, total_amount, amount_collected, outstanding };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error calculating balances for group ${groupId}: ${error}`);
      throw new InternalServerException('Failed to calculate group balances.');
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
      return {
        total_owed: totalOwed,
        total_owed_to_me: totalOwedToMe,
        currency: getCurrencySymbol('NGN'),
      };
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
        currency: getCurrencySymbol('NGN'),
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
