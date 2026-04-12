import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { GroupSchema } from '@/modules/groups/groups.schema';
import { UserSchema } from '@/modules/users/users.schema';

export const InviteSchema = pgTable('invites', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .references(() => GroupSchema.id, { onDelete: 'cascade' })
    .notNull(),
  invitedBy: text('invited_by').references(() => UserSchema.id),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  token: varchar('token', { length: 64 }).unique().notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
