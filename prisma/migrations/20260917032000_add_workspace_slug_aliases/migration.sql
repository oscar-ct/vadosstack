CREATE TABLE "workspace_slug_aliases" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_slug_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_slug_aliases_slug_key" ON "workspace_slug_aliases"("slug");
CREATE INDEX "workspace_slug_aliases_workspaceId_idx" ON "workspace_slug_aliases"("workspaceId");

ALTER TABLE "workspace_slug_aliases"
    ADD CONSTRAINT "workspace_slug_aliases_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing route before replacing ID-suffixed slugs with readable ones.
INSERT INTO "workspace_slug_aliases" ("id", "workspaceId", "slug", "createdAt")
SELECT CONCAT('slug-alias-', "id"), "id", "slug", CURRENT_TIMESTAMP
FROM "workspaces";

-- Allocate readable canonical slugs deterministically. Existing canonical slugs and
-- aliases owned by other workspaces are reserved, so collisions receive -2, -3, etc.
DO $$
DECLARE
    workspace_record RECORD;
    base_slug TEXT;
    candidate_slug TEXT;
    suffix INTEGER;
BEGIN
    FOR workspace_record IN SELECT "id", "name" FROM "workspaces" ORDER BY "createdAt", "id"
    LOOP
        base_slug := TRIM(BOTH '-' FROM LEFT(LOWER(REGEXP_REPLACE(workspace_record."name", '[^a-zA-Z0-9]+', '-', 'g')), 60));
        IF base_slug = '' THEN
            base_slug := 'workspace';
        END IF;

        candidate_slug := base_slug;
        suffix := 1;

        WHILE EXISTS (
            SELECT 1 FROM "workspaces"
            WHERE "slug" = candidate_slug AND "id" <> workspace_record."id"
        ) OR EXISTS (
            SELECT 1 FROM "workspace_slug_aliases"
            WHERE "slug" = candidate_slug AND "workspaceId" <> workspace_record."id"
        ) LOOP
            suffix := suffix + 1;
            candidate_slug := CONCAT(LEFT(base_slug, 60), '-', suffix);
        END LOOP;

        UPDATE "workspaces" SET "slug" = candidate_slug WHERE "id" = workspace_record."id";
    END LOOP;
END $$;

-- If an old canonical value already equals its new value, no alias is necessary.
DELETE FROM "workspace_slug_aliases" alias
USING "workspaces" workspace
WHERE alias."workspaceId" = workspace."id" AND alias."slug" = workspace."slug";

-- PostgreSQL cannot express uniqueness across two tables with a normal index. These
-- triggers reserve both current and historical slugs in one logical namespace.
CREATE FUNCTION "prevent_reserved_workspace_slug"() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "workspace_slug_aliases" WHERE "slug" = NEW."slug") THEN
        RAISE EXCEPTION 'Workspace slug is reserved' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "prevent_canonical_workspace_slug_alias"() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = NEW."slug") THEN
        RAISE EXCEPTION 'Workspace slug is already canonical' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "workspaces_slug_not_reserved"
BEFORE INSERT OR UPDATE OF "slug" ON "workspaces"
FOR EACH ROW EXECUTE FUNCTION "prevent_reserved_workspace_slug"();

CREATE TRIGGER "workspace_slug_alias_not_canonical"
BEFORE INSERT OR UPDATE OF "slug" ON "workspace_slug_aliases"
FOR EACH ROW EXECUTE FUNCTION "prevent_canonical_workspace_slug_alias"();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "workspaces" workspace
        JOIN "workspace_slug_aliases" alias ON alias."slug" = workspace."slug"
    ) THEN
        RAISE EXCEPTION 'Canonical and historical workspace slug namespaces overlap';
    END IF;
END $$;
