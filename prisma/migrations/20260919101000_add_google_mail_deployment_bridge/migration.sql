-- Temporary expand/contract bridge: old application builds address this value as
-- userId while new builds use workspaceId. Keep the two values synchronized until
-- every production instance is running the workspace-aware application.
ALTER TABLE "google_mail_accounts" ADD COLUMN "userId" TEXT;

UPDATE "google_mail_accounts"
SET "userId" = "workspaceId"
WHERE "userId" IS NULL;

CREATE UNIQUE INDEX "google_mail_accounts_userId_key" ON "google_mail_accounts"("userId");

CREATE OR REPLACE FUNCTION "sync_google_mail_workspace_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."workspaceId" := COALESCE(NEW."workspaceId", NEW."userId");
    NEW."userId" := COALESCE(NEW."userId", NEW."workspaceId");
  ELSIF NEW."workspaceId" IS DISTINCT FROM OLD."workspaceId" THEN
    NEW."userId" := NEW."workspaceId";
  ELSIF NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    NEW."workspaceId" := NEW."userId";
  END IF;

  IF NEW."workspaceId" IS NULL OR NEW."userId" IS NULL OR NEW."workspaceId" <> NEW."userId" THEN
    RAISE EXCEPTION 'Google Mail workspace identity columns must match';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "google_mail_workspace_identity_sync"
BEFORE INSERT OR UPDATE OF "workspaceId", "userId" ON "google_mail_accounts"
FOR EACH ROW
EXECUTE FUNCTION "sync_google_mail_workspace_identity"();
