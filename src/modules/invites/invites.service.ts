import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IInviteRepository } from './invites.repository';
import { IInvite } from './invites.interface';
import { CreateInviteDTO } from './invites.dto';
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
import { generateToken } from '@/common/utils/otp-generator';

const INVITE_EXPIRES_DAYS = 7;

export interface IInviteService {
  createInvite(groupId: string, invitedBy: string, data: CreateInviteDTO): Promise<IInvite>;
  getPendingInvites(groupId: string, userId: string): Promise<IInvite[]>;
  cancelInvite(groupId: string, inviteId: string, userId: string): Promise<IGeneralResponse<null>>;
  joinByToken(token: string, userId: string): Promise<IGeneralResponse<null>>;
}

@injectable()
class InviteService implements IInviteService {
  constructor(
    @inject('IInviteRepository') private inviteRepository: IInviteRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
  ) {}

  async createInvite(groupId: string, invitedBy: string, data: CreateInviteDTO): Promise<IInvite> {
    try {
      const group = await this.groupRepository.findById(groupId);
      if (!group) throw new ResourceNotFoundException('Group not found.');

      const member = await this.groupRepository.getMember(groupId, invitedBy);
      if (!member) throw new ForbiddenException('You must be a group member to invite others.');

      const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
      const token = generateToken(32);

      const invite = await this.inviteRepository.create({
        id: uuidv4(),
        groupId,
        invitedBy,
        phone: data.phone ?? null,
        email: data.email ?? null,
        token,
        expiresAt,
      });

      this.webhookDispatcher.dispatch(groupId, 'member.invited', {
        invite_id: invite.id,
        phone: data.phone,
        email: data.email,
      });

      return invite;
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error creating invite: ${error}`);
      throw new InternalServerException('Failed to create invite.');
    }
  }

  async getPendingInvites(groupId: string, userId: string): Promise<IInvite[]> {
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only admins can view pending invites.');
      }

      return this.inviteRepository.findPendingByGroup(groupId);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error fetching invites: ${error}`);
      throw new InternalServerException('Failed to fetch invites.');
    }
  }

  async cancelInvite(
    groupId: string,
    inviteId: string,
    userId: string,
  ): Promise<IGeneralResponse<null>> {
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only admins can cancel invites.');
      }

      const invites = await this.inviteRepository.findPendingByGroup(groupId);
      const invite = invites.find((i) => i.id === inviteId);
      if (!invite) throw new ResourceNotFoundException('Invite not found.');

      await this.inviteRepository.delete(inviteId);
      return { success: true, message: 'Invite cancelled.', data: null };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof ResourceNotFoundException)
        throw error;
      logger.error(`Error cancelling invite: ${error}`);
      throw new InternalServerException('Failed to cancel invite.');
    }
  }

  async joinByToken(token: string, userId: string): Promise<IGeneralResponse<null>> {
    try {
      const invite = await this.inviteRepository.findByToken(token);
      if (!invite) throw new ResourceNotFoundException('Invite not found.');

      if (invite.status !== 'pending') {
        throw new BadRequestException('This invite has already been used or expired.');
      }

      if (new Date() > invite.expiresAt) {
        await this.inviteRepository.updateStatus(invite.id, 'expired');
        throw new BadRequestException('This invite has expired.');
      }

      // Check already a member
      const existing = await this.groupRepository.getMember(invite.groupId, userId);
      if (existing) {
        throw new ConflictException('You are already a member of this group.');
      }

      await this.groupRepository.addMember(invite.groupId, userId, 'member');
      await this.inviteRepository.updateStatus(invite.id, 'accepted');

      this.webhookDispatcher.dispatch(invite.groupId, 'member.joined', {
        user_id: userId,
        group_id: invite.groupId,
      });

      return { success: true, message: 'You have joined the group.', data: null };
    } catch (error) {
      if (
        error instanceof ResourceNotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      logger.error(`Error joining group via token: ${error}`);
      throw new InternalServerException('Failed to join group.');
    }
  }
}

// Import here to avoid circular refs
import { ConflictException } from '@/common/exception';

export default InviteService;
