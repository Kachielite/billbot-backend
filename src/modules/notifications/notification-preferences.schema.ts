import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';

export const NotificationPreferencesSchema = pgTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => UserSchema.id, { onDelete: 'cascade' }),
  inviteReceived: boolean('invite_received').default(true).notNull(),
  memberJoined: boolean('member_joined').default(true).notNull(),
  expenseCreated: boolean('expense_created').default(true).notNull(),
  settlementSubmitted: boolean('settlement_submitted').default(true).notNull(),
  settlementConfirmed: boolean('settlement_confirmed').default(true).notNull(),
  settlementDisputed: boolean('settlement_disputed').default(true).notNull(),
  general: boolean('general').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
