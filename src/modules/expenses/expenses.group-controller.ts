import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import ExpenseService, { IExpenseService } from './expenses.service';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Expenses
 */

@injectable()
@Controller('/groups')
class ExpenseGroupController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.GROUPS) router: express.Router,
    @inject(ExpenseService) private readonly expenseService: IExpenseService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /groups/{groupId}/expenses:
   *   get:
   *     tags: [Expenses]
   *     summary: List all expenses in a group
   *     description: Paginated list of expenses across all pools in the group
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
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [pending, settled] }
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date-time }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date-time }
   *     responses:
   *       '200':
   *         description: Paginated expense list
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
   *                       pool_id: { type: string }
   *                       paid_by: { type: string, nullable: true }
   *                       amount: { type: string }
   *                       currency: { type: string }
   *                       description: { type: string, nullable: true }
   *                       category: { type: string, nullable: true }
   *                       receipt_url: { type: string, nullable: true }
   *                       created_at: { type: string, format: date-time }
   *                       splits:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id: { type: string }
   *                             owed_by: { type: string, nullable: true }
   *                             amount: { type: string }
   *                             settled: { type: boolean }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:groupId/expenses')
  async listExpenses(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const rawStatus = req.query.status as string | undefined;
    const filter: import('./expenses.interface').IExpenseFilter = {
      status: rawStatus === 'pending' || rawStatus === 'settled' ? rawStatus : undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
    };
    return this.expenseService.listExpensesByGroup(
      req.params['groupId'] as string,
      userId,
      page,
      limit,
      filter,
    );
  }
}

export default ExpenseGroupController;
