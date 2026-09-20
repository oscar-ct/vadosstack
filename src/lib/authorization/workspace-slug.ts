import type { Prisma } from "@prisma/client";

const MAX_SLUG_BASE_LENGTH = 60;
const MAX_SLUG_ATTEMPTS = 10_000;

export function normalizeWorkspaceSlug(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_SLUG_BASE_LENGTH)
      .replace(/-+$/g, "") || "workspace"
  );
}

async function lockWorkspaceSlugNamespace(tx: Prisma.TransactionClient) {
  // Casting PostgreSQL's void return value avoids Prisma's unsupported-void
  // deserialization error while retaining a transaction-scoped advisory lock.
  await tx.$queryRaw<Array<{ lock: string }>>`
    SELECT pg_advisory_xact_lock(hashtext('vadosstack-workspace-slugs'))::text AS lock
  `;
}

async function allocateWorkspaceSlug(tx: Prisma.TransactionClient, companyName: string, currentWorkspaceId?: string) {
  await lockWorkspaceSlugNamespace(tx);
  const baseSlug = normalizeWorkspaceSlug(companyName);

  for (let suffix = 1; suffix <= MAX_SLUG_ATTEMPTS; suffix += 1) {
    const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
    const canonical = await tx.workspace.findUnique({ where: { slug }, select: { id: true } });

    if (canonical && canonical.id !== currentWorkspaceId) {
      continue;
    }

    const alias = await tx.workspaceSlugAlias.findUnique({
      where: { slug },
      select: { id: true, workspaceId: true },
    });

    if (alias && alias.workspaceId !== currentWorkspaceId) {
      continue;
    }

    return {
      reclaimedAliasId: alias?.id ?? null,
      slug,
    };
  }

  throw new Error("A unique workspace URL could not be generated.");
}

export async function createWorkspaceSlug(tx: Prisma.TransactionClient, companyName: string) {
  return (await allocateWorkspaceSlug(tx, companyName)).slug;
}

export async function updateWorkspaceNameAndSlug(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  companyName: string,
) {
  const currentWorkspace = await tx.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { slug: true },
  });
  const allocation = await allocateWorkspaceSlug(tx, companyName, workspaceId);

  if (allocation.reclaimedAliasId) {
    await tx.workspaceSlugAlias.delete({ where: { id: allocation.reclaimedAliasId } });
  }

  if (allocation.slug === currentWorkspace.slug) {
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { name: companyName },
    });
    return allocation.slug;
  }

  await tx.workspace.update({
    where: { id: workspaceId },
    data: {
      name: companyName,
      slug: allocation.slug,
    },
  });
  await tx.workspaceSlugAlias.create({
    data: {
      workspaceId,
      slug: currentWorkspace.slug,
    },
  });

  return allocation.slug;
}
