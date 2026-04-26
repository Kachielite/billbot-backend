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
import InviteService, { IInviteService } from './invites.service';
import { CreateInviteSchema, CreateInviteDTO } from './invites.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Invites
 *   description: Group invite management
 */

@injectable()
@Controller('/groups')
class InviteController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.INVITES) router: express.Router,
    @inject(InviteService) private readonly inviteService: IInviteService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /groups/{groupId}/invites:
   *   post:
   *     tags: [Invites]
   *     summary: Create an invite
   *     description: Invite a user by phone or email. Fires webhook member.invited.
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
   *             properties:
   *               phone: { type: string }
   *               email: { type: string, format: email }
   *     responses:
   *       '201':
   *         description: Invite created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 group_id: { type: string }
   *                 invited_by: { type: string, nullable: true }
   *                 phone: { type: string, nullable: true }
   *                 email: { type: string, nullable: true }
   *                 token: { type: string }
   *                 status: { type: string, example: pending }
   *                 expires_at: { type: string, format: date-time }
   *                 created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:groupId/invites', { validate: CreateInviteSchema, statusCode: 201 })
  async createInvite(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as CreateInviteDTO;
    return this.inviteService.createInvite(req.params['groupId'] as string, userId, payload);
  }

  /**
   * @swagger
   * /groups/{groupId}/invites:
   *   get:
   *     tags: [Invites]
   *     summary: List pending invites
   *     description: Admin only
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: List of pending invites
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id: { type: string }
   *                   group_id: { type: string }
   *                   invited_by: { type: string, nullable: true }
   *                   phone: { type: string, nullable: true }
   *                   email: { type: string, nullable: true }
   *                   token: { type: string }
   *                   status: { type: string, example: pending }
   *                   expires_at: { type: string, format: date-time }
   *                   created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId/invites')
  async listInvites(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.inviteService.getPendingInvites(req.params['groupId'] as string, userId);
  }

  /**
   * @swagger
   * /groups/{groupId}/invites/{inviteId}:
   *   delete:
   *     tags: [Invites]
   *     summary: Cancel a pending invite
   *     description: Admin only
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: inviteId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Invite cancelled
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:groupId/invites/:inviteId')
  async cancelInvite(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.inviteService.cancelInvite(
      req.params['groupId'] as string,
      req.params['inviteId'] as string,
      userId,
    );
  }

  /**
   * @swagger
   * /groups/join/{token}:
   *   post:
   *     tags: [Invites]
   *     summary: Join a group via invite token
   *     description: Accepts an invite token and adds the authenticated user to the group
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: token
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Joined group successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string, example: Successfully joined the group. }
   *                 data: { type: object, nullable: true }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/join/:token')
  async joinGroup(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.inviteService.joinByToken(req.params['token'] as string, userId);
  }

  /**
   * @swagger
   * /groups/join:
   *   post:
   *     tags: [Invites]
   *     summary: Join a group using an invite code
   *     description: Accepts the short invite code shown in the email (e.g. TUNDE-4821). User must be authenticated.
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [code]
   *             properties:
   *               code:
   *                 type: string
   *                 example: TUNDE-4821
   *     responses:
   *       '200':
   *         description: Successfully joined the group
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '409':
   *         $ref: '#/components/responses/Conflict'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/join')
  async joinGroupByCode(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const { code } = req.body as { code: string };
    if (!code) throw new Error('code is required');
    return this.inviteService.joinByCode(code, userId);
  }
}

export default InviteController;
