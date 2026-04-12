import { boolean, numeric, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { ExpensePoolSchema } from '@/modules/pools/pools.schema';
import { UserSchema } from '@/modules/users/users.schema';

export const ExpenseSchema = pgTable('expenses', {
  id: text('id').primaryKey(),
  poolId: text('pool_id')
    .references(() => ExpensePoolSchema.id, { onDelete: 'cascade' })
    .notNull(),
  paidBy: text('paid_by').references(() => UserSchema.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 5 }).default('NGN').notNull(),
  description: varchar('description', { length: 255 }),
  category: varchar('category', { length: 50 }),
  receiptUrl: text('receipt_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // Recurring expense fields
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurrenceFrequency: varchar('recurrence_frequency', { length: 20 }),
  recurrenceEndDate: timestamp('recurrence_end_date', { withTimezone: true }),
  recurrenceParentId: text('recurrence_parent_id'), // null on parent; set on auto-generated instances
  nextOccurrenceAt: timestamp('next_occurrence_at', { withTimezone: true }),
});

export const ExpenseSplitSchema = pgTable('expense_splits', {
  id: text('id').primaryKey(),
  expenseId: text('expense_id')
    .references(() => ExpenseSchema.id, { onDelete: 'cascade' })
    .notNull(),
  owedBy: text('owed_by').references(() => UserSchema.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  settled: boolean('settled').default(false).notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});
