import { prisma } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2";

const fallbackCompanyLogoSrc = "/dashboard/company-logo?fallback=1";

export async function getCompanyLogoSrc(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      companyLogoDataUrl: true,
      companyLogoKey: true,
    },
  });

  if (user?.companyLogoKey) {
    try {
      return getR2PublicUrl(user.companyLogoKey) ?? fallbackCompanyLogoSrc;
    } catch {
      return fallbackCompanyLogoSrc;
    }
  }

  return user?.companyLogoDataUrl ?? fallbackCompanyLogoSrc;
}
