import { prisma } from "../lib/prisma";

type OwnerScopedTable = {
  tableName: string;
};

type CountRow = {
  count: bigint;
};

type ColumnRow = {
  columnName: string;
};

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;

async function main() {
  const database = await prisma.$queryRaw<Array<{ database: string; host: string }>>`
    SELECT current_database() AS database, inet_server_addr()::text AS host
  `;
  const [workspaceTable] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT to_regclass('public.workspaces') IS NOT NULL AS exists
  `;
  const hasWorkspaces = workspaceTable?.exists ?? false;
  const ownershipTarget = hasWorkspaces ? "workspaces" : "users";
  const ownerScopedTables = await prisma.$queryRaw<OwnerScopedTable[]>`
    SELECT table_name AS "tableName"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'ownerId'
    ORDER BY table_name
  `;

  const [[userCount], [workspaceCount], [googleMailAccounts], googleMailColumns] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM "users"`,
    hasWorkspaces
      ? prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM "workspaces"`
      : Promise.resolve([{ count: BigInt(0) }]),
    prisma.$queryRaw<CountRow[]>`SELECT COUNT(*) AS count FROM "google_mail_accounts"`,
    prisma.$queryRaw<ColumnRow[]>`
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'google_mail_accounts'
        AND column_name IN ('userId', 'workspaceId')
    `,
  ]);
  const googleMailIdentityColumn = googleMailColumns.some((column) => column.columnName === "workspaceId")
    ? "workspaceId"
    : "userId";
  const [orphanedGoogleMailOwners] = await prisma.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*) AS count
    FROM "google_mail_accounts" account
    LEFT JOIN ${quoteIdentifier(ownershipTarget)} owner
      ON owner."id" = account.${quoteIdentifier(googleMailIdentityColumn)}
    WHERE owner."id" IS NULL
  `);
  const [workspaceOnlyGoogleMailAccounts] = hasWorkspaces
    ? await prisma.$queryRawUnsafe<CountRow[]>(`
        SELECT COUNT(*) AS count
        FROM "google_mail_accounts" mail
        JOIN "workspaces" workspace
          ON workspace."id" = mail.${quoteIdentifier(googleMailIdentityColumn)}
        LEFT JOIN "users" account
          ON account."id" = mail.${quoteIdentifier(googleMailIdentityColumn)}
        WHERE account."id" IS NULL
      `)
    : [{ count: BigInt(0) }];
  const tableResults: Array<{
    table: string;
    rows: number;
    orphanedWorkspaces: number;
    workspaceOnlyOwners: number;
  }> = [];

  for (const { tableName } of ownerScopedTables) {
    const table = quoteIdentifier(tableName);
    const [rows] = await prisma.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*) AS count FROM ${table}`);
    const [orphanedOwners] = await prisma.$queryRawUnsafe<CountRow[]>(`
      SELECT COUNT(*) AS count
      FROM ${table} record
      LEFT JOIN ${quoteIdentifier(ownershipTarget)} owner ON owner."id" = record."ownerId"
      WHERE owner."id" IS NULL
    `);
    const [workspaceOnlyOwners] = hasWorkspaces
      ? await prisma.$queryRawUnsafe<CountRow[]>(`
          SELECT COUNT(*) AS count
          FROM ${table} record
          JOIN "workspaces" workspace ON workspace."id" = record."ownerId"
          LEFT JOIN "users" account ON account."id" = record."ownerId"
          WHERE account."id" IS NULL
        `)
      : [{ count: BigInt(0) }];

    tableResults.push({
      table: tableName,
      rows: Number(rows?.count ?? 0),
      orphanedWorkspaces: Number(orphanedOwners?.count ?? 0),
      workspaceOnlyOwners: Number(workspaceOnlyOwners?.count ?? 0),
    });
  }

  const report = {
    database: database[0] ?? null,
    phase: hasWorkspaces ? "workspace" : "legacy-user",
    ownershipTarget,
    googleMailIdentityColumn,
    users: Number(userCount?.count ?? 0),
    workspaces: Number(workspaceCount?.count ?? 0),
    googleMailAccounts: Number(googleMailAccounts?.count ?? 0),
    orphanedGoogleMailWorkspaces: Number(orphanedGoogleMailOwners?.count ?? 0),
    workspaceOnlyGoogleMailAccounts: Number(workspaceOnlyGoogleMailAccounts?.count ?? 0),
    ownerScopedTableCount: ownerScopedTables.length,
    totalOwnerScopedRows: tableResults.reduce((sum, table) => sum + table.rows, 0),
    totalOrphanedWorkspaces: tableResults.reduce((sum, table) => sum + table.orphanedWorkspaces, 0),
    totalWorkspaceOnlyOwnerRows: tableResults.reduce((sum, table) => sum + table.workspaceOnlyOwners, 0),
    tables: tableResults,
  };

  console.log(JSON.stringify(report, null, 2));

  if (report.totalOrphanedWorkspaces > 0 || report.orphanedGoogleMailWorkspaces > 0) {
    throw new Error("Workspace migration baseline failed: owner records without a workspace exist.");
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
