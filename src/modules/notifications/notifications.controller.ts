import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import {
  BaseController,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
} from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import NotificationService, { INotificationService } from './notifications.service';
import { RegisterDeviceTokenSchema, UpdatePreferencesSchema } from './notifications.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: In-app notification centre and push settings
 */

@injectable()
@Controller('/notifications')
class NotificationController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.NOTIFICATIONS) router: express.Router,
    @inject(NotificationService) private readonly notificationService: INotificationService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /notifications:
   *   get:
   *     tags: [Notifications]
   *     summary: List my notifications
   *     description: Returns paginated notifications for the authenticated user, newest first. Includes an `unread` count.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       '200':
   *         description: Paginated notification list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       user_id: { type: string }
   *                       type: { type: string, example: invite.received }
   *                       title: { type: string }
   *                       body: { type: string }
   *                       metadata: { type: object }
   *                       is_read: { type: boolean }
   *                       created_at: { type: string, format: date-time }
   *                 total_items: { type: integer }
   *                 page: { type: integer }
   *                 limit: { type: integer }
   *                 pages: { type: integer }
   *                 unread: { type: integer }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/')
  async listNotifications(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20),
    );
    return this.notificationService.listNotifications(userId, page, limit);
  }

  /**
   * @swagger
   * /notifications/{id}/read:
   *   patch:
   *     tags: [Notifications]
   *     summary: Mark a notification as read
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Notification marked as read
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/:id/read')
  async markRead(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.markRead(req.params['id'] as string, userId);
  }

  /**
   * @swagger
   * /notifications/read-all:
   *   patch:
   *     tags: [Notifications]
   *     summary: Mark all notifications as read
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: All notifications marked as read
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/read-all')
  async markAllRead(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.markAllRead(userId);
  }

  /**
   * @swagger
   * /notifications/device-token:
   *   post:
   *     tags: [Notifications]
   *     summary: Register a device for push notifications
   *     description: Saves the OneSignal player ID for the authenticated user's device. Call this after the client SDK provides a player ID on login or app open.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [player_id]
   *             properties:
   *               player_id:
   *                 type: string
   *                 description: OneSignal player / subscription ID
   *               platform:
   *                 type: string
   *                 enum: [ios, android, web]
   *     responses:
   *       '200':
   *         description: Device token registered
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/device-token', { validate: RegisterDeviceTokenSchema })
  async registerDeviceToken(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const { player_id, platform } = req.body as { player_id: string; platform?: string };
    return this.notificationService.registerDeviceToken(userId, player_id, platform);
  }

  /**
   * @swagger
   * /notifications/device-token/{playerId}:
   *   delete:
   *     tags: [Notifications]
   *     summary: Unregister a device from push notifications
   *     description: Removes the OneSignal player ID. Call this on logout to stop push notifications to the device.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: playerId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Device token removed
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/device-token/:playerId')
  async removeDeviceToken(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.removeDeviceToken(userId, req.params['playerId'] as string);
  }

  /**
   * @swagger
   * /notifications/preferences:
   *   get:
   *     tags: [Notifications]
   *     summary: Get notification preferences
   *     description: Returns the user's push notification toggle settings. Defaults to all enabled if the user has never set preferences.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Notification preferences
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user_id: { type: string }
   *                 invite_received: { type: boolean }
   *                 member_joined: { type: boolean }
   *                 expense_created: { type: boolean }
   *                 settlement_submitted: { type: boolean }
   *                 settlement_confirmed: { type: boolean }
   *                 settlement_disputed: { type: boolean }
   *                 general: { type: boolean }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/preferences')
  async getPreferences(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.getPreferences(userId);
  }

  /**
   * @swagger
   * /notifications/preferences:
   *   patch:
   *     tags: [Notifications]
   *     summary: Update notification preferences
   *     description: Toggle individual push notification types on or off. Send only the fields you want to change.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               invite_received: { type: boolean }
   *               member_joined: { type: boolean }
   *               expense_created: { type: boolean }
   *               settlement_submitted: { type: boolean }
   *               settlement_confirmed: { type: boolean }
   *               settlement_disputed: { type: boolean }
   *               general: { type: boolean }
   *     responses:
   *       '200':
   *         description: Updated preferences
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/preferences', { validate: UpdatePreferencesSchema })
  async updatePreferences(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.updatePreferences(userId, req.body);
  }
}

export default NotificationController;
