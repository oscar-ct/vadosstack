import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Object, getR2PublicUrl } from "@/lib/r2";

const fallbackLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Default company logo">
  <rect width="64" height="64" rx="16" fill="#111827"/>
  <path d="M24 20a4 4 0 1 1 4-4v8h8v-8a4 4 0 1 1 4 4h-8v8h8a4 4 0 1 1-4 4v-8h-8v8a4 4 0 1 1-4-4h8v-8h-8Z" fill="none" stroke="#f8fafc" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function imageResponse(body: BodyInit, contentType: string) {
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": contentType,
    },
  });
}

function fallbackResponse() {
  return imageResponse(fallbackLogo, "image/svg+xml");
}

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return fallbackResponse();
  }

  const user = await prisma.user.findUnique({
    where: {
      id: currentUser.id,
    },
    select: {
      companyLogoDataUrl: true,
      companyLogoKey: true,
      companyLogoType: true,
    },
  });

  if (user?.companyLogoKey) {
    try {
      const publicUrl = getR2PublicUrl(user.companyLogoKey);

      if (publicUrl) {
        return Response.redirect(publicUrl);
      }

      const object = await getR2Object(user.companyLogoKey);
      const bytes = await object.Body?.transformToByteArray();

      if (bytes) {
        return imageResponse(
          Buffer.from(bytes),
          object.ContentType ?? user.companyLogoType ?? "application/octet-stream",
        );
      }
    } catch {
      return fallbackResponse();
    }
  }

  const logoDataUrl = user?.companyLogoDataUrl;

  if (!logoDataUrl) {
    return fallbackResponse();
  }

  const match = /^data:([^;]+);base64,(.+)$/.exec(logoDataUrl);

  if (!match) {
    return fallbackResponse();
  }

  return imageResponse(Buffer.from(match[2], "base64"), match[1]);
}
