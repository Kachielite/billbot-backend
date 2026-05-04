import { inject, injectable } from 'tsyringe';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { NotificationSchema } from './notifications.schema';
import { DeviceTokenSchema } from './device-tokens.schema';
import { NotificationPreferencesSchema } from './notification-preferences.schema';
import { ReminderLogSchema } from './reminder-logs.schema';
import {
  INotification,
  ICreateNotification,
  IDeviceToken,
  INotificationPreferences,
  IUpdateNotificationPreferences,
} from './notifications.interface';

export interface INotificationRepository {
  create(data: ICreateNotification): Promise<INotification>;
  findByUser(userId: string, limit: number, offset: number): Promise<INotification[]>;
  countByUser(userId: string): Promise<number>;
  countUnreadByUser(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  markReadByMeta(userId: string, type: string, meta: Record<string, unknown>): Promise<void>;
  // Device tokens
  upsertDeviceToken(id: string, userId: string, playerId: string, platform?: string): Promise<void>;
  findTokensByUser(userId: string): Promise<IDeviceToken[]>;
  removeDeviceToken(userId: string, playerId: string): Promise<void>;
  // Preferences
  findPreferences(userId: string): Promise<INotificationPreferences | null>;
  upsertPreferences(
    userId: string,
    data: IUpdateNotificationPreferences,
  ): Promise<INotificationPreferences>;
  // Reminders
  findUsersEligibleForReminders(): Promise<{ userId: string; playerIds: string[] }[]>;
  hasReminderBeenSent(periodKey: string): Promise<boolean>;
  markReminderSent(periodKey: string): Promise<void>;
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

  async markReadByMeta(userId: string, type: string, meta: Record<string, unknown>): Promise<void> {
    await this.db.client
      .update(NotificationSchema)
      .set({ isRead: true })
      .where(
        and(
          eq(NotificationSchema.userId, userId),
          eq(NotificationSchema.type, type as never),
          eq(NotificationSchema.isRead, false),
          sql`${NotificationSchema.metadata} @> ${JSON.stringify(meta)}::jsonb`,
        ),
      );
  }

  async upsertDeviceToken(
    id: string,
    userId: string,
    playerId: string,
    platform?: string,
  ): Promise<void> {
    await this.db.client
      .insert(DeviceTokenSchema)
      .values({ id, userId, playerId, platform: platform ?? null })
      .onConflictDoUpdate({
        target: DeviceTokenSchema.playerId,
        set: { userId, platform: platform ?? null },
      });
  }

  async findTokensByUser(userId: string): Promise<IDeviceToken[]> {
    const rows = await this.db.client
      .select()
      .from(DeviceTokenSchema)
      .where(eq(DeviceTokenSchema.userId, userId));
    return rows as unknown as IDeviceToken[];
  }

  async removeDeviceToken(userId: string, playerId: string): Promise<void> {
    await this.db.client
      .delete(DeviceTokenSchema)
      .where(and(eq(DeviceTokenSchema.userId, userId), eq(DeviceTokenSchema.playerId, playerId)));
  }

  async findPreferences(userId: string): Promise<INotificationPreferences | null> {
    const [row] = await this.db.client
      .select()
      .from(NotificationPreferencesSchema)
      .where(eq(NotificationPreferencesSchema.userId, userId));
    if (!row) return null;
    return this.mapPreferences(row);
  }

  async upsertPreferences(
    userId: string,
    data: IUpdateNotificationPreferences,
  ): Promise<INotificationPreferences> {
    const [row] = await this.db.client
      .insert(NotificationPreferencesSchema)
      .values({
        userId,
        inviteReceived: data.invite_received ?? true,
        memberJoined: data.member_joined ?? true,
        expenseCreated: data.expense_created ?? true,
        settlementSubmitted: data.settlement_submitted ?? true,
        settlementConfirmed: data.settlement_confirmed ?? true,
        settlementDisputed: data.settlement_disputed ?? true,
        general: data.general ?? true,
      })
      .onConflictDoUpdate({
        target: NotificationPreferencesSchema.userId,
        set: {
          ...(data.invite_received !== undefined && { inviteReceived: data.invite_received }),
          ...(data.member_joined !== undefined && { memberJoined: data.member_joined }),
          ...(data.expense_created !== undefined && { expenseCreated: data.expense_created }),
          ...(data.settlement_submitted !== undefined && {
            settlementSubmitted: data.settlement_submitted,
          }),
          ...(data.settlement_confirmed !== undefined && {
            settlementConfirmed: data.settlement_confirmed,
          }),
          ...(data.settlement_disputed !== undefined && {
            settlementDisputed: data.settlement_disputed,
          }),
          ...(data.general !== undefined && { general: data.general }),
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.mapPreferences(row);
  }

  async findUsersEligibleForReminders(): Promise<{ userId: string; playerIds: string[] }[]> {
    const rows = await this.db.client
      .select({
        userId: DeviceTokenSchema.userId,
        playerId: DeviceTokenSchema.playerId,
      })
      .from(DeviceTokenSchema)
      .leftJoin(
        NotificationPreferencesSchema,
        eq(NotificationPreferencesSchema.userId, DeviceTokenSchema.userId),
      )
      .where(
        or(
          isNull(NotificationPreferencesSchema.userId),
          eq(NotificationPreferencesSchema.general, true),
        ),
      );

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.userId) ?? [];
      list.push(row.playerId);
      map.set(row.userId, list);
    }
    return Array.from(map.entries()).map(([userId, playerIds]) => ({ userId, playerIds }));
  }

  async hasReminderBeenSent(periodKey: string): Promise<boolean> {
    const [row] = await this.db.client
      .select()
      .from(ReminderLogSchema)
      .where(eq(ReminderLogSchema.periodKey, periodKey))
      .limit(1);
    return !!row;
  }

  async markReminderSent(periodKey: string): Promise<void> {
    await this.db.client.insert(ReminderLogSchema).values({ periodKey }).onConflictDoNothing();
  }

  private mapPreferences(row: {
    userId: string;
    inviteReceived: boolean;
    memberJoined: boolean;
    expenseCreated: boolean;
    settlementSubmitted: boolean;
    settlementConfirmed: boolean;
    settlementDisputed: boolean;
    general: boolean;
  }): INotificationPreferences {
    return {
      userId: row.userId,
      invite_received: row.inviteReceived,
      member_joined: row.memberJoined,
      expense_created: row.expenseCreated,
      settlement_submitted: row.settlementSubmitted,
      settlement_confirmed: row.settlementConfirmed,
      settlement_disputed: row.settlementDisputed,
      general: row.general,
    };
  }
}

export default NotificationRepositoryImpl;
