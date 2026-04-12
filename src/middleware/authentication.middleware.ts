import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';
import crypto from 'crypto';
import Database from '@/common/lib/database';
import { UnAuthorizedException } from '@/common/exception';
import { IAuthenticatedRequest } from '@/common/types/interface';
import { SessionSchema } from '@/modules/auth/auth.schema';
import { UserSchema } from '@/modules/users/users.schema';
import { eq, and, gt } from 'drizzle-orm';

// Deny-by-default: all /v1 routes require auth unless explicitly listed here.
const PUBLIC_PATHS = ['/v1/auth/google', '/v1/auth/apple', '/api-docs', '/health'];

@injectable()
class AuthenticationMiddleware {
  constructor(@inject(Database) private db: Database) {}

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const fullPath = req.baseUrl + req.path;

    // Allow explicitly public paths (exact prefix match)
    if (PUBLIC_PATHS.some((p) => fullPath.startsWith(p))) {
      return next();
    }

    // All /v1/* routes require auth — skip non-versioned paths (static assets etc.)
    if (!fullPath.startsWith('/v1/')) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnAuthorizedException('Authorization header missing or malformed.'));
    }

    const rawToken = authHeader.substring(7);
    // Compare against the stored SHA-256 hash; plaintext is never persisted.
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    try {
      const rows = await this.db.client
        .select({
          userId: SessionSchema.userId,
          token: SessionSchema.token,
          expiresAt: SessionSchema.expiresAt,
        })
        .from(SessionSchema)
        .innerJoin(UserSchema, eq(SessionSchema.userId, UserSchema.id))
        .where(and(eq(SessionSchema.token, tokenHash), gt(SessionSchema.expiresAt, new Date())))
        .limit(1);

      if (!rows.length) {
        return next(new UnAuthorizedException('Invalid or expired session token.'));
      }

      (req as unknown as IAuthenticatedRequest).user = {
        id: rows[0].userId,
        sessionToken: rawToken,
      };

      next();
    } catch (err) {
      next(new UnAuthorizedException('Session validation failed.'));
    }
  };
}

export default AuthenticationMiddleware;
