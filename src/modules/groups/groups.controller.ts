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
import GroupService, { IGroupService } from './groups.service';
import { CreateGroupSchema, CreateGroupDTO } from './groups.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Group management
 */

@injectable()
@Controller('/groups')
class GroupController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.GROUPS) router: express.Router,
    @inject(GroupService) private readonly groupService: IGroupService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /groups:
   *   post:
   *     tags: [Groups]
   *     summary: Create a group
   *     description: Creates a new group with the creator as admin and generates an invite code
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string, maxLength: 100 }
   *               description: { type: string, maxLength: 500 }
   *     responses:
   *       '201':
   *         description: Group created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 name: { type: string }
   *                 description: { type: string, nullable: true }
   *                 invite_code: { type: string }
   *                 created_by: { type: string }
   *                 created_at: { type: string, format: date-time }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/', { validate: CreateGroupSchema, statusCode: 201 })
  async createGroup(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as CreateGroupDTO;
    return this.groupService.createGroup(userId, payload);
  }

  /**
   * @swagger
   * /groups:
   *   get:
   *     tags: [Groups]
   *     summary: List my groups
   *     description: Returns all groups the authenticated user belongs to
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: List of groups
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/')
  async listGroups(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.groupService.getUserGroups(userId);
  }

  /**
   * @swagger
   * /groups/{groupId}:
   *   get:
   *     tags: [Groups]
   *     summary: Get group detail
   *     description: Returns group detail including members list
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Group detail
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId')
  async getGroup(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.groupService.getGroupDetail(req.params['groupId'] as string, userId);
  }

  /**
   * @swagger
   * /groups/{groupId}:
   *   delete:
   *     tags: [Groups]
   *     summary: Delete a group
   *     description: Soft deletes the group (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Group deleted
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:groupId')
  async deleteGroup(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.groupService.deleteGroup(req.params['groupId'] as string, userId);
  }

  /**
   * @swagger
   * /groups/{groupId}/members/{userId}:
   *   delete:
   *     tags: [Groups]
   *     summary: Remove a member from a group
   *     description: Admin only. Cannot remove self if last admin.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: userId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Member removed
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:groupId/members/:userId')
  async removeMember(req: Request) {
    const adminId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.groupService.removeMember(
      req.params['groupId'] as string,
      adminId,
      req.params['userId'] as string,
    );
  }
}

export default GroupController;
