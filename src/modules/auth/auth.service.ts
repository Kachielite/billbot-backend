import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { IAuthRepository } from './auth.repository';
import { IUserRepository } from '@/modules/users/users.repository';
import { IAuthResult, IGoogleAuthPayload, IAppleAuthPayload } from './auth.interface';
import { CONSTANTS } from '@/common/configuration/constants';
import {
  BadRequestException,
  InternalServerException,
  UnAuthorizedException,
} from '@/common/exception';
import logger from '@/common/lib/logger';
import { generateToken } from '@/common/utils/otp-generator';

const googleClient = new OAuth2Client(CONSTANTS.GOOGLE_CLIENT_ID);

// Session expires in 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface IAuthService {
  googleSignIn(payload: IGoogleAuthPayload): Promise<IAuthResult>;
  appleSignIn(payload: IAppleAuthPayload): Promise<IAuthResult>;
  logout(token: string): Promise<{ message: string }>;
}

@injectable()
class AuthService implements IAuthService {
  constructor(
    @inject('IAuthRepository') private authRepository: IAuthRepository,
    @inject('IUserRepository') private userRepository: IUserRepository,
  ) {}

  async googleSignIn(payload: IGoogleAuthPayload): Promise<IAuthResult> {
    try {
      // Verify with Google
      const ticket = await googleClient.verifyIdToken({
        idToken: payload.idToken,
        audience: CONSTANTS.GOOGLE_CLIENT_ID,
      });

      const googlePayload = ticket.getPayload();
      if (!googlePayload) throw new BadRequestException('Invalid Google ID token.');

      const { sub: googleId, email, name, picture } = googlePayload;
      if (!email) throw new BadRequestException('Google account has no email.');

      // Find or create user
      let user = await this.userRepository.findByEmail(email);
      let isNewUser = false;

      if (user) {
        // Link google ID if not yet linked
        if (!user.googleId) {
          user = await this.userRepository.update(user.id, { googleId });
        }
      } else {
        user = await this.userRepository.create({
          id: uuidv4(),
          name: name || 'BillBot User',
          email,
          avatarUrl: picture || null,
          googleId,
        });
        isNewUser = true;
      }

      const session = await this.createSession(user.id);

      return {
        token: session.token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
          avatar_url: user.avatarUrl ?? null,
          created_at: user.createdAt,
        },
        isNewUser,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnAuthorizedException)
        throw error;
      logger.error(`Google sign-in error: ${error}`);
      throw new InternalServerException('Google sign-in failed.');
    }
  }

  async appleSignIn(payload: IAppleAuthPayload): Promise<IAuthResult> {
    try {
      // Verify Apple identity token
      const applePayload = await appleSignin.verifyIdToken(payload.identityToken, {
        audience: CONSTANTS.APPLE_BUNDLE_ID,
        ignoreExpiration: false,
      });

      const appleId = applePayload.sub;
      const email = payload.email || applePayload.email || null;

      // Build name from fullName (only on first login)
      let name = 'BillBot User';
      if (payload.fullName) {
        const { givenName, familyName } = payload.fullName;
        const parts = [givenName, familyName].filter(Boolean);
        if (parts.length > 0) name = parts.join(' ');
      }

      // Find by apple_id first, then by email
      let user = await this.userRepository.findByAppleId(appleId);
      let isNewUser = false;

      if (!user && email) {
        user = await this.userRepository.findByEmail(email);
        if (user && !user.appleId) {
          // Link apple ID to existing account
          user = await this.userRepository.update(user.id, { appleId });
        }
      }

      if (!user) {
        user = await this.userRepository.create({
          id: uuidv4(),
          name,
          email: email || null,
          avatarUrl: null,
          appleId,
        });
        isNewUser = true;
      }

      const session = await this.createSession(user.id);

      return {
        token: session.token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email ?? null,
          avatar_url: user.avatarUrl ?? null,
          created_at: user.createdAt,
        },
        isNewUser,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      logger.error(`Apple sign-in error: ${error}`);
      throw new InternalServerException('Apple sign-in failed.');
    }
  }

  async logout(token: string): Promise<{ message: string }> {
    try {
      // token passed here is the raw bearer; hash before DB lookup
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await this.authRepository.deleteSessionByToken(tokenHash);
      return { message: 'Logged out successfully.' };
    } catch (error) {
      logger.error(`Logout error: ${error}`);
      throw new InternalServerException('Logout failed.');
    }
  }

  private async createSession(userId: string): Promise<{ token: string }> {
    const rawToken = `billbot_sess_${generateToken(32)}`;
    // Only the SHA-256 hash is persisted; the raw token is returned once to the caller.
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.authRepository.createSession({
      id: uuidv4(),
      userId,
      token: tokenHash,
      expiresAt,
    });
    return { token: rawToken };
  }
}

export default AuthService;
