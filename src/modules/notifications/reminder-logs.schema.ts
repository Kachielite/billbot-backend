import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const ReminderLogSchema = pgTable('reminder_logs', {
  periodKey: text('period_key').primaryKey(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
});
