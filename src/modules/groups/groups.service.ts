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

      return this.mapToDTO(group);
    } catch (error) {
      logger.error(`Error creating group for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to create group.');
    }
  }

  async getUserGroups(userId: string): Promise<GroupResponseDTO[]> {
    try {
      const groups = await this.groupRepository.findAllForUser(userId);
      return groups.map((g) => this.mapToDTO(g));
    } catch (error) {
      logger.error(`Error fetching groups for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch groups.');
    }
  }

  async getGroupDetail(groupId: string, userId: string): Promise<IGroupDetail> {
    try {
      const group = await this.groupRepository.findByIdWithDetail(groupId);
      if (!group) throw new ResourceNotFoundException('Group not found.');

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member) throw new ForbiddenException('You are not a member of this group.');

      return group;
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error fetching group detail ${groupId}: ${error}`);
      throw new InternalServerException('Failed to fetch group details.');
    }
  }

  async deleteGroup(groupId: string, userId: string): Promise<IGeneralResponse<null>> {
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) throw new ResourceNotFoundException('Group not found.');

      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only admins can delete a group.');
      }

      await this.groupRepository.delete(groupId);
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
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) throw new ResourceNotFoundException('Group not found.');

      const admin = await this.groupRepository.getMember(groupId, adminId);
      if (!admin || admin.role !== 'admin') {
        throw new ForbiddenException('Only admins can remove members.');
      }

      const target = await this.groupRepository.getMember(groupId, targetUserId);
      if (!target) throw new ResourceNotFoundException('Member not found in group.');

      if (target.role === 'admin') {
        const adminCount = await this.groupRepository.getAdminCount(groupId);
        if (adminCount <= 1) {
          throw new ForbiddenException('Cannot remove the last admin from the group.');
        }
      }

      await this.groupRepository.removeMember(groupId, targetUserId);

      this.webhookDispatcher.dispatch(groupId, 'member.removed', {
        group_id: groupId,
        user_id: targetUserId,
      });

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
