import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from './groups.repository';
import { CreateGroupDTO, GroupResponseDTO } from './groups.dto';
import { IGroupDetail } from './groups.interface';
import { IGeneralResponse } from '@/common/types/interface';
import {
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { generateInviteCode } from '@/common/utils/otp-generator';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';

export interface IGroupService {
  createGroup(userId: string, data: CreateGroupDTO): Promise<GroupResponseDTO>;
  getUserGroups(userId: string): Promise<GroupResponseDTO[]>;
  getGroupDetail(groupId: string, userId: string): Promise<IGroupDetail>;
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
        inviteCode,
        createdBy: userId,
      });

      await this.groupRepository.addMember(group.id, userId, 'admin');

      this.webhookDispatcher.dispatch(group.id, 'group.created', { group: this.mapToDTO(group) });

      logger.info(`Group "${group.name}" (${group.id}) created successfully by user ${userId}`);
      return this.mapToDTO(group);
    } catch (error) {
      logger.error(`Error creating group for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to create group.');
    }
  }

  async getUserGroups(userId: string): Promise<GroupResponseDTO[]> {
    logger.info(`Fetching groups for user ${userId}`);
    try {
      const groups = await this.groupRepository.findAllForUser(userId);
      logger.info(`Found ${groups.length} group(s) for user ${userId}`);
      return groups.map((g) => this.mapToDTO(g));
    } catch (error) {
      logger.error(`Error fetching groups for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch groups.');
    }
  }

  async getGroupDetail(groupId: string, userId: string): Promise<IGroupDetail> {
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

      logger.info(`Group detail fetched for group ${groupId}`);
      return group;
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

  private mapToDTO(group: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    createdBy: string | null;
    createdAt: Date;
  }): GroupResponseDTO {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      invite_code: group.inviteCode,
      created_by: group.createdBy,
      created_at: group.createdAt,
    };
  }
}

export default GroupService;
