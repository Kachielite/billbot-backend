import { inject, injectable } from 'tsyringe';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  BaseController,
  Controller,
  Delete,
  Get,
  Post,
} from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import ExpenseService, { IExpenseService } from './expenses.service';
import { CreateExpenseSchema, CreateExpenseDTO } from './expenses.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { BadRequestException } from '@/common/exception';
import { validateImageMagicBytes } from '@/common/utils/file-validator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
 *   description: Expense and split management
 */

@injectable()
@Controller('/pools')
class ExpenseController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.EXPENSES) router: express.Router,
    @inject(ExpenseService) private readonly expenseService: IExpenseService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /pools/{poolId}/expenses:
   *   post:
   *     tags: [Expenses]
   *     summary: Log an expense
   *     description: |
   *       Creates an expense and calculates splits. Pass a `splits` array for exact per-person
   *       amounts; omit it to split equally among all pool members.
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [amount]
   *             properties:
   *               amount: { type: number }
   *               description: { type: string }
   *               categoryId: { type: string, format: uuid, description: 'UUID from GET /v1/categories' }
   *               currency: { type: string, enum: [NGN, KES, GHS, ZAR], default: NGN }
   *               receipt: { type: string, format: binary }
   *               isRecurring: { type: boolean, default: false, description: 'Mark this expense as recurring' }
   *               recurrenceFrequency: { type: string, enum: [daily, weekly, biweekly, monthly, yearly], description: 'Required when isRecurring is true' }
   *               recurrenceEndDate: { type: string, format: date-time, description: 'Optional ISO date after which no more instances are generated' }
   *               splits:
   *                 type: string
   *                 description: |
   *                   JSON-encoded array of exact splits, e.g. `[{"userId":"<uuid>","amount":3000},{"userId":"<uuid>","amount":7000}]`.
   *                   Amounts must sum to `amount` (±0.01). Every userId must be a pool member.
   *                   Omit to split equally among all pool members.
   *     responses:
   *       '201':
   *         description: Expense created with splits
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 pool_id: { type: string }
   *                 paid_by: { type: string, nullable: true }
   *                 amount: { type: string, example: '3000.00' }
   *                 currency: { type: string, example: NGN }
   *                 description: { type: string, nullable: true }
   *                 category_id: { type: string, nullable: true }
   *                 receipt_url: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *                 is_recurring: { type: boolean }
   *                 recurrence_frequency: { type: string, nullable: true, enum: [daily, weekly, biweekly, monthly, yearly] }
   *                 recurrence_end_date: { type: string, format: date-time, nullable: true }
   *                 next_occurrence_at: { type: string, format: date-time, nullable: true }
   *                 splits:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       expense_id: { type: string }
   *                       owed_by: { type: string, nullable: true }
   *                       amount: { type: string }
   *                       settled: { type: boolean }
   *                       settled_at: { type: string, format: date-time, nullable: true }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:poolId/expenses', { statusCode: 201 })
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
        const result = await this.expenseService.createExpense(
          req.params['poolId'] as string,
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
   * /pools/{poolId}/expenses/parse-receipt:
   *   post:
   *     tags: [Expenses]
   *     summary: Parse a receipt image with AI
   *     description: Sends the receipt image to GPT-4o vision for parsing. Non-blocking — always stores image and returns parsed fields (may be null if parse fails).
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
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [receipt]
   *             properties:
   *               receipt: { type: string, format: binary }
   *     responses:
   *       '200':
   *         description: Parse result
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 parsed:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     amount: { type: number, nullable: true }
   *                     currency: { type: string, nullable: true }
   *                     merchant: { type: string, nullable: true }
   *                     description: { type: string, nullable: true }
   *                     category: { type: string, nullable: true }
   *                     date: { type: string, nullable: true }
   *                 receipt_url: { type: string }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/:poolId/expenses/parse-receipt')
  async parseReceipt(req: Request, res: Response, next: NextFunction) {
    upload.single('receipt')(req, res, async (err) => {
      if (err) return next(new BadRequestException(err.message));
      if (!req.file) return next(new BadRequestException('Receipt image is required.'));
      if (!validateImageMagicBytes(req.file.buffer, req.file.mimetype)) {
        return next(new BadRequestException('File content does not match the declared type.'));
      }

      try {
        const result = await this.expenseService.parseReceipt(req.file);
        res.json(result);
      } catch (e) {
        next(e);
      }
    });
  }

  /**
   * @swagger
   * /pools/{poolId}/expenses:
   *   get:
   *     tags: [Expenses]
   *     summary: List expenses in a pool
   *     description: Paginated list of expenses with split status per expense
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
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
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:poolId/expenses')
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
    return this.expenseService.listExpenses(
      req.params['poolId'] as string,
      userId,
      page,
      limit,
      filter,
    );
  }

  /**
   * @swagger
   * /expenses/{expenseId}:
   *   get:
   *     tags: [Expenses]
   *     summary: Get expense detail with splits
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: expenseId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Expense with splits breakdown
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 pool_id: { type: string }
   *                 paid_by: { type: string, nullable: true }
   *                 amount: { type: string }
   *                 currency: { type: string }
   *                 description: { type: string, nullable: true }
   *                 category_id: { type: string, nullable: true }
   *                 receipt_url: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *                 splits:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       expense_id: { type: string }
   *                       owed_by: { type: string, nullable: true }
   *                       amount: { type: string }
   *                       settled: { type: boolean }
   *                       settled_at: { type: string, format: date-time, nullable: true }
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/:poolId/expenses/:expenseId')
  async getExpense(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.expenseService.getExpense(req.params['expenseId'] as string, userId);
  }

  /**
   * @swagger
   * /expenses/{expenseId}:
   *   delete:
   *     tags: [Expenses]
   *     summary: Delete an expense
   *     description: Only allowed if no splits are settled. Payer or admin only.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: expenseId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Expense deleted
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:poolId/expenses/:expenseId')
  async deleteExpense(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.expenseService.deleteExpense(req.params['expenseId'] as string, userId);
  }

  /**
   * @swagger
   * /pools/{poolId}/expenses/{expenseId}/recurrence:
   *   delete:
   *     tags: [Expenses]
   *     summary: Cancel a recurring expense
   *     description: |
   *       Stops future auto-generation of this expense. The original expense and all
   *       previously generated instances are kept. Only the payer can cancel.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: poolId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: expenseId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       '200':
   *         description: Recurring schedule cancelled
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string }
   *                 data: { type: object, nullable: true }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '403':
   *         $ref: '#/components/responses/Forbidden'
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Delete('/:poolId/expenses/:expenseId/recurrence')
  async cancelRecurrence(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.expenseService.cancelRecurrence(req.params['expenseId'] as string, userId);
  }
}

export default ExpenseController;
