import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vadosstack.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/auth/", "/employee-time-tracking/time/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
