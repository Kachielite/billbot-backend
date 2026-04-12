import { inject, injectable } from 'tsyringe';
import { eq, and } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ExpensePoolSchema, PoolMemberSchema } from './pools.schema';
import { UserSchema } from '@/modules/users/users.schema';
import { IPool, IPoolMember } from './pools.interface';

export interface IPoolRepository {
  create(data: {
    id: string;
    groupId: string;
    name: string;
    description?: string | null;
    createdBy: string;
  }): Promise<IPool>;
  findById(id: string): Promise<IPool | null>;
  findByGroup(groupId: string): Promise<IPool[]>;
  update(
    id: string,
    data: Partial<{ name: string; description: string | null; status: string }>,
  ): Promise<IPool>;
  addMember(poolId: string, userId: string): Promise<IPoolMember>;
  removeMember(poolId: string, userId: string): Promise<void>;
  getMembers(
    poolId: string,
  ): Promise<
    Array<{
      userId: string;
      name: string;
      email: string | null;
      avatarUrl: string | null;
      joinedAt: Date;
    }>
  >;
  getMember(poolId: string, userId: string): Promise<IPoolMember | null>;
}

@injectable()
class PoolRepositoryImpl implements IPoolRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: {
    id: string;
    groupId: string;
    name: string;
    description?: string | null;
    createdBy: string;
  }): Promise<IPool> {
    const [row] = await this.db.client.insert(ExpensePoolSchema).values(data).returning();
    return row as unknown as IPool;
  }

  async findById(id: string): Promise<IPool | null> {
    const rows = await this.db.client
      .select()
      .from(ExpensePoolSchema)
      .where(eq(ExpensePoolSchema.id, id))
      .limit(1);
    return (rows[0] as unknown as IPool) ?? null;
  }

  async findByGroup(groupId: string): Promise<IPool[]> {
    const rows = await this.db.client
      .select()
      .from(ExpensePoolSchema)
      .where(eq(ExpensePoolSchema.groupId, groupId));
    return rows as unknown as IPool[];
  }

  async update(
    id: string,
    data: Partial<{ name: string; description: string | null; status: string }>,
  ): Promise<IPool> {
    const updateData: Partial<typeof ExpensePoolSchema.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;

    const [row] = await this.db.client
      .update(ExpensePoolSchema)
      .set(updateData)
      .where(eq(ExpensePoolSchema.id, id))
      .returning();
    return row as unknown as IPool;
  }

  async addMember(poolId: string, userId: string): Promise<IPoolMember> {
    const [row] = await this.db.client
      .insert(PoolMemberSchema)
      .values({ poolId, userId })
      .returning();
    return row as unknown as IPoolMember;
  }

  async removeMember(poolId: string, userId: string): Promise<void> {
    await this.db.client
      .delete(PoolMemberSchema)
      .where(and(eq(PoolMemberSchema.poolId, poolId), eq(PoolMemberSchema.userId, userId)));
  }

  async getMembers(
    poolId: string,
  ): Promise<
    Array<{
      userId: string;
      name: string;
      email: string | null;
      avatarUrl: string | null;
      joinedAt: Date;
    }>
  > {
    const rows = await this.db.client
      .select({
        userId: PoolMemberSchema.userId,
        name: UserSchema.name,
        email: UserSchema.email,
        avatarUrl: UserSchema.avatarUrl,
        joinedAt: PoolMemberSchema.joinedAt,
      })
      .from(PoolMemberSchema)
      .innerJoin(UserSchema, eq(PoolMemberSchema.userId, UserSchema.id))
      .where(eq(PoolMemberSchema.poolId, poolId));
    return rows as unknown as Array<{
      userId: string;
      name: string;
      email: string | null;
      avatarUrl: string | null;
      joinedAt: Date;
    }>;
  }

  async getMember(poolId: string, userId: string): Promise<IPoolMember | null> {
    const rows = await this.db.client
      .select()
      .from(PoolMemberSchema)
      .where(and(eq(PoolMemberSchema.poolId, poolId), eq(PoolMemberSchema.userId, userId)))
      .limit(1);
    return (rows[0] as unknown as IPoolMember) ?? null;
  }
}

export default PoolRepositoryImpl;
