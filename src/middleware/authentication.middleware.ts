import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import Database from '@/common/lib/database';
import { UnAuthorizedException } from '@/common/exception';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { SessionSchema } from '@/modules/auth/auth.schema';
import { UserSchema } from '@/modules/users/users.schema';
import { eq, and, gt } from 'drizzle-orm';

// Prefixes that require authentication
const authPrefixes = [
  '/v1/users',
  '/v1/groups',
  '/v1/pools',
  '/v1/expenses',
  '/v1/balances',
  '/v1/settlements',
];

// Paths excluded from auth
const publicPaths = ['/v1/auth/google', '/v1/auth/apple', '/api-docs', '/health'];

@injectable()
class AuthenticationMiddleware {
  constructor(@inject(Database) private db: Database) {}

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const path = req.path;
    const fullPath = req.baseUrl + path;

    // Skip public paths
    if (publicPaths.some((p) => fullPath.startsWith(p))) {
      return next();
    }

    // Skip paths that don't require auth
    const requiresAuth = authPrefixes.some((p) => fullPath.startsWith(p));
    if (!requiresAuth) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnAuthorizedException('Authorization header missing or malformed.'));
    }

    const token = authHeader.substring(7);

    try {
      const rows = await this.db.client
        .select({
          userId: SessionSchema.userId,
          token: SessionSchema.token,
          expiresAt: SessionSchema.expiresAt,
        })
        .from(SessionSchema)
        .innerJoin(UserSchema, eq(SessionSchema.userId, UserSchema.id))
        .where(and(eq(SessionSchema.token, token), gt(SessionSchema.expiresAt, new Date())))
        .limit(1);

      if (!rows.length) {
        return next(new UnAuthorizedException('Invalid or expired session token.'));
      }

      (req as unknown as IAuthenticatedRequest).user = {
        id: rows[0].userId,
        sessionToken: rows[0].token,
      };

      next();
    } catch (err) {
      next(new UnAuthorizedException('Session validation failed.'));
    }
  };
}

export default AuthenticationMiddleware;
