import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import SummaryService, { ISummaryService } from './summary.service';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Summary
 *   description: Aggregated data for frontend dashboard screens
 */

/**
 * @swagger
 * /users/me/summary:
 *   get:
 *     tags: [Summary]
 *     summary: Get current user's dashboard summary
 *     description: |
 *       Returns everything needed for the home screen in a single call:
 *       overall balance totals, group count, upcoming recurring expense count,
 *       and the 5 most recent activities.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: object
 *                   properties:
 *                     total_owed: { type: number, description: Total the user owes others }
 *                     total_owed_to_me: { type: number, description: Total others owe the user }
 *                     net: { type: number, description: total_owed_to_me minus total_owed }
 *                 groups_count: { type: integer }
 *                 upcoming_expenses_count: { type: integer }
 *                 recent_activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string }
 *                       actor: { type: object, nullable: true }
 *                       pool: { type: object, nullable: true }
 *                       metadata: { type: object, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
@injectable()
@Controller('/users')
export class UserSummaryController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.USERS_SUMMARY) router: express.Router,
    @inject(SummaryService) private readonly summaryService: ISummaryService,
  ) {
    super(router);
  }

  @Get('/me/summary')
  async getUserSummary(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.summaryService.getUserSummary(userId);
  }
}

/**
 * @swagger
 * /groups/{groupId}/summary:
 *   get:
 *     tags: [Summary]
 *     summary: Get group header summary
 *     description: |
 *       Returns core group info plus aggregated stats: member count, pool count,
 *       total spend, and the authenticated user's balance within the group.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Group summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 description: { type: string, nullable: true }
 *                 emoji: { type: string, nullable: true }
 *                 color: { type: string, nullable: true }
 *                 member_count: { type: integer }
 *                 pool_count: { type: integer }
 *                 total_spend: { type: number }
 *                 balance:
 *                   type: object
 *                   properties:
 *                     total_owed: { type: number }
 *                     total_owed_to_me: { type: number }
 *                     net: { type: number }
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
@injectable()
@Controller('/groups')
export class GroupSummaryController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.GROUPS_SUMMARY) router: express.Router,
    @inject(SummaryService) private readonly summaryService: ISummaryService,
  ) {
    super(router);
  }

  @Get('/:groupId/summary')
  async getGroupSummary(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.summaryService.getGroupSummary(req.params['groupId'] as string, userId);
  }
}

/**
 * @swagger
 * /pools/{poolId}/summary:
 *   get:
 *     tags: [Summary]
 *     summary: Get pool header summary
 *     description: |
 *       Returns core pool info plus aggregated stats: member count, expense count,
 *       financial totals, and the authenticated user's balance within the pool.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Pool summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 description: { type: string, nullable: true }
 *                 is_default: { type: boolean }
 *                 member_count: { type: integer }
 *                 expense_count: { type: integer }
 *                 total_amount: { type: number, description: Sum of all expense amounts }
 *                 amount_collected: { type: number, description: Sum of settled split amounts }
 *                 outstanding: { type: number, description: total_amount minus amount_collected }
 *                 balance:
 *                   type: object
 *                   properties:
 *                     total_owed: { type: number }
 *                     total_owed_to_me: { type: number }
 *                     net: { type: number }
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
@injectable()
@Controller('/pools')
export class PoolSummaryController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.POOLS_SUMMARY) router: express.Router,
    @inject(SummaryService) private readonly summaryService: ISummaryService,
  ) {
    super(router);
  }

  @Get('/:poolId/summary')
  async getPoolSummary(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.summaryService.getPoolSummary(req.params['poolId'] as string, userId);
  }
}
