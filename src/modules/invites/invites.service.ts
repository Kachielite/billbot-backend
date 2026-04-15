import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { IInviteRepository } from './invites.repository';
import { IInvite } from './invites.interface';
import { CreateInviteDTO } from './invites.dto';
import { IGeneralResponse } from '@/common/types/interface';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import { IUserRepository } from '@/modules/users/users.repository';
import { WebhookDispatcher } from '@/modules/webhooks/webhooks.dispatcher';
import NotificationService, {
  INotificationService,
} from '@/modules/notifications/notifications.service';
import emailService from '@/common/lib/email';
import { buildInviteEmail } from '@/common/lib/email/templates/invite.template';
import { CONSTANTS } from '@/common/configuration/constants';
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
    @inject('IUserRepository') private userRepository: IUserRepository,
    @inject(WebhookDispatcher) private webhookDispatcher: WebhookDispatcher,
    @inject(NotificationService) private notificationService: INotificationService,
  ) {}

  async createInvite(groupId: string, invitedBy: string, data: CreateInviteDTO): Promise<IInvite> {
    logger.info(
      `Create invite for group ${groupId} by user ${invitedBy} (email: ${data.email ?? 'none'}, phone: ${data.phone ?? 'none'})`,
    );
    try {
      const [group, member, inviter] = await Promise.all([
        this.groupRepository.findById(groupId),
        this.groupRepository.getMember(groupId, invitedBy),
        this.userRepository.findById(invitedBy),
      ]);

      if (!group) {
        logger.warn(`Group not found: ${groupId}`);
        throw new ResourceNotFoundException('Group not found.');
      }
      if (!member) {
        logger.warn(`User ${invitedBy} is not a member of group ${groupId} — invite denied`);
        throw new ForbiddenException('You must be a group member to invite others.');
      }

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

      // Check if the invited person is already on the platform
      const inviterName = inviter?.name ?? 'A BillBot member';
      const inviteLink = `${CONSTANTS.APP_BASE_URL}/invites/join/${token}`;

      if (data.email) {
        const existingUser = await this.userRepository.findByEmail(data.email);

        if (existingUser) {
          // User is on the platform — send an in-app notification
          logger.info(`Sending in-app notification to existing user ${existingUser.id} for invite`);
          this.notificationService
            .notify(
              existingUser.id,
              'invite.received',
              `You've been invited to ${group.name}`,
              `${inviterName} has invited you to join the group "${group.name}". Open the app to accept.`,
              { group_id: groupId, invite_id: invite.id, invite_token: token },
            )
            .catch(() => {}); // fire-and-forget
        } else {
          // User is not on the platform — send an email invitation
          logger.info(`Sending email invite to ${data.email} for group ${groupId}`);
          const { subject, html } = buildInviteEmail({
            inviterName,
            groupName: group.name,
            inviteLink,
            expiresInDays: INVITE_EXPIRES_DAYS,
          });
          emailService.sendHtml(data.email, subject, html).catch(() => {}); // fire-and-forget
        }
      } else if (data.phone) {
        // Phone-only invite: check if a user with that phone exists for in-app notification
        const existingUser = await this.userRepository.findByPhone(data.phone);
        if (existingUser) {
          logger.info(`Sending in-app notification to user ${existingUser.id} (phone invite)`);
          this.notificationService
            .notify(
              existingUser.id,
              'invite.received',
              `You've been invited to ${group.name}`,
              `${inviterName} has invited you to join the group "${group.name}". Open the app to accept.`,
              { group_id: groupId, invite_id: invite.id, invite_token: token },
            )
            .catch(() => {});
        }
        // Phone-only invites to unknown users are handled via SMS (out of scope for now)
      }

      logger.info(`Invite ${invite.id} created for group ${groupId} by user ${invitedBy}`);
      return invite;
    } catch (error) {
      if (error instanceof ResourceNotFoundException || error instanceof ForbiddenException)
        throw error;
      logger.error(`Error creating invite: ${error}`);
      throw new InternalServerException('Failed to create invite.');
    }
  }

  async getPendingInvites(groupId: string, userId: string): Promise<IInvite[]> {
    logger.info(`Fetching pending invites for group ${groupId}, requested by user ${userId}`);
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${groupId} — view invites denied`);
        throw new ForbiddenException('Only admins can view pending invites.');
      }

      const invites = await this.inviteRepository.findPendingByGroup(groupId);
      logger.info(`Found ${invites.length} pending invite(s) for group ${groupId}`);
      return invites;
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
    logger.info(`Cancel invite ${inviteId} in group ${groupId} requested by user ${userId}`);
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        logger.warn(`User ${userId} is not an admin of group ${groupId} — cancel invite denied`);
        throw new ForbiddenException('Only admins can cancel invites.');
      }

      const invites = await this.inviteRepository.findPendingByGroup(groupId);
      const invite = invites.find((i) => i.id === inviteId);
      if (!invite) {
        logger.warn(`Invite ${inviteId} not found in group ${groupId}`);
        throw new ResourceNotFoundException('Invite not found.');
      }

      await this.inviteRepository.delete(inviteId);
      logger.info(`Invite ${inviteId} cancelled by user ${userId}`);
      return { success: true, message: 'Invite cancelled.', data: null };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof ResourceNotFoundException)
        throw error;
      logger.error(`Error cancelling invite: ${error}`);
      throw new InternalServerException('Failed to cancel invite.');
    }
  }

  async joinByToken(token: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`User ${userId} attempting to join group via invite token`);
    try {
      const invite = await this.inviteRepository.findByToken(token);
      if (!invite) {
        logger.warn(`Invite not found for token`);
        throw new ResourceNotFoundException('Invite not found.');
      }

      if (invite.status !== 'pending') {
        logger.warn(`Invite ${invite.id} is already ${invite.status} — join denied`);
        throw new BadRequestException('This invite has already been used or expired.');
      }

      if (new Date() > invite.expiresAt) {
        logger.warn(`Invite ${invite.id} has expired`);
        await this.inviteRepository.updateStatus(invite.id, 'expired');
        throw new BadRequestException('This invite has expired.');
      }

      // Check already a member
      const existing = await this.groupRepository.getMember(invite.groupId, userId);
      if (existing) {
        logger.warn(`User ${userId} is already a member of group ${invite.groupId}`);
        throw new ConflictException('You are already a member of this group.');
      }

      const [group] = await Promise.all([
        this.groupRepository.findById(invite.groupId),
        this.groupRepository.addMember(invite.groupId, userId, 'member'),
        this.inviteRepository.updateStatus(invite.id, 'accepted'),
      ]);

      this.webhookDispatcher.dispatch(invite.groupId, 'member.joined', {
        user_id: userId,
        group_id: invite.groupId,
      });

      // Notify the person who sent the invite that it was accepted
      if (invite.invitedBy) {
        const joiner = await this.userRepository.findById(userId);
        logger.info(`Notifying inviter ${invite.invitedBy} that user ${userId} joined`);
        this.notificationService
          .notify(
            invite.invitedBy,
            'member.joined',
            `${joiner?.name ?? 'Someone'} joined ${group?.name ?? 'your group'}`,
            `Your invite was accepted. ${joiner?.name ?? 'A new member'} has joined the group.`,
            { group_id: invite.groupId, user_id: userId },
          )
          .catch(() => {});
      }

      logger.info(`User ${userId} joined group ${invite.groupId} via invite ${invite.id}`);
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
