import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import {
  BaseController,
  Controller,
  Delete,
  Get,
  Post,
} from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import WebhookService, { IWebhookService } from './webhooks.service';
import { CreateWebhookSchema, CreateWebhookDTO } from './webhooks.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Outbound webhook subscription management
 */

@injectable()
@Controller('/groups')
class WebhookController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.WEBHOOKS) router: express.Router,
    @inject(WebhookService) private readonly webhookService: IWebhookService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /groups/{groupId}/webhooks:
   *   post:
   *     tags: [Webhooks]
   *     summary: Register a webhook
   *     description: Admin only. The signing secret is returned once — store it securely.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url, events]
   *             properties:
   *               url: { type: string, format: uri }
   *               events:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [group.created, member.invited, member.joined, member.removed, pool.created, pool.settled, pool.member_added, expense.created, expense.deleted, settlement.submitted, settlement.confirmed, settlement.disputed]
   *     responses:
   *       '201':
   *         description: Webhook registered. Secret returned once — store it immediately.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 group_id: { type: string }
   *                 url: { type: string }
   *                 secret: { type: string, description: 'HMAC-SHA256 signing secret. Returned only on creation.' }
   *                 events:
   *                   type: array
   *                   items: { type: string }
   *                 created_by: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:groupId/webhooks', { validate: CreateWebhookSchema, statusCode: 201 })
  async createWebhook(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as CreateWebhookDTO;
    return this.webhookService.createSubscription(req.params['groupId'] as string, userId, payload);
  }

  /**
   * @swagger
   * /groups/{groupId}/webhooks:
   *   get:
   *     tags: [Webhooks]
   *     summary: List registered webhooks
   *     description: Admin only. Secrets are not included in the response.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Webhook list (secrets omitted)
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id: { type: string }
   *                   group_id: { type: string }
   *                   url: { type: string }
   *                   events:
   *                     type: array
   *                     items: { type: string }
   *                   created_by: { type: string, nullable: true }
   *                   created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId/webhooks')
  async listWebhooks(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.webhookService.listSubscriptions(req.params['groupId'] as string, userId);
  }

  /**
   * @swagger
   * /groups/{groupId}/webhooks/{webhookId}:
   *   delete:
   *     tags: [Webhooks]
   *     summary: Remove a webhook subscription
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: webhookId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Webhook removed
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:groupId/webhooks/:webhookId')
  async deleteWebhook(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.webhookService.deleteSubscription(
      req.params['groupId'] as string,
      req.params['webhookId'] as string,
      userId,
    );
  }
}

export default WebhookController;
