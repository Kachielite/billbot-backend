import { inject, injectable } from 'tsyringe';
import { eq } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { SessionSchema } from './auth.schema';
import { ISession } from './auth.interface';

export interface IAuthRepository {
  createSession(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<ISession>;
  deleteSessionByToken(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}

@injectable()
class AuthRepositoryImpl implements IAuthRepository {
  constructor(@inject(Database) private db: Database) {}

  async createSession(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<ISession> {
    const [row] = await this.db.client.insert(SessionSchema).values(data).returning();
    return row as unknown as ISession;
  }

  async deleteSessionByToken(token: string): Promise<void> {
    await this.db.client.delete(SessionSchema).where(eq(SessionSchema.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db.client.delete(SessionSchema).where(eq(SessionSchema.expiresAt, new Date()));
  }
}

export default AuthRepositoryImpl;
