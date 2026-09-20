import { normalizeWorkspaceSlug, updateWorkspaceNameAndSlug } from "../lib/authorization/workspace-slug";
import { prisma } from "../lib/prisma";

const ROLLBACK_SENTINEL = "WORKSPACE_SLUG_TEST_ROLLBACK";

async function main() {
  const workspaces = await prisma.workspace.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, name: true, slug: true },
    take: 2,
  });

  const [workspace, conflictingWorkspace] = workspaces;
  if (!workspace || !conflictingWorkspace) {
    throw new Error("At least two workspaces are required for the slug collision test.");
  }

  let result: { aliasCreated: boolean; allocatedSlug: string; collisionBase: string } | undefined;

  try {
    await prisma.$transaction(async (transaction) => {
      const allocatedSlug = await updateWorkspaceNameAndSlug(transaction, workspace.id, conflictingWorkspace.name);
      const collisionBase = normalizeWorkspaceSlug(conflictingWorkspace.name);
      const alias = await transaction.workspaceSlugAlias.findUnique({ where: { slug: workspace.slug } });

      result = {
        aliasCreated: alias?.workspaceId === workspace.id,
        allocatedSlug,
        collisionBase,
      };

      if (allocatedSlug === collisionBase || !allocatedSlug.startsWith(`${collisionBase}-`) || !result.aliasCreated) {
        throw new Error("Workspace slug collision or alias behavior did not match expectations.");
      }

      throw new Error(ROLLBACK_SENTINEL);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK_SENTINEL) {
      throw error;
    }
  }

  const unchangedWorkspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspace.id },
    select: { name: true, slug: true },
  });

  if (unchangedWorkspace.name !== workspace.name || unchangedWorkspace.slug !== workspace.slug) {
    throw new Error("The rollback-only workspace slug test changed persisted data.");
  }

  console.log(
    JSON.stringify(
      {
        ...result,
        persistedDataUnchanged: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
