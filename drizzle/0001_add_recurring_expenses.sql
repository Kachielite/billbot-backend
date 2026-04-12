-- Add recurring expense columns to expenses table
ALTER TABLE "expenses" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;
ALTER TABLE "expenses" ADD COLUMN "recurrence_frequency" varchar(20);
ALTER TABLE "expenses" ADD COLUMN "recurrence_end_date" timestamp with time zone;
ALTER TABLE "expenses" ADD COLUMN "recurrence_parent_id" text;
ALTER TABLE "expenses" ADD COLUMN "next_occurrence_at" timestamp with time zone;
