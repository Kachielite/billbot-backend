import { inject, injectable } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { InviteSchema } from './invites.schema';
import { IInvite } from './invites.interface';

export interface IInviteRepository {
  create(data: {
    id: string;
    groupId: string;
    invitedBy: string;
    phone?: string | null;
    email?: string | null;
    token: string;
    code: string;
    expiresAt: Date;
  }): Promise<IInvite>;
  findByToken(token: string): Promise<IInvite | null>;
  findByCode(code: string): Promise<IInvite | null>;
  findPendingByGroup(groupId: string): Promise<IInvite[]>;
  updateStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<void>;
}

@injectable()
class InviteRepositoryImpl implements IInviteRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: {
    id: string;
    groupId: string;
    invitedBy: string;
    phone?: string | null;
    email?: string | null;
    token: string;
    code: string;
    expiresAt: Date;
  }): Promise<IInvite> {
    const [row] = await this.db.client.insert(InviteSchema).values(data).returning();
    return row as unknown as IInvite;
  }

  async findByToken(token: string): Promise<IInvite | null> {
    const rows = await this.db.client
      .select()
      .from(InviteSchema)
      .where(eq(InviteSchema.token, token))
      .limit(1);
    return (rows[0] as unknown as IInvite) ?? null;
  }

  async findByCode(code: string): Promise<IInvite | null> {
    const rows = await this.db.client
      .select()
      .from(InviteSchema)
      .where(eq(InviteSchema.code, code.toUpperCase()))
      .limit(1);
    return (rows[0] as unknown as IInvite) ?? null;
  }

  async findPendingByGroup(groupId: string): Promise<IInvite[]> {
    const rows = await this.db.client
      .select()
      .from(InviteSchema)
      .where(and(eq(InviteSchema.groupId, groupId), eq(InviteSchema.status, 'pending')));
    return rows as unknown as IInvite[];
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.client.update(InviteSchema).set({ status }).where(eq(InviteSchema.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.client.delete(InviteSchema).where(eq(InviteSchema.id, id));
  }
}

export default InviteRepositoryImpl;
