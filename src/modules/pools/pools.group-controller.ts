import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Post } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import PoolService, { IPoolService } from './pools.service';
import { CreatePoolSchema, CreatePoolDTO } from './pools.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Pools
 */

@injectable()
@Controller('/groups')
class PoolGroupController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.GROUPS) router: express.Router,
    @inject(PoolService) private readonly poolService: IPoolService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /groups/{groupId}/pools:
   *   post:
   *     tags: [Pools]
   *     summary: Create an expense pool in a group
   *     description: Creates a new pool and adds specified group members to it
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
   *             required: [name, memberIds]
   *             properties:
   *               name: { type: string, maxLength: 100 }
   *               description: { type: string }
   *               memberIds:
   *                 type: array
   *                 items: { type: string, format: uuid }
   *     responses:
   *       '201':
   *         description: Pool created
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
   *                 split_type: { type: string, example: equal }
   *                 created_by: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:groupId/pools', { validate: CreatePoolSchema, statusCode: 201 })
  async createPool(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as CreatePoolDTO;
    return this.poolService.createPool(req.params['groupId'] as string, userId, payload);
  }

  /**
   * @swagger
   * /groups/{groupId}/pools:
   *   get:
   *     tags: [Pools]
   *     summary: List pools in a group
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: groupId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       '200':
   *         description: Paginated pool list
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 page: { type: integer, example: 1 }
   *                 limit: { type: integer, example: 20 }
   *                 total_items: { type: integer }
   *                 pages: { type: integer }
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       group_id: { type: string }
   *                       name: { type: string }
   *                       description: { type: string, nullable: true }
   *                       status: { type: string, enum: [active, settled, closed] }
   *                       activity_status: { type: string, enum: [empty, ongoing, settled] }
   *                       expense_count: { type: integer }
   *                       created_by: { type: string, nullable: true }
   *                       created_at: { type: string, format: date-time }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId/pools')
  async listPools(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    return this.poolService.listPools(req.params['groupId'] as string, userId, page, limit);
  }
}

export default PoolGroupController;
