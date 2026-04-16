import { jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';
import { ExpensePoolSchema } from '@/modules/pools/pools.schema';

export const ActivitySchema = pgTable('activities', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => UserSchema.id, { onDelete: 'set null' }),
  poolId: text('pool_id').references(() => ExpensePoolSchema.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
