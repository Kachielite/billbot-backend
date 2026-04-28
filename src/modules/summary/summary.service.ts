import { inject, injectable } from 'tsyringe';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import { IActivityRepository } from '@/modules/activities/activities.repository';
import { IActivityEnriched } from '@/modules/activities/activities.interface';
import {
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IUserSummary {
  balance: { total_owed: number; total_owed_to_me: number; net: number };
  groups_count: number;
  upcoming_expenses_count: number;
  recent_activities: IActivityEnriched[];
}

export interface IGroupSummary {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  member_count: number;
  pool_count: number;
  total_spend: number;
  balance: { total_owed: number; total_owed_to_me: number; net: number };
}

export interface IPoolSummary {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  member_count: number;
  expense_count: number;
  total_amount: number;
  amount_collected: number;
  outstanding: number;
  balance: { total_owed: number; total_owed_to_me: number; net: number };
}

export interface ISummaryService {
  getUserSummary(userId: string): Promise<IUserSummary>;
  getGroupSummary(groupId: string, userId: string): Promise<IGroupSummary>;
  getPoolSummary(poolId: string, userId: string): Promise<IPoolSummary>;
}

@injectable()
class SummaryService implements ISummaryService {
  constructor(
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
    @inject('IActivityRepository') private activityRepository: IActivityRepository,
  ) {}

  async getUserSummary(userId: string): Promise<IUserSummary> {
    logger.info(`Fetching dashboard summary for user ${userId}`);
    try {
      const [totalOwed, totalOwedToMe, groups, upcoming, { activities }] = await Promise.all([
        this.expenseRepository.getTotalOwedByUser(userId),
        this.expenseRepository.getTotalOwedToUser(userId),
        this.groupRepository.findAllForUser(userId, 1, 0),
        this.expenseRepository.findUpcomingRecurringForUser(userId, 1, 0),
        this.activityRepository.findForUser(userId, 5, 0),
      ]);

      return {
        balance: {
          total_owed: totalOwed,
          total_owed_to_me: totalOwedToMe,
          net: totalOwedToMe - totalOwed,
        },
        groups_count: groups.total,
        upcoming_expenses_count: upcoming.total,
        recent_activities: activities,
      };
    } catch (error) {
      logger.error(`Error fetching dashboard summary for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch dashboard summary.');
    }
  }

  async getGroupSummary(groupId: string, userId: string): Promise<IGroupSummary> {
    logger.info(`Fetching group summary for group ${groupId}, user ${userId}`);
    try {
      const [group, member, membersMap, pools, totalSpend, balancesMap] = await Promise.all([
        this.groupRepository.findById(groupId),
        this.groupRepository.getMember(groupId, userId),
        this.groupRepository.getMembersForGroups([groupId]),
        this.poolRepository.findByGroup(groupId, 1, 0),
        this.expenseRepository.getTotalSpendByGroup(groupId),
        this.expenseRepository.getGroupBalancesForUser(userId, [groupId]),
      ]);

      if (!group) throw new ResourceNotFoundException('Group not found.');
      if (!member) throw new ForbiddenException('You are not a member of this group.');

      const members = membersMap.get(groupId) ?? [];
      const balance = balancesMap.get(groupId) ?? { totalOwed: 0, totalOwedToMe: 0 };

      return {
        id: group.id,
        name: group.name,
        description: group.description,
        emoji: group.emoji,
        color: group.color,
        member_count: members.length,
        pool_count: pools.total,
        total_spend: totalSpend,
        balance: {
          total_owed: balance.totalOwed,
          total_owed_to_me: balance.totalOwedToMe,
          net: balance.totalOwedToMe - balance.totalOwed,
        },
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching group summary for ${groupId}: ${error}`);
      throw new InternalServerException('Failed to fetch group summary.');
    }
  }

  async getPoolSummary(poolId: string, userId: string): Promise<IPoolSummary> {
    logger.info(`Fetching pool summary for pool ${poolId}, user ${userId}`);
    try {
      const [pool, member, members, expenseCountMap, stats, balancesMap] = await Promise.all([
        this.poolRepository.findById(poolId),
        this.poolRepository.getMember(poolId, userId),
        this.poolRepository.getMembers(poolId),
        this.expenseRepository.getExpenseCountByPools([poolId]),
        this.expenseRepository.getPoolStats(poolId),
        this.expenseRepository.getPoolBalancesForUser(userId, [poolId]),
      ]);

      if (!pool) throw new ResourceNotFoundException('Pool not found.');
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      const balance = balancesMap.get(poolId) ?? { totalOwed: 0, totalOwedToMe: 0 };

      return {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        is_default: pool.isDefault,
        member_count: members.length,
        expense_count: expenseCountMap.get(poolId) ?? 0,
        total_amount: stats.total_amount,
        amount_collected: stats.amount_collected,
        outstanding: stats.outstanding,
        balance: {
          total_owed: balance.totalOwed,
          total_owed_to_me: balance.totalOwedToMe,
          net: balance.totalOwedToMe - balance.totalOwed,
        },
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching pool summary for ${poolId}: ${error}`);
      throw new InternalServerException('Failed to fetch pool summary.');
    }
  }
}

export default SummaryService;
