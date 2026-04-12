import { inject, injectable } from 'tsyringe';
import express, { Request } from 'express';
import { BaseController, Controller, Get, Post } from '@/common/decorators/controller.decorator';
import { ROUTER_TOKENS } from '@/common/constants/router.tokens';
import AuthService, { IAuthService } from './auth.service';
import { GoogleAuthSchema, GoogleAuthDTO, AppleAuthSchema, AppleAuthDTO } from './auth.dto';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { IUserRepository } from '@/modules/users/users.repository';

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication via Google or Apple Sign-In
 */

@injectable()
@Controller('/auth')
class AuthController extends BaseController {
  constructor(
    @inject(ROUTER_TOKENS.AUTH) router: express.Router,
    @inject(AuthService) private readonly authService: IAuthService,
    @inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {
    super(router);
  }

  /**
   * @swagger
   * /auth/google:
   *   post:
   *     tags: [Auth]
   *     summary: Sign in with Google
   *     description: Verifies Google ID token and returns a session token. Sets isNewUser=true for first-time users.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [idToken]
   *             properties:
   *               idToken:
   *                 type: string
   *                 description: Google ID token from the React Native Google Sign-In SDK
   *     responses:
   *       '200':
   *         description: Authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     token:
   *                       type: string
   *                       example: billbot_sess_abc123...
   *                     user:
   *                       type: object
   *                       properties:
   *                         id: { type: string }
   *                         name: { type: string }
   *                         email: { type: string }
   *                         avatar_url: { type: string, nullable: true }
   *                         created_at: { type: string, format: date-time }
   *                     isNewUser:
   *                       type: boolean
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  @Post('/google', { validate: GoogleAuthSchema })
  async googleSignIn(req: Request) {
    const payload = req.body as GoogleAuthDTO;
    const result = await this.authService.googleSignIn(payload);
    return { success: true, data: result };
  }

  /**
   * @swagger
   * /auth/apple:
   *   post:
   *     tags: [Auth]
   *     summary: Sign in with Apple
   *     description: Verifies Apple identity token and returns a session token. fullName and email are only sent on first login.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [identityToken]
   *             properties:
   *               identityToken:
   *                 type: string
   *               fullName:
   *                 type: object
   *                 nullable: true
   *                 properties:
   *                   givenName: { type: string, nullable: true }
   *                   familyName: { type: string, nullable: true }
   *               email:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       '200':
   *         description: Authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 data:
   *                   type: object
   *                   properties:
   *                     token: { type: string, example: billbot_sess_abc123 }
   *                     user:
   *                       type: object
   *                       properties:
   *                         id: { type: string }
   *                         name: { type: string }
   *                         email: { type: string, nullable: true }
   *                         avatar_url: { type: string, nullable: true }
   *                         created_at: { type: string, format: date-time }
   *                     isNewUser: { type: boolean }
   *       '400':
   *         $ref: '#/components/responses/BadRequest'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  @Post('/apple', { validate: AppleAuthSchema })
  async appleSignIn(req: Request) {
    const payload = req.body as AppleAuthDTO;
    const result = await this.authService.appleSignIn(payload);
    return { success: true, data: result };
  }

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     tags: [Auth]
   *     summary: Logout
   *     description: Deletes the current session token
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Logged out
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message: { type: string, example: Logged out successfully. }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Post('/logout')
  async logout(req: Request) {
    const token = (req as unknown as IAuthenticatedRequest).user?.sessionToken || '';
    return this.authService.logout(token);
  }

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     tags: [Auth]
   *     summary: Get current user
   *     description: Returns the authenticated user's profile
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Current user profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 data:
   *                   type: object
   *                   properties:
   *                     id: { type: string }
   *                     name: { type: string }
   *                     email: { type: string, nullable: true }
   *                     avatar_url: { type: string, nullable: true }
   *                     created_at: { type: string, format: date-time }
   *       '401':
   *         $ref: '#/components/responses/Unauthorized'
   */
  @Get('/me')
  async me(req: Request) {
    const userId = (req as unknown as IAuthenticatedRequest).user?.id as string;
    const user = await this.userRepository.findById(userId);
    return { success: true, data: user };
  }
}

export default AuthController;
