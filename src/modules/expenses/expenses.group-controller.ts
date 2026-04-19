import { inject, injectable } from 'tsyringe';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { BaseController, Controller, Get, Post } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import ExpenseService, { IExpenseService } from './expenses.service';
import { CreateExpenseSchema, CreateExpenseDTO } from './expenses.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { BadRequestException } from '@/common/exception';
import { validateImageMagicBytes } from '@/common/utils/file-validator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

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
   *   post:
   *     tags: [Expenses]
   *     summary: Log an expense in a group
   *     description: |
   *       Creates an expense in the group's General pool. No pool selection needed.
   *       Pass a `splits` array for exact per-person amounts; omit to split equally among all pool members.
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [amount]
   *             properties:
   *               amount: { type: number }
   *               description: { type: string }
   *               categoryId: { type: string, format: uuid }
   *               currency: { type: string, enum: [NGN, KES, GHS, ZAR], default: NGN }
   *               receipt: { type: string, format: binary }
   *               isRecurring: { type: boolean, default: false }
   *               recurrenceFrequency: { type: string, enum: [daily, weekly, biweekly, monthly, yearly] }
   *               recurrenceEndDate: { type: string, format: date-time }
   *               splits:
   *                 type: string
   *                 description: JSON-encoded array e.g. `[{"userId":"<uuid>","amount":3000}]`
   *     responses:
   *       '201':
   *         description: Expense created
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:groupId/expenses', { statusCode: 201 })
  async createExpense(req: Request, res: Response, next: NextFunction) {
    upload.single('receipt')(req, res, async (err) => {
      if (err) return next(new BadRequestException(err.message));

      try {
        if (req.file && !validateImageMagicBytes(req.file.buffer, req.file.mimetype)) {
          return next(new BadRequestException('File content does not match the declared type.'));
        }

        let rawSplits: unknown = undefined;
        if (req.body.splits) {
          try {
            rawSplits = JSON.parse(req.body.splits as string);
          } catch {
            return next(new BadRequestException('splits must be a valid JSON array.'));
          }
        }

        const parsed = CreateExpenseSchema.safeParse({
          ...req.body,
          amount: Number(req.body.amount),
          splits: rawSplits,
        });
        if (!parsed.success) {
          return next(
            new BadRequestException(parsed.error.errors[0]?.message || 'Validation failed'),
          );
        }

        const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
        const result = await this.expenseService.createExpenseInGroup(
          req.params['groupId'] as string,
          userId,
          parsed.data as CreateExpenseDTO,
          req.file,
        );
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    });
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
