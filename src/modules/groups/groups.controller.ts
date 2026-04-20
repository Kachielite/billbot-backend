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
import GroupService, { IGroupService } from './groups.service';
import { CreateGroupSchema, CreateGroupDTO, UpdateGroupSchema, UpdateGroupDTO } from './groups.dto';
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
   *     description: Returns paginated groups the authenticated user belongs to, including member count and the user's balance within each group
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *       - in: query
   *         name: include_members
   *         schema: { type: boolean, default: false }
   *         description: When true, each group includes a members array with full member details
   *     responses:
   *       '200':
   *         description: Paginated list of groups
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 page: { type: integer }
   *                 limit: { type: integer }
   *                 total_items: { type: integer }
   *                 pages: { type: integer }
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       name: { type: string }
   *                       description: { type: string, nullable: true }
   *                       invite_code: { type: string }
   *                       created_by: { type: string, nullable: true }
   *                       created_at: { type: string, format: date-time }
   *                       member_count: { type: integer }
   *                       members:
   *                         type: array
   *                         description: Only present when include_members=true
   *                         items:
   *                           type: object
   *                           properties:
   *                             user_id: { type: string }
   *                             name: { type: string }
   *                             email: { type: string, nullable: true }
   *                             avatar_url: { type: string, nullable: true }
   *                             role: { type: string, enum: [admin, member] }
   *                             joined_at: { type: string, format: date-time }
   *                       balance:
   *                         type: object
   *                         properties:
   *                           total_owed: { type: number }
   *                           total_owed_to_me: { type: number }
   *                           net_balance: { type: number }
   *                           currency: { type: string }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/')
  async listGroups(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20),
    );
    const includeMembers = req.query['include_members'] === 'true';
    return this.groupService.getUserGroups(userId, page, limit, includeMembers);
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
   *         description: Group detail with members
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 name: { type: string }
   *                 description: { type: string, nullable: true }
   *                 invite_code: { type: string }
   *                 created_by: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id: { type: string }
   *                       name: { type: string }
   *                       email: { type: string, nullable: true }
   *                       avatar_url: { type: string, nullable: true }
   *                       role: { type: string, enum: [admin, member] }
   *                       joined_at: { type: string, format: date-time }
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
   *   patch:
   *     tags: [Groups]
   *     summary: Update group details
   *     description: Admin only. All fields are optional — only provided fields are updated.
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
   *               name: { type: string, maxLength: 100 }
   *               description: { type: string, nullable: true, maxLength: 500 }
   *               emoji: { type: string, nullable: true, maxLength: 10 }
   *               color: { type: string, nullable: true, example: '#FF5733' }
   *     responses:
   *       '200':
   *         description: Updated group
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/:groupId', { validate: UpdateGroupSchema })
  async updateGroup(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.groupService.updateGroup(
      req.params['groupId'] as string,
      userId,
      req.body as UpdateGroupDTO,
    );
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

  /**
   * @swagger
   * /groups/{groupId}/members/{userId}/role:
   *   patch:
   *     tags: [Groups]
   *     summary: Update a member's role
   *     description: Admin only. Cannot demote the last admin.
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
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [role]
   *             properties:
   *               role:
   *                 type: string
   *                 enum: [admin, member]
   *     responses:
   *       '200':
   *         description: Role updated
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Patch('/:groupId/members/:userId/role')
  async updateMemberRole(req: Request) {
    const adminId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const { role } = req.body as { role: 'admin' | 'member' };
    return this.groupService.updateMemberRole(
      req.params['groupId'] as string,
      adminId,
      req.params['userId'] as string,
      role,
    );
  }
}

export default GroupController;
