ALTER TABLE "invites" ADD COLUMN "code" varchar(20);

UPDATE "invites" SET "code" = UPPER(
  SUBSTRING(md5(random()::text), 1, 5) || '-' || FLOOR(1000 + random() * 9000)::text
) WHERE "code" IS NULL;

ALTER TABLE "invites" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "invites" ADD CONSTRAINT "invites_code_unique" UNIQUE ("code");
