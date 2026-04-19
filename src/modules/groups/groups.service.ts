import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from './groups.repository';
import { CreateGroupDTO, GroupResponseDTO } from './groups.dto';
import { IGroupDetail } from './groups.interface';
import { IGeneralResponse, IPagination } from '@/common/types/interface';
import { IExpenseRepository } from '@/modules/expenses/expenses.repository';
import { IPoolRepository } from '@/modules/pools/pools.repository';
import {
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { generateInviteCode } from '@/common/utils/otp-generator';
import { getCurrencySymbol } from '@/common/utils/currency';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';

export interface IGroupService {
  createGroup(userId: string, data: CreateGroupDTO): Promise<GroupResponseDTO>;
  getUserGroups(
    userId: string,
    page: number,
    limit: number,
    includeMembers: boolean,
  ): Promise<IPagination<GroupResponseDTO>>;
  getGroupDetail(groupId: string, userId: string): Promise<GroupResponseDTO>;
  deleteGroup(groupId: string, userId: string): Promise<IGeneralResponse<null>>;
  removeMember(
    groupId: string,
    adminId: string,
    targetUserId: string,
  ): Promise<IGeneralResponse<null>>;
}

@injectable()
class GroupService implements IGroupService {
  constructor(
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
    @inject('IExpenseRepository') private expenseRepository: IExpenseRepository,
    @inject('IPoolRepository') private poolRepository: IPoolRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  async createGroup(userId: string, data: CreateGroupDTO): Promise<GroupResponseDTO> {
    logger.info(`Creating group "${data.name}" for user ${userId}`);
    try {
      let inviteCode = generateInviteCode();
      // Ensure uniqueness
      let existing = await this.groupRepository.findByInviteCode(inviteCode);
      while (existing) {
        inviteCode = generateInviteCode();
        existing = await this.groupRepository.findByInviteCode(inviteCode);
      }

      const group = await this.groupRepository.create({
        id: uuidv4(),
        name: data.name,
        description: data.description ?? null,
        emoji: data.emoji ?? null,
        color: data.color ?? null,
        inviteCode,
        createdBy: userId,
      });

      await this.groupRepository.addMember(group.id, userId, 'admin');

      const generalPool = await this.poolRepository.create({
        id: uuidv4(),
        groupId: group.id,
        name: 'General',
        description: null,
        isDefault: true,
        createdBy: userId,
      });
      await this.poolRepository.addMember(generalPool.id, userId);

      this.webhookDispatcher.dispatch(group.id, 'group.created', { group: this.mapToDTO(group) });

      logger.info(`Group "${group.name}" (${group.id}) created successfully by user ${userId}`);
      // General pool is empty on creation → counts as 1 active pool
      return this.mapToDTO(group, { totalOwed: 0, totalOwedToMe: 0 }, undefined, 1);
    } catch (error) {
      logger.error(`Error creating group for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to create group.');
    }
  }

  async getUserGroups(
    userId: string,
    page: number,
    limit: number,
    includeMembers: boolean,
  ): Promise<IPagination<GroupResponseDTO>> {
    logger.info(
      `Fetching groups for user ${userId}, page ${page}, limit ${limit}, includeMembers: ${includeMembers}`,
    );
    try {
      const offset = (page - 1) * limit;
      const { groups, total } = await this.groupRepository.findAllForUser(userId, limit, offset);

      logger.info(`Found ${total} total group(s) for user ${userId}, returning ${groups.length}`);

      const groupIds = groups.map((g) => g.id);

      // All lookups are batched — no N+1 regardless of page size
      const [balanceMap, membersMap, activePoolCountMap] = await Promise.all([
        this.expenseRepository.getGroupBalancesForUser(userId, groupIds),
        includeMembers
          ? this.groupRepository.getMembersForGroups(groupIds)
          : Promise.resolve(new Map()),
        this.poolRepository.getActivePoolCountByGroups(groupIds),
      ]);

      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: groups.map((g) => {
          const bal = balanceMap.get(g.id) ?? { totalOwed: 0, totalOwedToMe: 0 };
          const members = includeMembers ? (membersMap.get(g.id) ?? []) : undefined;
          const activePoolCount = activePoolCountMap.get(g.id) ?? 0;
          return this.mapToDTO(g, bal, members, activePoolCount);
        }),
      };
    } catch (error) {
      logger.error(`Error fetching groups for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch groups.');
    }
  }

  async getGroupDetail(groupId: string, userId: string): Promise<GroupResponseDTO> {
    logger.info(`Fetching group detail for group ${groupId}, requested by user ${userId}`);
    try {
      const group = await this.groupRepository.findByIdWithDetail(groupId);
      if (!group) {
        logger.warn(`Group not found: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) {
        logger.warn(`User ${userId} is not a member of group ${groupId}`);
        throw new ForbiddenException('You are not a member of this group.');
      }

      const [balanceMap, activePoolCountMap] = await Promise.all([
        this.expenseRepository.getGroupBalancesForUser(userId, [groupId]),
        this.poolRepository.getActivePoolCountByGroups([groupId]),
      ]);

      const bal = balanceMap.get(groupId) ?? { totalOwed: 0, totalOwedToMe: 0 };
      const activePoolCount = activePoolCountMap.get(groupId) ?? 0;

      logger.info(`Group detail fetched for group ${groupId}`);
      return this.mapToDTO(
        { ...group, memberCount: group.members.length },
        bal,
        group.members,
        activePoolCount,
      );
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching group detail ${groupId}: ${error}`);
      throw new InternalServerException('Failed to fetch group details.');
    }
  }

  async deleteGroup(groupId: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Delete group ${groupId} requested by user ${userId}`);
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) {
        logger.warn(`Group not found for deletion: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${groupId} — delete denied`);
        throw new ForbiddenException('Only admins can delete a group.');
      }

      await this.groupRepository.delete(groupId);
      logger.info(`Group ${groupId} deleted successfully by user ${userId}`);
      return { success: true, message: 'Group deleted successfully.', data: null };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error deleting group ${groupId}: ${error}`);
      throw new InternalServerException('Failed to delete group.');
    }
  }

  async removeMember(
    groupId: string,
    adminId: string,
    targetUserId: string,
  ): Promise<IGeneralResponse<null>> {
    logger.info(
      `Remove member ${targetUserId} from group ${groupId} requested by admin ${adminId}`,
    );
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) {
        logger.warn(`Group not found: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }

      const admin = await this.groupRepository.getMember(groupId, adminId);
      if (!admin || admin.role !== 'admin') {
        logger.warn(`User ${adminId} is not an admin of group ${groupId} — remove member denied`);
        throw new ForbiddenException('Only admins can remove members.');
      }

      const target = await this.groupRepository.getMember(groupId, targetUserId);
      if (!target) {
        logger.warn(`Member ${targetUserId} not found in group ${groupId}`);
        throw new ResourceNotFoundException('Member not found in group.');
      }

      if (target.role === 'admin') {
        const adminCount = await this.groupRepository.getAdminCount(groupId);
        if (adminCount <= 1) {
          logger.warn(`Cannot remove last admin ${targetUserId} from group ${groupId}`);
          throw new ForbiddenException('Cannot remove the last admin from the group.');
        }
      }

      await this.groupRepository.removeMember(groupId, targetUserId);

      this.webhookDispatcher.dispatch(groupId, 'member.removed', {
        group_id: groupId,
        user_id: targetUserId,
      });

      logger.info(`Member ${targetUserId} removed from group ${groupId} by admin ${adminId}`);
      return { success: true, message: 'Member removed successfully.', data: null };
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error removing member ${targetUserId} from group ${groupId}: ${error}`);
      throw new InternalServerException('Failed to remove member.');
    }
  }

  private mapToDTO(
    group: {
      id: string;
      name: string;
      description: string | null;
      emoji?: string | null;
      color?: string | null;
      inviteCode: string;
      createdBy: string | null;
      createdAt: Date;
      memberCount?: number;
    },
    balance: { totalOwed: number; totalOwedToMe: number } = { totalOwed: 0, totalOwedToMe: 0 },
    members?: IGroupDetail['members'],
    activePoolCount = 0,
  ): GroupResponseDTO {
    const netBalance = balance.totalOwedToMe - balance.totalOwed;
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      emoji: group.emoji ?? null,
      color: group.color ?? null,
      invite_code: group.inviteCode,
      created_by: group.createdBy,
      created_at: group.createdAt,
      member_count: group.memberCount ?? 0,
      active_pool_count: activePoolCount,
      balance: {
        total_owed: balance.totalOwed,
        total_owed_to_me: balance.totalOwedToMe,
        net_balance: netBalance,
        currency: getCurrencySymbol('NGN'),
      },
      ...(members !== undefined && { members }),
    };
  }
}

export default GroupService;
