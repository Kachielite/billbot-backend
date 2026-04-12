-- BillBot Initial Schema Migration

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "phone" varchar(20),
  "email" varchar(255),
  "avatar_url" text,
  "google_id" varchar(100),
  "apple_id" varchar(100),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  UNIQUE("email"),
  UNIQUE("google_id"),
  UNIQUE("apple_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" varchar(128) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "groups" (
  "id" text PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "invite_code" varchar(12) NOT NULL UNIQUE,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_members" (
  "group_id" text NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" varchar(20) DEFAULT 'member' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("group_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "invites" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "invited_by" text REFERENCES "users"("id"),
  "phone" varchar(20),
  "email" varchar(255),
  "token" varchar(64) NOT NULL UNIQUE,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expense_pools" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "name" varchar(100) NOT NULL,
  "description" text,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "split_type" varchar(20) DEFAULT 'equal' NOT NULL,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pool_members" (
  "pool_id" text NOT NULL REFERENCES "expense_pools"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("pool_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text PRIMARY KEY NOT NULL,
  "pool_id" text NOT NULL REFERENCES "expense_pools"("id") ON DELETE CASCADE,
  "paid_by" text REFERENCES "users"("id"),
  "amount" numeric(12, 2) NOT NULL,
  "currency" varchar(5) DEFAULT 'NGN' NOT NULL,
  "description" varchar(255),
  "category" varchar(50),
  "receipt_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expense_splits" (
  "id" text PRIMARY KEY NOT NULL,
  "expense_id" text NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
  "owed_by" text REFERENCES "users"("id"),
  "amount" numeric(12, 2) NOT NULL,
  "settled" boolean DEFAULT false NOT NULL,
  "settled_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "settlements" (
  "id" text PRIMARY KEY NOT NULL,
  "pool_id" text REFERENCES "expense_pools"("id"),
  "from_user" text REFERENCES "users"("id"),
  "to_user" text REFERENCES "users"("id"),
  "amount" numeric(12, 2) NOT NULL,
  "currency" varchar(5) DEFAULT 'NGN' NOT NULL,
  "proof_url" text,
  "note" text,
  "status" varchar(30) DEFAULT 'pending_verification' NOT NULL,
  "disputed_reason" text,
  "confirmed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" text PRIMARY KEY NOT NULL,
  "group_id" text NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "secret" varchar(100) NOT NULL,
  "events" text[] NOT NULL,
  "created_by" text REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "subscription_id" text NOT NULL REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE,
  "event_type" varchar(100) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "response_code" integer,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
