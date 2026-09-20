import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";

const fallbackCompanyLogoSrc = "/dashboard/company-logo?fallback=1";

export async function getCompanyLogoSrc(workspaceId: string, workspaceSlug?: string) {
  const fallbackSrc = workspaceSlug
    ? `${getWorkspaceDashboardPath(workspaceSlug, "/dashboard/company-logo")}?fallback=1`
    : fallbackCompanyLogoSrc;
  const workspace = await prisma.workspace.findUnique({
    where: {
      id: workspaceId,
    },
    select: {
      companyLogoDataUrl: true,
      companyLogoKey: true,
      legacyOwner: {
        select: {
          companyLogoDataUrl: true,
          companyLogoKey: true,
        },
      },
    },
  });
  const logo = workspace?.companyLogoKey || workspace?.companyLogoDataUrl ? workspace : workspace?.legacyOwner;

  if (logo?.companyLogoKey) {
    try {
      return getR2PublicUrl(logo.companyLogoKey) ?? fallbackSrc;
    } catch {
      return fallbackSrc;
    }
  }

  return logo?.companyLogoDataUrl ?? fallbackSrc;
}
