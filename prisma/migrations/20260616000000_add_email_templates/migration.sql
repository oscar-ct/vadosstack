CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_id_ownerId_key" ON "email_templates"("id", "ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_ownerId_scope_title_key" ON "email_templates"("ownerId", "scope", "title");
CREATE INDEX IF NOT EXISTS "email_templates_ownerId_idx" ON "email_templates"("ownerId");
CREATE INDEX IF NOT EXISTS "email_templates_scope_idx" ON "email_templates"("scope");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'email_templates_ownerId_fkey'
  ) THEN
    ALTER TABLE "email_templates"
      ADD CONSTRAINT "email_templates_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
