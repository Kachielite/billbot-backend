import { inject, injectable } from 'tsyringe';
import { and, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { UserSchema } from './users.schema';
import { IUser, ICreateUser, IUpdateUser } from './users.interface';
import { GroupMemberSchema } from '@/modules/groups/groups.schema';
import { PoolMemberSchema } from '@/modules/pools/pools.schema';
import { SettlementSchema } from '@/modules/settlements/settlements.schema';

export interface IUserRepository {
  create(data: ICreateUser): Promise<IUser>;
  findById(id: string): Promise<IUser | null>;
  findByIds(ids: string[]): Promise<IUser[]>;
  findByEmail(email: string): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  findByGoogleId(googleId: string): Promise<IUser | null>;
  findByAppleId(appleId: string): Promise<IUser | null>;
  update(id: string, data: IUpdateUser): Promise<IUser>;
  searchRelatedUsers(userId: string, query: string): Promise<IUser[]>;
}

@injectable()
class UserRepositoryImpl implements IUserRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: ICreateUser): Promise<IUser> {
    const [row] = await this.db.client
      .insert(UserSchema)
      .values({
        id: data.id,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        avatarUrl: data.avatarUrl ?? null,
        googleId: data.googleId ?? null,
        appleId: data.appleId ?? null,
      })
      .returning();
    return row as unknown as IUser;
  }

  async findById(id: string): Promise<IUser | null> {
    const rows = await this.db.client
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.id, id))
      .limit(1);
    return (rows[0] as unknown as IUser) ?? null;
  }

  async findByIds(ids: string[]): Promise<IUser[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.client.select().from(UserSchema).where(inArray(UserSchema.id, ids));
    return rows as unknown as IUser[];
  }

  async findByEmail(email: string): Promise<IUser | null> {
    const rows = await this.db.client
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.email, email))
      .limit(1);
    return (rows[0] as unknown as IUser) ?? null;
  }

  async findByPhone(phone: string): Promise<IUser | null> {
    const rows = await this.db.client
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.phone, phone))
      .limit(1);
    return (rows[0] as unknown as IUser) ?? null;
  }

  async findByGoogleId(googleId: string): Promise<IUser | null> {
    const rows = await this.db.client
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.googleId, googleId))
      .limit(1);
    return (rows[0] as unknown as IUser) ?? null;
  }

  async findByAppleId(appleId: string): Promise<IUser | null> {
    const rows = await this.db.client
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.appleId, appleId))
      .limit(1);
    return (rows[0] as unknown as IUser) ?? null;
  }

  async update(id: string, data: IUpdateUser): Promise<IUser> {
    const updateData: Partial<typeof UserSchema.$inferInsert> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.googleId !== undefined) updateData.googleId = data.googleId;
    if (data.appleId !== undefined) updateData.appleId = data.appleId;

    const [row] = await this.db.client
      .update(UserSchema)
      .set(updateData)
      .where(eq(UserSchema.id, id))
      .returning();
    return row as unknown as IUser;
  }

  async searchRelatedUsers(userId: string, query: string): Promise<IUser[]> {
    // Collect group co-members
    const userGroups = await this.db.client
      .selectDistinct({ groupId: GroupMemberSchema.groupId })
      .from(GroupMemberSchema)
      .where(eq(GroupMemberSchema.userId, userId));

    const groupIds = userGroups.map((r) => r.groupId);
    let groupMateIds: string[] = [];
    if (groupIds.length > 0) {
      const rows = await this.db.client
        .selectDistinct({ userId: GroupMemberSchema.userId })
        .from(GroupMemberSchema)
        .where(
          and(inArray(GroupMemberSchema.groupId, groupIds), ne(GroupMemberSchema.userId, userId)),
        );
      groupMateIds = rows.map((r) => r.userId);
    }

    // Collect pool co-members
    const userPools = await this.db.client
      .selectDistinct({ poolId: PoolMemberSchema.poolId })
      .from(PoolMemberSchema)
      .where(eq(PoolMemberSchema.userId, userId));

    const poolIds = userPools.map((r) => r.poolId);
    let poolMateIds: string[] = [];
    if (poolIds.length > 0) {
      const rows = await this.db.client
        .selectDistinct({ userId: PoolMemberSchema.userId })
        .from(PoolMemberSchema)
        .where(and(inArray(PoolMemberSchema.poolId, poolIds), ne(PoolMemberSchema.userId, userId)));
      poolMateIds = rows.map((r) => r.userId);
    }

    // Collect settlement counterparties
    const sent = await this.db.client
      .selectDistinct({ userId: SettlementSchema.toUser })
      .from(SettlementSchema)
      .where(eq(SettlementSchema.fromUser, userId));

    const received = await this.db.client
      .selectDistinct({ userId: SettlementSchema.fromUser })
      .from(SettlementSchema)
      .where(eq(SettlementSchema.toUser, userId));

    const settlementIds = [...sent.map((r) => r.userId), ...received.map((r) => r.userId)].filter(
      Boolean,
    ) as string[];

    const relatedIds = [...new Set([...groupMateIds, ...poolMateIds, ...settlementIds])];
    if (relatedIds.length === 0) return [];

    const searchTerm = `%${query}%`;
    const users = await this.db.client
      .select()
      .from(UserSchema)
      .where(
        and(
          inArray(UserSchema.id, relatedIds),
          or(ilike(UserSchema.name, searchTerm), ilike(UserSchema.email, searchTerm)),
        ),
      )
      .limit(20);

    return users as unknown as IUser[];
  }
}

export default UserRepositoryImpl;
