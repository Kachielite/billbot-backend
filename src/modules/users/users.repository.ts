import { inject, injectable } from 'tsyringe';
import { eq, inArray } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { UserSchema } from './users.schema';
import { IUser, ICreateUser, IUpdateUser } from './users.interface';

export interface IUserRepository {
  create(data: ICreateUser): Promise<IUser>;
  findById(id: string): Promise<IUser | null>;
  findByIds(ids: string[]): Promise<IUser[]>;
  findByEmail(email: string): Promise<IUser | null>;
  findByPhone(phone: string): Promise<IUser | null>;
  findByGoogleId(googleId: string): Promise<IUser | null>;
  findByAppleId(appleId: string): Promise<IUser | null>;
  update(id: string, data: IUpdateUser): Promise<IUser>;
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
    if (data.googleId !== undefined) updateData.googleId = data.googleId;
    if (data.appleId !== undefined) updateData.appleId = data.appleId;

    const [row] = await this.db.client
      .update(UserSchema)
      .set(updateData)
      .where(eq(UserSchema.id, id))
      .returning();
    return row as unknown as IUser;
  }
}

export default UserRepositoryImpl;
