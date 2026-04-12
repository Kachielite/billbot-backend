import { inject, injectable } from 'tsyringe';
import { and, desc, eq } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { NotificationSchema } from './notifications.schema';
import { INotification, ICreateNotification } from './notifications.interface';

export interface INotificationRepository {
  create(data: ICreateNotification): Promise<INotification>;
  findByUser(userId: string, limit: number, offset: number): Promise<INotification[]>;
  countByUser(userId: string): Promise<number>;
  countUnreadByUser(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

@injectable()
class NotificationRepositoryImpl implements INotificationRepository {
  constructor(@inject(Database) private db: Database) {}

  async create(data: ICreateNotification): Promise<INotification> {
    const [row] = await this.db.client
      .insert(NotificationSchema)
      .values({
        id: data.id,
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        metadata: data.metadata ?? {},
      })
      .returning();
    return row as unknown as INotification;
  }

  async findByUser(userId: string, limit: number, offset: number): Promise<INotification[]> {
    const rows = await this.db.client
      .select()
      .from(NotificationSchema)
      .where(eq(NotificationSchema.userId, userId))
      .orderBy(desc(NotificationSchema.createdAt))
      .limit(limit)
      .offset(offset);
    return rows as unknown as INotification[];
  }

  async countByUser(userId: string): Promise<number> {
    const rows = await this.db.client
      .select()
      .from(NotificationSchema)
      .where(eq(NotificationSchema.userId, userId));
    return rows.length;
  }

  async countUnreadByUser(userId: string): Promise<number> {
    const rows = await this.db.client
      .select()
      .from(NotificationSchema)
      .where(and(eq(NotificationSchema.userId, userId), eq(NotificationSchema.isRead, false)));
    return rows.length;
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.db.client
      .update(NotificationSchema)
      .set({ isRead: true })
      .where(and(eq(NotificationSchema.id, id), eq(NotificationSchema.userId, userId)));
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db.client
      .update(NotificationSchema)
      .set({ isRead: true })
      .where(and(eq(NotificationSchema.userId, userId), eq(NotificationSchema.isRead, false)));
  }
}

export default NotificationRepositoryImpl;
