import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { GroupSchema } from '@/modules/groups/groups.schema';
import { UserSchema } from '@/modules/users/users.schema';

export const ExpensePoolSchema = pgTable('expense_pools', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .references(() => GroupSchema.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  splitType: varchar('split_type', { length: 20 }).default('equal').notNull(),
  createdBy: text('created_by').references(() => UserSchema.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const PoolMemberSchema = pgTable('pool_members', {
  poolId: text('pool_id')
    .references(() => ExpensePoolSchema.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => UserSchema.id, { onDelete: 'cascade' })
    .notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});
