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
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) throw new ResourceNotFoundException('Group not found.');

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) throw new ForbiddenException('You must be a group member to create a pool.');

      // Validate all memberIds are group members
      for (const memberId of data.memberIds) {
        const gMember = await this.groupRepository.getMember(groupId, memberId);
        if (!gMember) {
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
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this group.');

      return this.poolRepository.findByGroup(groupId);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing pools: ${error}`);
      throw new InternalServerException('Failed to list pools.');
    }
  }

  async getPoolDetail(poolId: string, userId: string): Promise<IPool & { members: unknown[] }> {
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      const member = await this.poolRepository.getMember(poolId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this pool.');

      const members = await this.poolRepository.getMembers(poolId);
      return { ...pool, members };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching pool detail: ${error}`);
      throw new InternalServerException('Failed to fetch pool details.');
    }
  }

  async updatePool(poolId: string, userId: string, data: UpdatePoolDTO): Promise<IPool> {
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      const groupMember = await this.groupRepository.getMember(pool.groupId, userId);
      if (!groupMember || groupMember.role !== 'admin') {
        throw new ForbiddenException('Only admins can update a pool.');
      }

      const updated = await this.poolRepository.update(poolId, {
        name: data.name,
        description: data.description,
        status: data.status,
      });

      if (data.status === 'settled') {
        this.webhookDispatcher.dispatch(pool.groupId, 'pool.settled', { pool_id: poolId });
      }

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
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      // Caller must be a group admin
      const caller = await this.groupRepository.getMember(pool.groupId, userId);
      if (!caller || caller.role !== 'admin') {
        throw new ForbiddenException('Only group admins can add pool members.');
      }

      // Verify target is a group member
      const groupMember = await this.groupRepository.getMember(pool.groupId, data.userId);
      if (!groupMember) {
        throw new BadRequestException('User must be a group member before being added to a pool.');
      }

      const existing = await this.poolRepository.getMember(poolId, data.userId);
      if (existing) {
        throw new BadRequestException('User is already a pool member.');
      }

      await this.poolRepository.addMember(poolId, data.userId);
      this.webhookDispatcher.dispatch(pool.groupId, 'pool.member_added', {
        pool_id: poolId,
        user_id: data.userId,
      });

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
    try {
      const pool = await this.poolRepository.findById(poolId);
      if (!pool) throw new ResourceNotFoundException('Pool not found.');

      const admin = await this.groupRepository.getMember(pool.groupId, adminId);
      if (!admin || admin.role !== 'admin') {
        throw new ForbiddenException('Only admins can remove pool members.');
      }

      const target = await this.poolRepository.getMember(poolId, targetUserId);
      if (!target) throw new ResourceNotFoundException('Member not found in pool.');

      await this.poolRepository.removeMember(poolId, targetUserId);
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
