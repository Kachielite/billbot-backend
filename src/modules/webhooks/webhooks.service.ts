import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { IWebhookRepository } from './webhooks.repository';
import { IWebhookSubscription } from './webhooks.interface';
import { CreateWebhookDTO } from './webhooks.dto';
import { IGeneralResponse } from '@/common/types/interface';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerException,
  ResourceNotFoundException,
} from '@/common/exception';
import { IGroupRepository } from '@/modules/groups/groups.repository';
import { assertSafeWebhookUrl } from '@/common/utils/ssrf-guard';
import logger from '@/common/lib/logger';

export interface IWebhookService {
  createSubscription(
    groupId: string,
    userId: string,
    data: CreateWebhookDTO,
  ): Promise<IWebhookSubscription & { secret: string }>;
  listSubscriptions(
    groupId: string,
    userId: string,
  ): Promise<Omit<IWebhookSubscription, 'secret'>[]>;
  deleteSubscription(
    groupId: string,
    webhookId: string,
    userId: string,
  ): Promise<IGeneralResponse<null>>;
}

@injectable()
class WebhookService implements IWebhookService {
  constructor(
    @inject('IWebhookRepository') private webhookRepository: IWebhookRepository,
    @inject('IGroupRepository') private groupRepository: IGroupRepository,
  ) {}

  async createSubscription(
    groupId: string,
    userId: string,
    data: CreateWebhookDTO,
  ): Promise<IWebhookSubscription & { secret: string }> {
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only group admins can register webhooks.');
      }

      // SSRF guard: DNS-resolve and reject private/internal addresses
      try {
        await assertSafeWebhookUrl(data.url);
      } catch (err) {
        throw new BadRequestException((err as Error).message);
      }

      const secret = crypto.randomBytes(32).toString('hex');
      const sub = await this.webhookRepository.createSubscription({
        id: uuidv4(),
        groupId,
        url: data.url,
        secret,
        events: data.events,
        createdBy: userId,
      });

      return { ...sub, secret };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) throw error;
      logger.error(`Error creating webhook subscription: ${error}`);
      throw new InternalServerException('Failed to create webhook subscription.');
    }
  }

  async listSubscriptions(
    groupId: string,
    userId: string,
  ): Promise<Omit<IWebhookSubscription, 'secret'>[]> {
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only group admins can view webhooks.');
      }

      const subs = await this.webhookRepository.findSubscriptionsByGroup(groupId);
      return subs.map(({ secret: _secret, ...rest }) => rest);
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      logger.error(`Error listing webhook subscriptions: ${error}`);
      throw new InternalServerException('Failed to list webhook subscriptions.');
    }
  }

  async deleteSubscription(
    groupId: string,
    webhookId: string,
    userId: string,
  ): Promise<IGeneralResponse<null>> {
    try {
      const member = await this.groupRepository.getMember(groupId, userId);
      if (!member || member.role !== 'admin') {
        throw new ForbiddenException('Only group admins can remove webhooks.');
      }

      const subs = await this.webhookRepository.findSubscriptionsByGroup(groupId);
      const target = subs.find((s) => s.id === webhookId);
      if (!target) throw new ResourceNotFoundException('Webhook subscription not found.');

      await this.webhookRepository.deleteSubscription(webhookId);
      return { success: true, message: 'Webhook subscription removed.', data: null };
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof ResourceNotFoundException)
        throw error;
      logger.error(`Error deleting webhook subscription: ${error}`);
      throw new InternalServerException('Failed to delete webhook subscription.');
    }
  }
}

export default WebhookService;
