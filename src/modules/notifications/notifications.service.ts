import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { INotificationRepository } from './notifications.repository';
import { INotification, ICreateNotification, NotificationType } from './notifications.interface';
import { IPagination, IGeneralResponse } from '@/common/types/interface';
import { ResourceNotFoundException, InternalServerException } from '@/common/exception';
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
}

@injectable()
class NotificationService implements INotificationService {
  constructor(
    @inject('INotificationRepository') private notificationRepository: INotificationRepository,
  ) {}

  /**
   * Fire-and-forget — callers should NOT await this if they want non-blocking behaviour.
   * Errors are caught and logged so a notification failure never breaks the caller.
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const data: ICreateNotification = { id: uuidv4(), userId, type, title, body, metadata };
      await this.notificationRepository.create(data);
    } catch (error) {
      logger.error(`Failed to create notification for user ${userId}: ${error}`);
    }
  }

  async listNotifications(
    userId: string,
    page: number,
    limit: number,
  ): Promise<IPagination<INotification> & { unread: number }> {
    try {
      const offset = (page - 1) * limit;
      const [notifications, total, unread] = await Promise.all([
        this.notificationRepository.findByUser(userId, limit, offset),
        this.notificationRepository.countByUser(userId),
        this.notificationRepository.countUnreadByUser(userId),
      ]);

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
    try {
      await this.notificationRepository.markRead(id, userId);
      return { success: true, message: 'Notification marked as read.', data: null };
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error marking notification read: ${error}`);
      throw new InternalServerException('Failed to mark notification as read.');
    }
  }

  async markAllRead(userId: string): Promise<IGeneralResponse<null>> {
    try {
      await this.notificationRepository.markAllRead(userId);
      return { success: true, message: 'All notifications marked as read.', data: null };
    } catch (error) {
      logger.error(`Error marking all notifications read: ${error}`);
      throw new InternalServerException('Failed to mark all notifications as read.');
    }
  }
}

export default NotificationService;
