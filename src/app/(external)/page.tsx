import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { LandingExperience } from "./_components/landing-experience";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vadosstack.com";
const title = "Field Service Management Software for Service Businesses";
const description =
  "VadosStack field service management software helps service businesses manage leads, customers, jobs, estimates, invoices, service templates, email templates, and employee time history in one dashboard.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "service business software",
    "field service management software",
    "field service software",
    "contractor management software",
    "contractor software",
    "job management",
    "estimate software",
    "invoice software",
    "employee time tracking",
    "email template software",
    "lead management software",
    "customer management",
    "field service dashboard",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description,
    images: [
      {
        alt: "VadosStack management software for service businesses",
        height: 630,
        url: "/opengraph-image",
        width: 1200,
      },
    ],
    url: siteUrl,
    siteName: APP_CONFIG.name,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_CONFIG.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Customer management",
    "Lead management",
    "Job scheduling",
    "Estimate creation",
    "Invoice generation",
    "Service templates",
    "Rich email templates",
    "Email history",
    "Employee records",
    "Employee time tracking",
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static JSON-LD for SEO.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingExperience />
    </>
  );
}
