import { numeric, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { ExpensePoolSchema } from '@/modules/pools/pools.schema';
import { UserSchema } from '@/modules/users/users.schema';

export const SettlementSchema = pgTable('settlements', {
  id: text('id').primaryKey(),
  poolId: text('pool_id').references(() => ExpensePoolSchema.id),
  fromUser: text('from_user').references(() => UserSchema.id),
  toUser: text('to_user').references(() => UserSchema.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 5 }).default('NGN').notNull(),
  proofUrl: text('proof_url'),
  note: text('note'),
  status: varchar('status', { length: 30 }).default('pending_verification').notNull(),
  disputedReason: text('disputed_reason'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
