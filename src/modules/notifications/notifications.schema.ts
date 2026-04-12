import { pgTable, text, timestamp, varchar, boolean, jsonb } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';

export const NotificationSchema = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => UserSchema.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  metadata: jsonb('metadata')
    .$defaultFn(() => ({}))
    .notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
