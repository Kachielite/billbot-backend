import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import BalanceService, { IBalanceService } from './balances.service';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Balances
 *   description: Pool balance calculations
 */

@injectable()
@Controller('/pools')
class BalanceController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.BALANCES) router: express.Router,
    @inject(BalanceService) private readonly balanceService: IBalanceService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /pools/{poolId}/balances:
   *   get:
   *     tags: [Balances]
   *     summary: Get simplified balances for a pool
   *     description: |
   *       Returns simplified who-owes-who using a greedy debt simplification algorithm.
   *       Creditors (net positive) are owed money; debtors (net negative) owe money.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Balance result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 balances:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       from:
   *                         type: object
   *                         properties:
   *                           id: { type: string }
   *                           name: { type: string }
   *                       to:
   *                         type: object
   *                         properties:
   *                           id: { type: string }
   *                           name: { type: string }
   *                       amount: { type: number }
   *                       currency: { type: string }
   *                 memberSummary:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user:
   *                         type: object
   *                         properties:
   *                           id: { type: string }
   *                           name: { type: string }
   *                       totalPaid: { type: number }
   *                       totalOwed: { type: number }
   *                       netBalance: { type: number }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:poolId/balances')
  async getBalances(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.balanceService.getPoolBalances(req.params['poolId'] as string, userId);
  }
}

export default BalanceController;

/**
 * @swagger
 * /groups/{groupId}/balances:
 *   get:
 *     tags: [Balances]
 *     summary: Get simplified balances for a group
 *     description: |
 *       Returns simplified who-owes-who across all pools in the group,
 *       using a greedy debt simplification algorithm.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Balance result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       from:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                       to:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                       amount: { type: number }
 *                       currency: { type: string }
 *                 memberSummary:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           name: { type: string }
 *                       totalPaid: { type: number }
 *                       totalOwed: { type: number }
 *                       netBalance: { type: number }
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
@injectable()
@Controller('/groups')
export class BalanceGroupController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.GROUPS) router: express.Router,
    @inject(BalanceService) private readonly balanceService: IBalanceService,
  ) {
    super(router);
  }

  @Get('/:groupId/balances')
  async getGroupBalances(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.balanceService.getGroupBalances(req.params['groupId'] as string, userId);
  }
}

/**
 * @swagger
 * /balances:
 *   get:
 *     tags: [Balances]
 *     summary: Get the authenticated user's overall balance summary
 *     description: |
 *       Returns the total amount the authenticated user owes across all pools
 *       and the total amount owed to them by others.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: User balance summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalOwed:
 *                   type: number
 *                   description: Total amount the user owes others (unsettled splits)
 *                 totalOwedToMe:
 *                   type: number
 *                   description: Total amount others owe the user (unsettled splits)
 *                 currency:
 *                   type: string
 *                   example: NGN
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
@injectable()
@Controller('/balances')
export class BalanceSummaryController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.BALANCES_SUMMARY) router: express.Router,
    @inject(BalanceService) private readonly balanceService: IBalanceService,
  ) {
    super(router);
  }

  @Get('/')
  async getUserBalance(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.balanceService.getUserBalanceSummary(userId);
  }
}
