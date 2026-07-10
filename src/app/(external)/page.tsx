import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { LandingExperience } from "./_components/landing-experience";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vadosstack.com";
const title = "Field Service Management Software with E-Commerce Tools";
const description =
  "Run your service business in one workspace. VadosStack connects customers, leads, jobs, estimates, invoices, employee time, orders, inventory, and reporting.";

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
    "service business command center",
    "ecommerce management software",
    "e-commerce operations software",
    "order management software",
    "inventory management software",
    "small business inventory software",
    "order and inventory management",
    "commerce analytics dashboard",
    "returns management software",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description,
    images: [
      {
        alt: "VadosStack field service management software with built-in e-commerce tools",
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

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_CONFIG.name,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description,
  featureList: [
    "Customer management",
    "Lead management",
    "Service business command center",
    "Job scheduling",
    "Estimate creation",
    "Invoice generation",
    "Service templates",
    "Rich email templates",
    "Email history",
    "Employee records",
    "Employee time tracking",
    "E-commerce order management",
    "Inventory and stock movement tracking",
    "Order returns and refunds",
    "Commerce sales and inventory analytics",
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is VadosStack?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "VadosStack is web-based field service business software with built-in commerce tools. It connects customers, leads, jobs, estimates, invoices, employee time, orders, inventory, and reporting in one dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "Who is VadosStack built for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "VadosStack is built primarily for service businesses such as HVAC, plumbing, electrical, repair, contractors, and product-plus-service teams that need customer work, billing, and operations in one place.",
      },
    },
    {
      "@type": "Question",
      name: "Does VadosStack support estimates, jobs, and invoices?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Teams can manage estimate records, job records, invoice records, customer documents, email history, and service workflow status from the dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "Can service businesses also manage orders and inventory?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. VadosStack includes e-commerce tools for orders, fulfillment, inventory, returns, refunds, stock movement, and Commerce Pulse reporting when the business also sells products or parts.",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static JSON-LD for SEO.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static JSON-LD for SEO.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <LandingExperience />
    </>
  );
}
