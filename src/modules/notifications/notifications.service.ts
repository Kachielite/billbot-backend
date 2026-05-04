import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { INotificationRepository } from './notifications.repository';
import {
  INotification,
  ICreateNotification,
  INotificationPreferences,
  IUpdateNotificationPreferences,
  NotificationType,
} from './notifications.interface';
import { IPagination, IGeneralResponse } from '@/common/types/interface';
import { ResourceNotFoundException, InternalServerException } from '@/common/exception';
import { sendPushNotification } from '@/common/lib/push';
import logger from '@/common/lib/logger';

export interface INotificationService {
  notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  listNotifications(
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<INotification> & { unread: number }>;
  markRead(id: string, userId: string): Promise<IGeneralResponse<null>>;
  markAllRead(userId: string): Promise<IGeneralResponse<null>>;
  markReadByMeta(
    userId: string,
    type: NotificationType,
    meta: Record<string, unknown>,
  ): Promise<void>;
  registerDeviceToken(
    userId: string,
    playerId: string,
    platform?: string,
  ): Promise<IGeneralResponse<null>>;
  removeDeviceToken(userId: string, playerId: string): Promise<IGeneralResponse<null>>;
  getPreferences(userId: string): Promise<INotificationPreferences>;
  updatePreferences(
    userId: string,
    data: IUpdateNotificationPreferences,
  ): Promise<INotificationPreferences>;
}

const PREF_KEY: Record<NotificationType, keyof INotificationPreferences> = {
  'invite.received': 'invite_received',
  'member.joined': 'member_joined',
  'expense.created': 'expense_created',
  'settlement.submitted': 'settlement_submitted',
  'settlement.confirmed': 'settlement_confirmed',
  'settlement.disputed': 'settlement_disputed',
  general: 'general',
};

const ALL_ENABLED: Omit<INotificationPreferences, 'userId'> = {
  invite_received: true,
  member_joined: true,
  expense_created: true,
  settlement_submitted: true,
  settlement_confirmed: true,
  settlement_disputed: true,
  general: true,
};

@injectable()
class NotificationService implements INotificationService {
  constructor(
    @inject('INotificationRepository') private notificationRepository: INotificationRepository,
  ) {}

  /**
   * Saves an in-app notification then fires a push notification if the user has
   * devices registered and has not disabled this notification type.
   * Fire-and-forget — errors are swallowed so callers are never blocked.
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    logger.info(`Creating notification for user ${userId}, type: ${type}, title: "${title}"`);
    try {
      const data: ICreateNotification = { id: uuidv4(), userId, type, title, body, metadata };
      await this.notificationRepository.create(data);
      logger.info(`Notification created for user ${userId}`);
    } catch (error) {
      logger.error(`Failed to create notification for user ${userId}: ${error}`);
      return;
    }

    // Push — non-blocking, errors never propagate to callers
    this.dispatchPush(userId, type, title, body, metadata).catch(() => {});
  }

  private async dispatchPush(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const [prefs, tokens] = await Promise.all([
        this.notificationRepository.findPreferences(userId),
        this.notificationRepository.findTokensByUser(userId),
      ]);

      const effective = prefs ?? { userId, ...ALL_ENABLED };
      const prefKey = PREF_KEY[type];
      if (!effective[prefKey]) return;

      const playerIds = tokens.map((t) => t.playerId);
      if (playerIds.length === 0) return;

      await sendPushNotification(playerIds, title, body, { type, ...metadata });
    } catch (error) {
      logger.warn(`Push dispatch failed for user ${userId} (${type}): ${error}`);
    }
  }

  async listNotifications(
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<INotification> & { unread: number }> {
    logger.info(`Listing notifications for user ${userId}, page ${page}, limit ${limit}`);
    try {
      const offset = (page - 1) * limit;
      const [notifications, total, unread] = await Promise.all([
        this.notificationRepository.findByUser(userId, limit, offset),
        this.notificationRepository.countByUser(userId),
        this.notificationRepository.countUnreadByUser(userId),
      ]);
      logger.info(
        `Returning ${notifications.length} of ${total} notification(s) for user ${userId} (${unread} unread)`,
      );
      return {
        items: notifications,
        total_items: total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        unread,
      };
    } catch (error) {
      logger.error(`Error listing notifications: ${error}`);
      throw new InternalServerException('Failed to fetch notifications.');
    }
  }

  async markRead(id: string, userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Mark notification ${id} as read for user ${userId}`);
    try {
      await this.notificationRepository.markRead(id, userId);
      logger.info(`Notification ${id} marked as read`);
      return { success: true, message: 'Notification marked as read.', data: null };
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error marking notification read: ${error}`);
      throw new InternalServerException('Failed to mark notification as read.');
    }
  }

  async markAllRead(userId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Mark all notifications as read for user ${userId}`);
    try {
      await this.notificationRepository.markAllRead(userId);
      logger.info(`All notifications marked as read for user ${userId}`);
      return { success: true, message: 'All notifications marked as read.', data: null };
    } catch (error) {
      logger.error(`Error marking all notifications read: ${error}`);
      throw new InternalServerException('Failed to mark all notifications as read.');
    }
  }

  async markReadByMeta(
    userId: string,
    type: NotificationType,
    meta: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.notificationRepository.markReadByMeta(userId, type, meta);
    } catch (error) {
      logger.warn(`Failed to auto-mark notification read (${type}) for user ${userId}: ${error}`);
    }
  }

  async registerDeviceToken(
    userId: string,
    playerId: string,
    platform?: string,
  ): Promise<IGeneralResponse<null>> {
    logger.info(`Registering device token for user ${userId}, platform: ${platform ?? 'unknown'}`);
    try {
      await this.notificationRepository.upsertDeviceToken(uuidv4(), userId, playerId, platform);
      logger.info(`Device token registered for user ${userId}`);
      return { success: true, message: 'Device token registered.', data: null };
    } catch (error) {
      logger.error(`Failed to register device token for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to register device token.');
    }
  }

  async removeDeviceToken(userId: string, playerId: string): Promise<IGeneralResponse<null>> {
    logger.info(`Removing device token for user ${userId}`);
    try {
      await this.notificationRepository.removeDeviceToken(userId, playerId);
      logger.info(`Device token removed for user ${userId}`);
      return { success: true, message: 'Device token removed.', data: null };
    } catch (error) {
      logger.error(`Failed to remove device token for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to remove device token.');
    }
  }

  async getPreferences(userId: string): Promise<INotificationPreferences> {
    logger.info(`Fetching notification preferences for user ${userId}`);
    try {
      const prefs = await this.notificationRepository.findPreferences(userId);
      return prefs ?? { userId, ...ALL_ENABLED };
    } catch (error) {
      logger.error(`Failed to fetch preferences for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch notification preferences.');
    }
  }

  async updatePreferences(
    userId: string,
    data: IUpdateNotificationPreferences,
  ): Promise<INotificationPreferences> {
    logger.info(`Updating notification preferences for user ${userId}`);
    try {
      const prefs = await this.notificationRepository.upsertPreferences(userId, data);
      logger.info(`Notification preferences updated for user ${userId}`);
      return prefs;
    } catch (error) {
      logger.error(`Failed to update preferences for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to update notification preferences.');
    }
  }
}

export default NotificationService;
