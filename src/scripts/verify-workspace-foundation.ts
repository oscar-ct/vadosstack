import { prisma } from "../lib/prisma";

type CountRow = { count: bigint };

const REQUIRED_TENANT_CONSTRAINTS = [
  "workspace_memberships_roleId_workspaceId_fkey",
  "workspace_memberships_employeeId_workspaceId_fkey",
  "workspace_invitations_roleId_workspaceId_fkey",
  "workspace_invitations_employeeId_workspaceId_fkey",
] as const;

const REQUIRED_SLUG_TRIGGERS = ["workspaces_slug_not_reserved", "workspace_slug_alias_not_canonical"] as const;

async function main() {
  const [
    users,
    workspaces,
    memberships,
    ownerRoles,
    missingOwnerRoles,
    missingActiveOwners,
    invalidOwnerMemberships,
    tenantConstraints,
    slugAliases,
    overlappingSlugs,
    invalidCanonicalSlugs,
    slugTriggers,
    workspaceOwnerForeignKeys,
    legacyUserOwnerForeignKeys,
    gmailWorkspaceColumns,
    gmailWorkspaceForeignKeys,
    gmailCompatibilityColumns,
    gmailCompatibilityTriggers,
    legacyOwnerSetNullForeignKeys,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.workspaceMembership.count(),
    prisma.workspaceRole.count({ where: { systemKey: "OWNER", isProtected: true } }),
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "workspaces" workspace
      LEFT JOIN "workspace_roles" role
        ON role."workspaceId" = workspace."id"
        AND role."systemKey" = 'OWNER'
        AND role."isProtected" = true
      WHERE role."id" IS NULL
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "workspaces" workspace
      WHERE NOT EXISTS (
        SELECT 1
        FROM "workspace_memberships" membership
        JOIN "workspace_roles" role
          ON role."id" = membership."roleId"
          AND role."workspaceId" = workspace."id"
          AND role."systemKey" = 'OWNER'
          AND role."isProtected" = true
        WHERE membership."workspaceId" = workspace."id"
          AND membership."status" = 'Active'
      )
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "workspace_memberships" membership
      JOIN "workspace_roles" role ON role."id" = membership."roleId"
      WHERE role."systemKey" = 'OWNER'
        AND (
          role."workspaceId" <> membership."workspaceId"
          OR role."isProtected" IS NOT TRUE
          OR membership."status" <> 'Active'
        )
    `,
    prisma.$queryRaw<Array<{ name: string }>>`
      SELECT constraint_name AS name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND constraint_name IN (
          'workspace_memberships_roleId_workspaceId_fkey',
          'workspace_memberships_employeeId_workspaceId_fkey',
          'workspace_invitations_roleId_workspaceId_fkey',
          'workspace_invitations_employeeId_workspaceId_fkey'
        )
    `,
    prisma.workspaceSlugAlias.count(),
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "workspaces" workspace
      JOIN "workspace_slug_aliases" alias ON alias."slug" = workspace."slug"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM "workspaces"
      WHERE "slug" !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    `,
    prisma.$queryRaw<Array<{ name: string }>>`
      SELECT trigger_name AS name
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND trigger_name IN ('workspaces_slug_not_reserved', 'workspace_slug_alias_not_canonical')
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT tc.constraint_name) AS count
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'ownerId'
        AND ccu.table_name = 'workspaces'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT tc.constraint_name) AS count
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'ownerId'
        AND ccu.table_name = 'users'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'google_mail_accounts'
        AND column_name = 'workspaceId'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'google_mail_accounts'
        AND kcu.column_name = 'workspaceId'
        AND ccu.table_name = 'workspaces'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'google_mail_accounts'
        AND column_name = 'userId'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT trigger_name) AS count
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
        AND event_object_table = 'google_mail_accounts'
        AND trigger_name = 'google_mail_workspace_identity_sync'
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count
      FROM information_schema.referential_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = 'workspaces_legacyOwnerId_fkey'
        AND delete_rule = 'SET NULL'
    `,
  ]);
  const protectedAdminRoles = await prisma.workspaceRole.count({
    where: { systemKey: "ADMIN", isProtected: true },
  });

  const presentConstraints = new Set(tenantConstraints.map((constraint) => constraint.name));
  const missingTenantConstraints = REQUIRED_TENANT_CONSTRAINTS.filter(
    (constraint) => !presentConstraints.has(constraint),
  );
  const presentSlugTriggers = new Set(slugTriggers.map((trigger) => trigger.name));
  const missingSlugTriggers = REQUIRED_SLUG_TRIGGERS.filter((trigger) => !presentSlugTriggers.has(trigger));

  const report = {
    users,
    workspaces,
    memberships,
    protectedOwnerRoles: ownerRoles,
    protectedAdminRoles,
    workspacesMissingOwnerRole: Number(missingOwnerRoles[0]?.count ?? 0),
    workspacesMissingActiveOwner: Number(missingActiveOwners[0]?.count ?? 0),
    invalidOwnerMemberships: Number(invalidOwnerMemberships[0]?.count ?? 0),
    missingTenantConstraints,
    workspaceSlugAliases: slugAliases,
    canonicalAliasOverlaps: Number(overlappingSlugs[0]?.count ?? 0),
    invalidCanonicalSlugs: Number(invalidCanonicalSlugs[0]?.count ?? 0),
    missingSlugTriggers,
    workspaceOwnerForeignKeys: Number(workspaceOwnerForeignKeys[0]?.count ?? 0),
    legacyUserOwnerForeignKeys: Number(legacyUserOwnerForeignKeys[0]?.count ?? 0),
    gmailWorkspaceColumns: Number(gmailWorkspaceColumns[0]?.count ?? 0),
    gmailWorkspaceForeignKeys: Number(gmailWorkspaceForeignKeys[0]?.count ?? 0),
    gmailCompatibilityColumns: Number(gmailCompatibilityColumns[0]?.count ?? 0),
    gmailCompatibilityTriggers: Number(gmailCompatibilityTriggers[0]?.count ?? 0),
    legacyOwnerSetNullForeignKeys: Number(legacyOwnerSetNullForeignKeys[0]?.count ?? 0),
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    report.protectedOwnerRoles !== report.workspaces ||
    report.protectedAdminRoles !== report.workspaces ||
    report.workspacesMissingOwnerRole !== 0 ||
    report.workspacesMissingActiveOwner !== 0 ||
    report.invalidOwnerMemberships !== 0 ||
    report.missingTenantConstraints.length !== 0 ||
    report.canonicalAliasOverlaps !== 0 ||
    report.invalidCanonicalSlugs !== 0 ||
    report.missingSlugTriggers.length !== 0 ||
    report.workspaceOwnerForeignKeys !== 29 ||
    report.legacyUserOwnerForeignKeys !== 0 ||
    report.gmailWorkspaceColumns !== 1 ||
    report.gmailWorkspaceForeignKeys !== 1 ||
    report.gmailCompatibilityColumns !== 1 ||
    report.gmailCompatibilityTriggers !== 1 ||
    report.legacyOwnerSetNullForeignKeys !== 1
  ) {
    throw new Error("Workspace authorization foundation verification failed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
