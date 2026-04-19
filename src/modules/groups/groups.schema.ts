import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';

export const GroupSchema = pgTable('groups', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  emoji: varchar('emoji', { length: 10 }),
  color: varchar('color', { length: 7 }),
  inviteCode: varchar('invite_code', { length: 12 }).unique().notNull(),
  createdBy: text('created_by').references(() => UserSchema.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const GroupMemberSchema = pgTable('group_members', {
  groupId: text('group_id')
    .references(() => GroupSchema.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => UserSchema.id, { onDelete: 'cascade' })
    .notNull(),
  role: varchar('role', { length: 20 }).default('member').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});
