-- Serialize every canonical and alias write, including writes made outside the
-- application allocator, so two concurrent transactions cannot claim the same
-- logical slug across the two tables.
CREATE OR REPLACE FUNCTION "prevent_reserved_workspace_slug"() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('vadosstack-workspace-slugs'));

    IF EXISTS (SELECT 1 FROM "workspace_slug_aliases" WHERE "slug" = NEW."slug") THEN
        RAISE EXCEPTION 'Workspace slug is reserved' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "prevent_canonical_workspace_slug_alias"() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('vadosstack-workspace-slugs'));

    IF EXISTS (SELECT 1 FROM "workspaces" WHERE "slug" = NEW."slug") THEN
        RAISE EXCEPTION 'Workspace slug is already canonical' USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
