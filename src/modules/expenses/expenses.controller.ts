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
   *     description: Creates an expense and auto-calculates equal splits among all pool members
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
   *               category: { type: string, enum: [rent, school_fees, food, transport, utilities, medical, other] }
   *               currency: { type: string, enum: [NGN, KES, GHS, ZAR], default: NGN }
   *               receipt: { type: string, format: binary }
   *     responses:
   *       '201':
   *         description: Expense created with splits
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

        const parsed = CreateExpenseSchema.safeParse({
          ...req.body,
          amount: Number(req.body.amount),
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
    return this.expenseService.listExpenses(req.params['poolId'] as string, userId, page, limit);
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
}

export default ExpenseController;
