import { integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { GroupSchema } from '@/modules/groups/groups.schema';
import { UserSchema } from '@/modules/users/users.schema';

export const WebhookSubscriptionSchema = pgTable('webhook_subscriptions', {
  id: text('id').primaryKey(),
  groupId: text('group_id')
    .references(() => GroupSchema.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  secret: varchar('secret', { length: 100 }).notNull(),
  events: text('events').array().notNull(),
  createdBy: text('created_by').references(() => UserSchema.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const WebhookDeliverySchema = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  subscriptionId: text('subscription_id')
    .references(() => WebhookSubscriptionSchema.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  responseCode: integer('response_code'),
  attempts: integer('attempts').default(0).notNull(),
  lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
