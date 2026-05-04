import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { UserSchema } from '@/modules/users/users.schema';

export const DeviceTokenSchema = pgTable('device_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => UserSchema.id, { onDelete: 'cascade' })
    .notNull(),
  playerId: text('player_id').notNull().unique(),
  platform: varchar('platform', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
