import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Put } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import UserService, { IUserService } from './users.service';
import ExpenseService, { IExpenseService } from '@/modules/expenses/expenses.service';
import ActivityService, { IActivityService } from '@/modules/activities/activities.service';
import { UpdateUserSchema, UpdateUserDTO } from './users.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User profile management
 */

@injectable()
@Controller('/users')
class UserController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.USERS) router: express.Router,
    @inject(UserService) private readonly userService: IUserService,
    @inject(ExpenseService) private readonly expenseService: IExpenseService,
    @inject(ActivityService) private readonly activityService: IActivityService,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /users/me:
   *   get:
   *     tags: [Users]
   *     summary: Get current user profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 name: { type: string }
   *                 phone: { type: string, nullable: true }
   *                 email: { type: string, nullable: true }
   *                 avatar_url: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/me')
  async getMe(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    return this.userService.getMe(userId);
  }

  /**
   * @swagger
   * /users/me:
   *   put:
   *     tags: [Users]
   *     summary: Update current user profile
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               email: { type: string, format: email, nullable: true }
   *               avatar_url: { type: string, nullable: true }
   *               phone: { type: string, nullable: true }
   *     responses:
   *       '200':
   *         description: Updated profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 name: { type: string }
   *                 email: { type: string, nullable: true }
   *                 avatar_url: { type: string, nullable: true }
   *                 phone: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Put('/me', { validate: UpdateUserSchema })
  async updateMe(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const payload = req.body as UpdateUserDTO;
    return this.userService.updateMe(userId, payload);
  }

  /**
   * @swagger
   * /users/search:
   *   get:
   *     tags: [Users]
   *     summary: Search user by phone number
   *     description: Find a registered user by their phone number (useful for inviting known users)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: phone
   *         required: true
   *         schema:
   *           type: string
   *           example: '+2348012345678'
   *     responses:
   *       '200':
   *         description: User found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id: { type: string }
   *                 name: { type: string }
   *                 email: { type: string, nullable: true }
   *                 avatar_url: { type: string, nullable: true }
   *                 created_at: { type: string, format: date-time }
   *       '404':
   *         $ref: '#/components/responses/NotFound'
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/search')
  async searchByPhone(req: Request) {
    const phone = req.query.phone as string;
    return this.userService.searchByPhone(phone);
  }

  /**
   * @swagger
   * /users/me/expenses/upcoming:
   *   get:
   *     tags: [Users]
   *     summary: List upcoming recurring expenses for the current user
   *     description: |
   *       Returns paginated recurring expenses across all pools the user is a member of,
   *       whose next occurrence is in the future, ordered by next_occurrence_at ascending.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       '200':
   *         description: Paginated list of upcoming recurring expenses
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 page: { type: integer }
   *                 limit: { type: integer }
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
   *                       category_id: { type: string, nullable: true }
   *                       is_recurring: { type: boolean }
   *                       recurrence_frequency: { type: string, nullable: true }
   *                       recurrence_end_date: { type: string, format: date-time, nullable: true }
   *                       next_occurrence_at: { type: string, format: date-time }
   *                       created_at: { type: string, format: date-time }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  /**
   * @swagger
   * /users/me/activities:
   *   get:
   *     tags: [Users]
   *     summary: List recent activities for the current user
   *     description: |
   *       Returns paginated activity feed across all pools the user is a member of,
   *       ordered most-recent first. Covers expense creation/deletion, pool creation,
   *       member changes, and settlement events.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *       - in: query
   *         name: pool_id
   *         schema: { type: string }
   *         description: Filter to a specific pool (must be a pool the user belongs to)
   *       - in: query
   *         name: group_id
   *         schema: { type: string }
   *         description: Filter to all pools within a specific group
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date-time }
   *         description: Return activities on or after this ISO 8601 timestamp
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date-time }
   *         description: Return activities on or before this ISO 8601 timestamp
   *     responses:
   *       '200':
   *         description: Paginated activity feed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 page: { type: integer }
   *                 limit: { type: integer }
   *                 total_items: { type: integer }
   *                 pages: { type: integer }
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id: { type: string }
   *                       type:
   *                         type: string
   *                         enum: [expense.created, expense.deleted, settlement.submitted, settlement.confirmed, settlement.disputed]
   *                       actor:
   *                         type: object
   *                         nullable: true
   *                         properties:
   *                           id: { type: string }
   *                           name: { type: string }
   *                           avatar_url: { type: string, nullable: true }
   *                       pool:
   *                         type: object
   *                         nullable: true
   *                         properties:
   *                           id: { type: string }
   *                           name: { type: string }
   *                       metadata:
   *                         type: object
   *                         nullable: true
   *                         description: |
   *                           Type-specific payload:
   *                           - expense.created: { expense_id, amount, currency, description, category }
   *                           - expense.deleted: { expense_id }
   *                           - settlement.submitted: { settlement_id, amount, currency, to_user_id }
   *                           - settlement.confirmed: { settlement_id, amount, currency, from_user_id }
   *                           - settlement.disputed: { settlement_id, reason }
   *                       created_at: { type: string, format: date-time }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/me/activities')
  async listActivities(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20),
    );

    const poolId = req.query['pool_id'] as string | undefined;
    const groupId = req.query['group_id'] as string | undefined;
    const from = req.query['from'] ? new Date(req.query['from'] as string) : undefined;
    const to = req.query['to'] ? new Date(req.query['to'] as string) : undefined;

    return this.activityService.listActivitiesForUser(userId, page, limit, {
      poolId,
      groupId,
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
    });
  }

  @Get('/me/expenses/upcoming')
  async listUpcomingExpenses(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20),
    );
    return this.expenseService.listUpcomingExpenses(userId, page, limit);
  }
}

export default UserController;
