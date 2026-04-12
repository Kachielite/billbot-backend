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
