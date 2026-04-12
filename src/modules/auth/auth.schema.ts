import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';

export const SessionSchema = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => UserSchema.id, { onDelete: 'cascade' })
    .notNull(),
  token: varchar('token', { length: 128 }).unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
