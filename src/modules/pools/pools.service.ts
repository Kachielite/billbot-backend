import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IPoolRepository } from './pools.repository';
import { IPool } from './pools.interface';
import { CreatePoolDTO, UpdatePoolDTO, AddPoolMemberDTO } from './pools.dto';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { IGeneralResponse, IPagination } from '@/common/types/interface';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { getCurrencySymbol } from '@/common/utils/currency';

export interface IPoolResponse {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  status: string;
  split_type: string;
  created_by: string | null;
  created_at: Date;
}

export interface IPoolService {
  createPool(groupId: string, userId: string, data: CreatePoolDTO): Promise<IPoolResponse>;
  listPools(
    groupId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<
    IPagination<
      IPoolResponse & {
        activity_status: 'empty' | 'ongoing' | 'settled';
        expense_count: number;
        balance: {
          total_owed: number;
          total_owed_to_me: number;
          net_balance: number;
          currency: string;
        };
      }
    >
  >;
  getPoolDetail(poolId: string, userId: string): Promise<IPoolResponse & { members: unknown[] }>;
  updatePool(poolId: string, userId: string, data: UpdatePoolDTO): Promise<IPoolResponse>;
  addMember(
    poolId: string,
    userId: string,
    data: AddPoolMemberDTO,
  ): Promise<IGeneralResponse<null>>;
  removeMember(
    poolId: string,
    adminId: string,
    targetUserId: string,
  ): Promise<IGeneralResponse<null>>;
  deletePool(poolId: string, userId: string): Promise<IGeneralResponse<null>>;
}

@injectable()
class PoolService implements IPoolService {
  constructor(
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  async createPool(groupId: string, userId: string, data: CreatePoolDTO): Promise<IPoolResponse> {
    logger.info(`Creating pool "${data.name}" in group ${groupId} by user ${userId}`);
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) {
        logger.warn(`Group not found: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of group ${groupId} — create pool denied`);
        throw new ForbiddenException('You must be a group member to create a pool.');
      }

      // Validate all memberIds are group members
      for (const memberId of data.memberIds) {
        const gMember = await this.groupRepository.getMember(groupId, memberId);
        if (!gMember) {
          logger.warn(`User ${memberId} is not a member of group ${groupId} — cannot add to pool`);
          throw new BadRequestException(`User ${memberId} is not a member of this group.`);
        }
      }

      const pool = await this.poolRepository.create({
        id: uuidv4(),
        groupId,
        name: data.name,
        description: data.description ?? null,
        createdBy: userId,
      });

      // Add all specified members
      const memberSet = new Set([...data.memberIds, userId]);
      for (const memberId of memberSet) {
        await this.poolRepository.addMember(pool.id, memberId);
      }

      this.webhookDispatcher.dispatch(groupId, 'pool.created', {
        pool_id: pool.id,
        name: pool.name,
      });

      logger.info(`Pool "${pool.name}" (${pool.id}) created in group ${groupId} by user ${userId}`);
      return this.mapPool(pool);
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error creating pool: ${error}`);
      throw new InternalServerException('Failed to create pool.');
    }
  }

  async listPools(
    groupId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<
    IPagination<
      IPoolResponse & {
        activity_status: 'empty' | 'ongoing' | 'settled';
        expense_count: number;
        balance: {
          total_owed: number;
          total_owed_to_me: number;
          net_balance: number;
          currency: string;
        };
      }
    >
  > {
    logger.info(
      `Listing pools for group ${groupId}, page ${page}, limit ${limit}, requested by user ${userId}`,
    );
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of group ${groupId} — list pools denied`);
        throw new ForbiddenException('You are not a member of this group.');
      }

      const offset = (page - 1) * limit;
      const { pools, total } = await this.poolRepository.findByGroup(groupId, limit, offset);
      const poolIds = pools.map((p) => p.id);
      const [activityMap, expenseCountMap, poolBalanceMap] = await Promise.all([
        this.expenseRepository.getActivityStatusByPools(poolIds),
        this.expenseRepository.getExpenseCountByPools(poolIds),
        this.expenseRepository.getPoolBalancesForUser(userId, poolIds),
      ]);

      logger.info(`Found ${total} total pool(s) for group ${groupId}, returning ${pools.length}`);
      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: pools.map((p) => {
          const bal = poolBalanceMap.get(p.id) ?? { totalOwed: 0, totalOwedToMe: 0 };
          return {
            ...this.mapPool(p),
            activity_status: activityMap.get(p.id) ?? 'empty',
            expense_count: expenseCountMap.get(p.id) ?? 0,
            balance: {
              total_owed: bal.totalOwed,
              total_owed_to_me: bal.totalOwedToMe,
              net_balance: bal.totalOwedToMe - bal.totalOwed,
              currency: getCurrencySymbol('NGN'),
            },
          };
        }),
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing pools: ${error}`);
      throw new InternalServerException('Failed to list pools.');
    }
  }

  async getPoolDetail(
    poolId: string,
    userId: string,
  ): Promise<IPoolResponse & { members: unknown[] }> {
    logger.info(`Fetching pool detail for pool ${poolId}, requested by user ${userId}`);
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
      logger.info(`Pool detail fetched for pool ${poolId}`);
      return {
        ...this.mapPool(pool),
        members: members.map((m) => ({
          user_id: m.userId,
          name: m.name,
          email: m.email,
          avatar_url: m.avatarUrl,
          joined_at: m.joinedAt,
        })),
      };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching pool detail: ${error}`);
      throw new InternalServerException('Failed to fetch pool details.');
    }
  }

  async updatePool(poolId: string, userId: string, data: UpdatePoolDTO): Promise<IPoolResponse> {
    logger.info(`Update pool ${poolId} requested by user ${userId}`);
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      const groupMember = await this.groupRepository.getMember(pool.groupId, userId);
      if (!groupMember || groupMember.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${pool.groupId} — update pool denied`);
        throw new ForbiddenException('Only admins can update a pool.');
      }

      const updated = await this.poolRepository.update(poolId, {
        name: data.name,
        description: data.description,
        status: data.status,
      });

      if (data.status === 'settled') {
        logger.info(`Pool ${poolId} marked as settled`);
        this.webhookDispatcher.dispatch(pool.groupId, 'pool.settled', { pool_id: poolId });
      }

      logger.info(`Pool ${poolId} updated successfully by user ${userId}`);
      return this.mapPool(updated);
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error updating pool: ${error}`);
      throw new InternalServerException('Failed to update pool.');
    }
  }

  async addMember(
    poolId: string,
    userId: string,
    data: AddPoolMemberDTO,
  ): Promise<IGeneralResponse<null>> {
    logger.info(`Add member ${data.userId} to pool ${poolId} requested by user ${userId}`);
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      // Caller must be a group admin
      const caller = await this.groupRepository.getMember(pool.groupId, userId);
      if (!caller || caller.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${pool.groupId} — add member denied`);
        throw new ForbiddenException('Only group admins can add pool members.');
      }

      // Verify target is a group member
      const groupMember = await this.groupRepository.getMember(pool.groupId, data.userId);
      if (!groupMember) {
        logger.warn(`User ${data.userId} is not a group member — cannot add to pool ${poolId}`);
        throw new BadRequestException('User must be a group member before being added to a pool.');
      }

      const existing = await this.poolRepository.getMember(poolId, data.userId);
      if (existing) {
        logger.warn(`User ${data.userId} is already a member of pool ${poolId}`);
        throw new BadRequestException('User is already a pool member.');
      }

      await this.poolRepository.addMember(poolId, data.userId);
      this.webhookDispatcher.dispatch(pool.groupId, 'pool.member_added', {
        pool_id: poolId,
        user_id: data.userId,
      });

      logger.info(`Member ${data.userId} added to pool ${poolId} by user ${userId}`);
      return { success: true, message: 'Member added to pool.', data: null };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
      logger.error(`Error adding pool member: ${error}`);
      throw new InternalServerException('Failed to add pool member.');
    }
  }

  async removeMember(
    poolId: string,
    adminId: string,
    targetUserId: string,
  ): Promise<IGeneralResponse<null>> {
    logger.info(`Remove member ${targetUserId} from pool ${poolId} requested by admin ${adminId}`);
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      const admin = await this.groupRepository.getMember(pool.groupId, adminId);
      if (!admin || admin.role !== 'admin') {
        logger.warn(
          `User ${adminId} is not an admin of group ${pool.groupId} — remove member denied`,
        );
        throw new ForbiddenException('Only admins can remove pool members.');
      }

      const target = await this.poolRepository.getMember(poolId, targetUserId);
      if (!target) {
        logger.warn(`Member ${targetUserId} not found in pool ${poolId}`);
        throw new ResourceNotFoundException('Member not found in pool.');
      }

      await this.poolRepository.removeMember(poolId, targetUserId);

      logger.info(`Member ${targetUserId} removed from pool ${poolId} by admin ${adminId}`);
      return { success: true, message: 'Member removed from pool.', data: null };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error removing pool member: ${error}`);
      throw new InternalServerException('Failed to remove pool member.');
    }
  }
  async deletePool(poolId: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Delete pool ${poolId} requested by user ${userId}`);
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) {
        logger.warn(`Pool not found: ${poolId}`);
        throw new ResourceNotFoundException('Pool not found.');
      }

      const admin = await this.groupRepository.getMember(pool.groupId, userId);
      if (!admin || admin.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${pool.groupId} — delete pool denied`);
        throw new ForbiddenException('Only admins can delete a pool.');
      }

      const expenseCountMap = await this.expenseRepository.getExpenseCountByPools([poolId]);
      const expenseCount = expenseCountMap.get(poolId) ?? 0;

      if (expenseCount === 0) {
        await this.poolRepository.delete(poolId);
        this.webhookDispatcher.dispatch(pool.groupId, 'pool.deleted', { pool_id: poolId });
        logger.info(`Pool ${poolId} hard-deleted by user ${userId}`);
        return { success: true, message: 'Pool deleted.', data: null };
      }

      await this.poolRepository.update(poolId, { status: 'archived' });
      this.webhookDispatcher.dispatch(pool.groupId, 'pool.archived', { pool_id: poolId });
      logger.info(`Pool ${poolId} archived by user ${userId} (has ${expenseCount} expense(s))`);
      return { success: true, message: 'Pool archived.', data: null };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      logger.error(`Error deleting pool: ${error}`);
      throw new InternalServerException('Failed to delete pool.');
    }
  }

  private mapPool(p: IPool) {
    return {
      id: p.id,
      group_id: p.groupId,
      name: p.name,
      description: p.description,
      status: p.status,
      split_type: p.splitType,
      created_by: p.createdBy,
      created_at: p.createdAt,
    };
  }
}

export default PoolService;
