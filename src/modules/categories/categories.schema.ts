import { boolean, pgTable, text, varchar } from 'drizzle-orm/pg-core';

export const CategorySchema = pgTable('categories', {
  id: text('id').primaryKey(),
  slug: varchar('slug', { length: 60 }).unique().notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  emoji: varchar('emoji', { length: 10 }).notNull(),
  /** Analytics grouping key — coarser than slug, used for roll-ups */
  group: varchar('group', { length: 50 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});
