import { inject, injectable } from 'tsyringe';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { ActivitySchema } from './activities.schema';
import { ExpensePoolSchema, PoolMemberSchema } from '@/modules/pools/pools.schema';
import { UserSchema } from '@/modules/users/users.schema';
import { IActivityEnriched } from './activities.interface';

export interface IActivityRepository {
  create(data: {
    id: string;
    actorId: string | null;
    poolId: string;
    type: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  findForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ activities: IActivityEnriched[]; total: number }>;
}

@injectable()
class ActivityRepositoryImpl implements IActivityRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: {
    id: string;
    actorId: string | null;
    poolId: string;
    type: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.db.client.insert(ActivitySchema).values(data);
  }

  async findForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ activities: IActivityEnriched[]; total: number }> {
    // Resolve the user's current pool memberships first to avoid duplicate rows
    const poolRows = await this.db.client
      .select({ poolId: PoolMemberSchema.poolId })
      .from(PoolMemberSchema)
      .where(eq(PoolMemberSchema.userId, userId));

    const poolIds = poolRows.map((r) => r.poolId);
    if (poolIds.length === 0) return { activities: [], total: 0 };

    const [countRow] = await this.db.client
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(ActivitySchema)
      .where(inArray(ActivitySchema.poolId, poolIds));

    const rows = await this.db.client
      .select({
        id: ActivitySchema.id,
        type: ActivitySchema.type,
        metadata: ActivitySchema.metadata,
        createdAt: ActivitySchema.createdAt,
        actorId: ActivitySchema.actorId,
        actorName: UserSchema.name,
        actorAvatarUrl: UserSchema.avatarUrl,
        poolId: ActivitySchema.poolId,
        poolName: ExpensePoolSchema.name,
      })
      .from(ActivitySchema)
      .leftJoin(UserSchema, eq(UserSchema.id, ActivitySchema.actorId))
      .leftJoin(ExpensePoolSchema, eq(ExpensePoolSchema.id, ActivitySchema.poolId))
      .where(inArray(ActivitySchema.poolId, poolIds))
      .orderBy(desc(ActivitySchema.createdAt))
      .limit(limit)
      .offset(offset);

    const activities: IActivityEnriched[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      actor: r.actorId
        ? { id: r.actorId, name: r.actorName ?? '', avatar_url: r.actorAvatarUrl ?? null }
        : null,
      pool: r.poolId && r.poolName ? { id: r.poolId, name: r.poolName } : null,
      metadata: r.metadata as Record<string, unknown> | null,
      created_at: r.createdAt,
    }));

    return { activities, total: countRow?.total ?? 0 };
  }
}

export default ActivityRepositoryImpl;
