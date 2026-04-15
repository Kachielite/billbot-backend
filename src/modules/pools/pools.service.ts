import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IPoolRepository } from './pools.repository';
import { IPool } from './pools.interface';
import { CreatePoolDTO, UpdatePoolDTO, AddPoolMemberDTO } from './pools.dto';
import { IGeneralResponse } from '@/common/types/interface';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IPoolService {
  createPool(groupId: string, userId: string, data: CreatePoolDTO): Promise<IPool>;
  listPools(groupId: string, userId: string): Promise<IPool[]>;
  getPoolDetail(poolId: string, userId: string): Promise<IPool & { members: unknown[] }>;
  updatePool(poolId: string, userId: string, data: UpdatePoolDTO): Promise<IPool>;
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
}

@injectable()
class PoolService implements IPoolService {
  constructor(
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  async createPool(groupId: string, userId: string, data: CreatePoolDTO): Promise<IPool> {
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
      return pool;
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

  async listPools(groupId: string, userId: string): Promise<IPool[]> {
    logger.info(`Listing pools for group ${groupId}, requested by user ${userId}`);
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of group ${groupId} — list pools denied`);
        throw new ForbiddenException('You are not a member of this group.');
      }

      const pools = await this.poolRepository.findByGroup(groupId);
      logger.info(`Found ${pools.length} pool(s) for group ${groupId}`);
      return pools;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing pools: ${error}`);
      throw new InternalServerException('Failed to list pools.');
    }
  }

  async getPoolDetail(poolId: string, userId: string): Promise<IPool & { members: unknown[] }> {
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
      return { ...pool, members };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching pool detail: ${error}`);
      throw new InternalServerException('Failed to fetch pool details.');
    }
  }

  async updatePool(poolId: string, userId: string, data: UpdatePoolDTO): Promise<IPool> {
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
      return updated;
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
}

export default PoolService;
