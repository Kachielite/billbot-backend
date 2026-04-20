import { inject, injectable } from 'tsyringe';
import { eq, and, count, sql, inArray } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { GroupSchema, GroupMemberSchema } from './groups.schema';
import { UserSchema } from '@/modules/users/users.schema';
import {
  IGroup,
  IGroupMember,
  ICreateGroup,
  IGroupDetail,
  IGroupWithMemberCount,
} from './groups.interface';

export interface IGroupRepository {
  create(data: ICreateGroup): Promise<IGroup>;
  update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      emoji: string | null;
      color: string | null;
    }>,
  ): Promise<IGroup>;
  findById(id: string): Promise<IGroup | null>;
  findByIdWithDetail(id: string): Promise<IGroupDetail | null>;
  findByInviteCode(code: string): Promise<IGroup | null>;
  findAllForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ groups: IGroupWithMemberCount[]; total: number }>;
  delete(id: string): Promise<void>;
  addMember(groupId: string, userId: string, role?: string): Promise<IGroupMember>;
  removeMember(groupId: string, userId: string): Promise<void>;
  getMember(groupId: string, userId: string): Promise<IGroupMember | null>;
  updateMemberRole(groupId: string, userId: string, role: string): Promise<IGroupMember>;
  getAdminCount(groupId: string): Promise<number>;
  getMembersForGroups(groupIds: string[]): Promise<Map<string, IGroupDetail['members']>>;
}

@injectable()
class GroupRepositoryImpl implements IGroupRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: ICreateGroup): Promise<IGroup> {
    const [row] = await this.db.client.insert(GroupSchema).values(data).returning();
    return row as unknown as IGroup;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      emoji: string | null;
      color: string | null;
    }>,
  ): Promise<IGroup> {
    const [row] = await this.db.client
      .update(GroupSchema)
      .set(data)
      .where(eq(GroupSchema.id, id))
      .returning();
    return row as unknown as IGroup;
  }

  async findById(id: string): Promise<IGroup | null> {
    const rows = await this.db.client
      .select()
      .from(GroupSchema)
      .where(eq(GroupSchema.id, id))
      .limit(1);
    return (rows[0] as unknown as IGroup) ?? null;
  }

  async findByIdWithDetail(id: string): Promise<IGroupDetail | null> {
    const groupRows = await this.db.client
      .select()
      .from(GroupSchema)
      .where(eq(GroupSchema.id, id))
      .limit(1);

    if (!groupRows.length) return null;
    const group = groupRows[0] as unknown as IGroup;

    const members = await this.db.client
      .select({
        user_id: GroupMemberSchema.userId,
        name: UserSchema.name,
        email: UserSchema.email,
        avatar_url: UserSchema.avatarUrl,
        role: GroupMemberSchema.role,
        joined_at: GroupMemberSchema.joinedAt,
      })
      .from(GroupMemberSchema)
      .innerJoin(UserSchema, eq(GroupMemberSchema.userId, UserSchema.id))
      .where(eq(GroupMemberSchema.groupId, id));

    return { ...group, members: members as IGroupDetail['members'] };
  }

  async findByInviteCode(code: string): Promise<IGroup | null> {
    const rows = await this.db.client
      .select()
      .from(GroupSchema)
      .where(eq(GroupSchema.inviteCode, code))
      .limit(1);
    return (rows[0] as unknown as IGroup) ?? null;
  }

  async findAllForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ groups: IGroupWithMemberCount[]; total: number }> {
    const [countRow] = await this.db.client
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(GroupMemberSchema)
      .where(eq(GroupMemberSchema.userId, userId));

    const memberCountSq = this.db.client
      .select({
        groupId: GroupMemberSchema.groupId,
        memberCount: count().as('member_count'),
      })
      .from(GroupMemberSchema)
      .groupBy(GroupMemberSchema.groupId)
      .as('mc');

    const rows = await this.db.client
      .select({ group: GroupSchema, memberCount: memberCountSq.memberCount })
      .from(GroupMemberSchema)
      .innerJoin(GroupSchema, eq(GroupMemberSchema.groupId, GroupSchema.id))
      .leftJoin(memberCountSq, eq(memberCountSq.groupId, GroupSchema.id))
      .where(eq(GroupMemberSchema.userId, userId))
      .orderBy(GroupSchema.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      groups: rows.map((r) => ({
        ...(r.group as unknown as IGroup),
        memberCount: r.memberCount ?? 0,
      })),
      total: countRow?.total ?? 0,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.client.delete(GroupSchema).where(eq(GroupSchema.id, id));
  }

  async addMember(groupId: string, userId: string, role = 'member'): Promise<IGroupMember> {
    const [row] = await this.db.client
      .insert(GroupMemberSchema)
      .values({ groupId, userId, role })
      .returning();
    return row as unknown as IGroupMember;
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.db.client
      .delete(GroupMemberSchema)
      .where(and(eq(GroupMemberSchema.groupId, groupId), eq(GroupMemberSchema.userId, userId)));
  }

  async getMember(groupId: string, userId: string): Promise<IGroupMember | null> {
    const rows = await this.db.client
      .select()
      .from(GroupMemberSchema)
      .where(and(eq(GroupMemberSchema.groupId, groupId), eq(GroupMemberSchema.userId, userId)))
      .limit(1);
    return (rows[0] as unknown as IGroupMember) ?? null;
  }

  async updateMemberRole(groupId: string, userId: string, role: string): Promise<IGroupMember> {
    const [row] = await this.db.client
      .update(GroupMemberSchema)
      .set({ role })
      .where(and(eq(GroupMemberSchema.groupId, groupId), eq(GroupMemberSchema.userId, userId)))
      .returning();
    return row as unknown as IGroupMember;
  }

  async getAdminCount(groupId: string): Promise<number> {
    const rows = await this.db.client
      .select()
      .from(GroupMemberSchema)
      .where(and(eq(GroupMemberSchema.groupId, groupId), eq(GroupMemberSchema.role, 'admin')));
    return rows.length;
  }

  async getMembersForGroups(groupIds: string[]): Promise<Map<string, IGroupDetail['members']>> {
    if (groupIds.length === 0) return new Map();

    const rows = await this.db.client
      .select({
        groupId: GroupMemberSchema.groupId,
        user_id: GroupMemberSchema.userId,
        name: UserSchema.name,
        email: UserSchema.email,
        avatar_url: UserSchema.avatarUrl,
        role: GroupMemberSchema.role,
        joined_at: GroupMemberSchema.joinedAt,
      })
      .from(GroupMemberSchema)
      .innerJoin(UserSchema, eq(GroupMemberSchema.userId, UserSchema.id))
      .where(inArray(GroupMemberSchema.groupId, groupIds));

    const map = new Map<string, IGroupDetail['members']>();
    for (const { groupId, ...member } of rows) {
      if (!map.has(groupId)) map.set(groupId, []);
      map.get(groupId)!.push(member as IGroupDetail['members'][number]);
    }
    return map;
  }
}

export default GroupRepositoryImpl;
