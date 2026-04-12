-- Create categories reference table
CREATE TABLE IF NOT EXISTS "categories" (
  "id"          text PRIMARY KEY,
  "slug"        varchar(60) UNIQUE NOT NULL,
  "name"        varchar(100) NOT NULL,
  "description" text NOT NULL,
  "emoji"       varchar(10) NOT NULL,
  "group"       varchar(50) NOT NULL,
  "is_active"   boolean DEFAULT true NOT NULL
);

-- Replace free-text category column with a FK to the new table
ALTER TABLE "expenses" DROP COLUMN IF EXISTS "category";
ALTER TABLE "expenses" ADD COLUMN "category_id" text REFERENCES "categories"("id");
