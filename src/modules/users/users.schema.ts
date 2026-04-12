import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const UserSchema = pgTable('users', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }).unique(),
  avatarUrl: text('avatar_url'),
  googleId: varchar('google_id', { length: 100 }).unique(),
  appleId: varchar('apple_id', { length: 100 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
