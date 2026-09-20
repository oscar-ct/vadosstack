ALTER TABLE "users"
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "workspaces"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active',
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedByUserId" TEXT,
ADD COLUMN "suspensionReasonCode" TEXT,
ADD COLUMN "suspensionNote" TEXT,
ADD COLUMN "suspendedUntil" TIMESTAMP(3);

CREATE TABLE "workspace_enforcement_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "reasonCode" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_enforcement_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workspaces_status_idx" ON "workspaces"("status");
CREATE INDEX "workspaces_suspendedByUserId_idx" ON "workspaces"("suspendedByUserId");
CREATE INDEX "workspace_enforcement_events_workspaceId_createdAt_idx"
ON "workspace_enforcement_events"("workspaceId", "createdAt");
CREATE INDEX "workspace_enforcement_events_actorUserId_createdAt_idx"
ON "workspace_enforcement_events"("actorUserId", "createdAt");

ALTER TABLE "workspaces"
ADD CONSTRAINT "workspaces_suspendedByUserId_fkey"
FOREIGN KEY ("suspendedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_enforcement_events"
ADD CONSTRAINT "workspace_enforcement_events_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_enforcement_events"
ADD CONSTRAINT "workspace_enforcement_events_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
