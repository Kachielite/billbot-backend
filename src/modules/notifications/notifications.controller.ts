import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Patch } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import NotificationService, { INotificationService } from './notifications.service';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: In-app notification centre
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
   *                       title: { type: string, example: "New group invite" }
   *                       body: { type: string }
   *                       metadata: { type: object }
   *                       is_read: { type: boolean }
   *                       created_at: { type: string, format: date-time }
   *                 total_items: { type: integer }
   *                 page: { type: integer }
   *                 limit: { type: integer }
   *                 pages: { type: integer }
   *                 unread: { type: integer, description: Count of unread notifications }
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string }
   *                 data: { type: object, nullable: true }
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string }
   *                 data: { type: object, nullable: true }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/read-all')
  async markAllRead(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.notificationService.markAllRead(userId);
  }
}

export default NotificationController;
