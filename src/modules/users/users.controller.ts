import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Put } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import UserService, { IUserService } from './users.service';
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
}

export default UserController;
