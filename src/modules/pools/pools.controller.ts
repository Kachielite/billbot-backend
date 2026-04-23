import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import {
  BaseController,
  Controller,
  Delete,
  Get,
  Post,
  Put,
} from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import PoolService, { IPoolService } from './pools.service';
import {
  UpdatePoolSchema,
  UpdatePoolDTO,
  AddPoolMemberSchema,
  AddPoolMemberDTO,
} from './pools.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Pools
 *   description: Expense pool management
 */

@injectable()
@Controller('/pools')
class PoolController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.POOLS) router: express.Router,
    @inject(PoolService) private readonly poolService: IPoolService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /pools/{poolId}:
   *   get:
   *     tags: [Pools]
   *     summary: Get pool detail
   *     description: Returns pool detail with members, expense summary, and balance overview
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Pool detail with members
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 group_id: { type: string }
   *                 name: { type: string }
   *                 description: { type: string, nullable: true }
   *                 status: { type: string, enum: [active, settled, closed] }
   *                 split_type: { type: string }
   *                 created_by: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *                 members:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       pool_id: { type: string }
   *                       user_id: { type: string }
   *                       joined_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:poolId')
  async getPool(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.poolService.getPoolDetail(req.params['poolId'] as string, userId);
  }

  /**
   * @swagger
   * /pools/{poolId}:
   *   put:
   *     tags: [Pools]
   *     summary: Update a pool
   *     description: Admin only. Setting status to 'settled' fires webhook pool.settled.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               description: { type: string, nullable: true }
   *               status: { type: string, enum: [active, settled, closed] }
   *     responses:
   *       '200':
   *         description: Pool updated
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Put('/:poolId', { validate: UpdatePoolSchema })
  async updatePool(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as UpdatePoolDTO;
    return this.poolService.updatePool(req.params['poolId'] as string, userId, payload);
  }

  /**
   * @swagger
   * /pools/{poolId}/members:
   *   post:
   *     tags: [Pools]
   *     summary: Add a member to a pool
   *     description: User must already be a group member
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId]
   *             properties:
   *               userId: { type: string, format: uuid }
   *     responses:
   *       '200':
   *         description: Member added
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:poolId/members', { validate: AddPoolMemberSchema })
  async addMember(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as AddPoolMemberDTO;
    return this.poolService.addMember(req.params['poolId'] as string, userId, payload);
  }

  /**
   * @swagger
   * /pools/{poolId}/members/{userId}:
   *   delete:
   *     tags: [Pools]
   *     summary: Remove a member from a pool
   *     description: Admin only. Cannot remove members with unsettled splits.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
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
  @Delete('/:poolId/members/:userId')
  async removeMember(req: Request) {
    const adminId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.poolService.removeMember(
      req.params['poolId'] as string,
      adminId,
      req.params['userId'] as string,
    );
  }

  /**
   * @swagger
   * /pools/{poolId}:
   *   delete:
   *     tags: [Pools]
   *     summary: Delete a pool
   *     description: >
   *       Admin only. Default pools cannot be deleted.
   *       Pools with no expenses are hard-deleted; pools with expenses are archived (status = archived).
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Pool deleted or archived
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string, example: Pool deleted. }
   *                 data: { type: 'null', nullable: true }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:poolId')
  async deletePool(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.poolService.deletePool(req.params['poolId'] as string, userId);
  }
}

export default PoolController;
