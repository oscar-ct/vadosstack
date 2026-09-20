-- Add the workspace authorization foundation without changing existing owner-scoped records.
-- Existing User IDs are deliberately reused as Workspace IDs so later foreign-key migrations
-- can retarget ownerId columns without rewriting business data.

CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyAddress" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "companyLogoDataUrl" TEXT,
    "companyLogoKey" TEXT,
    "companyLogoType" TEXT,
    "estimateValidDays" INTEGER NOT NULL DEFAULT 15,
    "estimateMessageEnabled" BOOLEAN NOT NULL DEFAULT true,
    "estimateMessageAlign" TEXT NOT NULL DEFAULT 'left',
    "estimateMessageText" TEXT NOT NULL,
    "invoiceDueDays" INTEGER NOT NULL DEFAULT 15,
    "invoiceMessageEnabled" BOOLEAN NOT NULL DEFAULT false,
    "invoiceMessageAlign" TEXT NOT NULL DEFAULT 'left',
    "invoiceMessageText" TEXT NOT NULL,
    "orderMessageText" TEXT NOT NULL,
    "workspaceMode" TEXT NOT NULL DEFAULT 'both',
    "legacyOwnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_roles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemKey" TEXT,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_role_permissions_pkey" PRIMARY KEY ("roleId", "permissionKey")
);

CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "authorization_audit_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "membershipId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE UNIQUE INDEX "workspaces_legacyOwnerId_key" ON "workspaces"("legacyOwnerId");
CREATE INDEX "workspaces_name_idx" ON "workspaces"("name");

CREATE UNIQUE INDEX "workspace_roles_workspaceId_name_key" ON "workspace_roles"("workspaceId", "name");
CREATE UNIQUE INDEX "workspace_roles_workspaceId_systemKey_key" ON "workspace_roles"("workspaceId", "systemKey");
CREATE INDEX "workspace_roles_workspaceId_idx" ON "workspace_roles"("workspaceId");

CREATE INDEX "workspace_role_permissions_permissionKey_idx" ON "workspace_role_permissions"("permissionKey");

CREATE UNIQUE INDEX "workspace_memberships_employeeId_key" ON "workspace_memberships"("employeeId");
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");
CREATE INDEX "workspace_memberships_workspaceId_status_idx" ON "workspace_memberships"("workspaceId", "status");
CREATE INDEX "workspace_memberships_userId_status_idx" ON "workspace_memberships"("userId", "status");
CREATE INDEX "workspace_memberships_roleId_idx" ON "workspace_memberships"("roleId");

CREATE UNIQUE INDEX "workspace_invitations_tokenHash_key" ON "workspace_invitations"("tokenHash");
CREATE INDEX "workspace_invitations_workspaceId_email_idx" ON "workspace_invitations"("workspaceId", "email");
CREATE INDEX "workspace_invitations_email_expiresAt_idx" ON "workspace_invitations"("email", "expiresAt");
CREATE INDEX "workspace_invitations_roleId_idx" ON "workspace_invitations"("roleId");
CREATE INDEX "workspace_invitations_employeeId_idx" ON "workspace_invitations"("employeeId");

CREATE INDEX "authorization_audit_events_workspaceId_createdAt_idx" ON "authorization_audit_events"("workspaceId", "createdAt");
CREATE INDEX "authorization_audit_events_actorUserId_createdAt_idx" ON "authorization_audit_events"("actorUserId", "createdAt");
CREATE INDEX "authorization_audit_events_targetType_targetId_idx" ON "authorization_audit_events"("targetType", "targetId");

ALTER TABLE "workspaces"
    ADD CONSTRAINT "workspaces_legacyOwnerId_fkey"
    FOREIGN KEY ("legacyOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_roles"
    ADD CONSTRAINT "workspace_roles_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_role_permissions"
    ADD CONSTRAINT "workspace_role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "workspace_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "authorization_audit_events"
    ADD CONSTRAINT "authorization_audit_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "authorization_audit_events"
    ADD CONSTRAINT "authorization_audit_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "authorization_audit_events"
    ADD CONSTRAINT "authorization_audit_events_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "workspace_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "workspaces" (
    "id",
    "slug",
    "name",
    "companyAddress",
    "companyEmail",
    "companyPhone",
    "companyLogoDataUrl",
    "companyLogoKey",
    "companyLogoType",
    "estimateValidDays",
    "estimateMessageEnabled",
    "estimateMessageAlign",
    "estimateMessageText",
    "invoiceDueDays",
    "invoiceMessageEnabled",
    "invoiceMessageAlign",
    "invoiceMessageText",
    "orderMessageText",
    "workspaceMode",
    "legacyOwnerId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    CONCAT(
        TRIM(BOTH '-' FROM LEFT(LOWER(REGEXP_REPLACE("companyName", '[^a-zA-Z0-9]+', '-', 'g')), 60)),
        CASE WHEN TRIM(BOTH '-' FROM REGEXP_REPLACE("companyName", '[^a-zA-Z0-9]+', '-', 'g')) = '' THEN 'workspace' ELSE '' END,
        '-',
        LOWER("id")
    ),
    "companyName",
    "companyAddress",
    "companyEmail",
    "companyPhone",
    "companyLogoDataUrl",
    "companyLogoKey",
    "companyLogoType",
    "estimateValidDays",
    "estimateMessageEnabled",
    "estimateMessageAlign",
    "estimateMessageText",
    "invoiceDueDays",
    "invoiceMessageEnabled",
    "invoiceMessageAlign",
    "invoiceMessageText",
    "orderMessageText",
    "workspaceMode",
    "id",
    "createdAt",
    "updatedAt"
FROM "users";

INSERT INTO "workspace_roles" (
    "id",
    "workspaceId",
    "name",
    "description",
    "systemKey",
    "isProtected",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('owner-role-', "id"),
    "id",
    'Owner',
    'Full workspace access. This role cannot be edited or deleted.',
    'OWNER',
    true,
    "createdAt",
    CURRENT_TIMESTAMP
FROM "users";

INSERT INTO "workspace_memberships" (
    "id",
    "workspaceId",
    "userId",
    "roleId",
    "status",
    "joinedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    CONCAT('owner-membership-', "id"),
    "id",
    "id",
    CONCAT('owner-role-', "id"),
    'Active',
    "createdAt",
    "createdAt",
    CURRENT_TIMESTAMP
FROM "users";

DO $$
DECLARE
    user_count BIGINT;
    workspace_count BIGINT;
    owner_membership_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM "users";
    SELECT COUNT(*) INTO workspace_count FROM "workspaces" WHERE "legacyOwnerId" IS NOT NULL;
    SELECT COUNT(*) INTO owner_membership_count
    FROM "workspace_memberships" membership
    JOIN "workspace_roles" role ON role."id" = membership."roleId"
    WHERE membership."status" = 'Active' AND role."systemKey" = 'OWNER';

    IF workspace_count <> user_count OR owner_membership_count <> user_count THEN
        RAISE EXCEPTION 'Workspace owner backfill invariant failed: users=%, workspaces=%, owner memberships=%',
            user_count, workspace_count, owner_membership_count;
    END IF;
END $$;
