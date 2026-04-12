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
   *     responses:
   *       '200':
   *         description: Pool list
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId/pools')
  async listPools(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.poolService.listPools(req.params['groupId'] as string, userId);
  }
}

export default PoolGroupController;
