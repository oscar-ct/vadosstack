-- Prevent cross-workspace role and employee references at the database boundary.

ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_roleId_fkey";
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_employeeId_fkey";
ALTER TABLE "workspace_invitations" DROP CONSTRAINT "workspace_invitations_roleId_fkey";
ALTER TABLE "workspace_invitations" DROP CONSTRAINT "workspace_invitations_employeeId_fkey";

CREATE UNIQUE INDEX "workspace_roles_id_workspaceId_key" ON "workspace_roles"("id", "workspaceId");
CREATE UNIQUE INDEX "workspace_memberships_employeeId_workspaceId_key" ON "workspace_memberships"("employeeId", "workspaceId");

ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_roleId_workspaceId_fkey"
    FOREIGN KEY ("roleId", "workspaceId") REFERENCES "workspace_roles"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships"
    ADD CONSTRAINT "workspace_memberships_employeeId_workspaceId_fkey"
    FOREIGN KEY ("employeeId", "workspaceId") REFERENCES "employees"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_roleId_workspaceId_fkey"
    FOREIGN KEY ("roleId", "workspaceId") REFERENCES "workspace_roles"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_employeeId_workspaceId_fkey"
    FOREIGN KEY ("employeeId", "workspaceId") REFERENCES "employees"("id", "ownerId") ON DELETE RESTRICT ON UPDATE CASCADE;
