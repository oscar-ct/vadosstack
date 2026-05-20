import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  Hammer,
  HardHat,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

import dashboardImage from "../../../media/dashboard.png";
import vadosstackLogo from "../../../media/vadosstack-logo-transparent.png";
import vadosstackLogoSmall from "../../../media/vadosstack-logo-transparent-small.png";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vadosstack.com";
const title = "Management Software for Service Businesses";
const description =
  "Run customers, jobs, estimates, invoices, services, and employee time tracking from one polished dashboard built for contractors and service businesses.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "service business software",
    "contractor management software",
    "job management",
    "estimate software",
    "invoice software",
    "employee time tracking",
    "customer management",
    "field service dashboard",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title,
    description,
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
    "Job scheduling",
    "Estimate creation",
    "Invoice generation",
    "Service templates",
    "Employee time tracking",
  ],
};

const features = [
  {
    icon: UsersRound,
    title: "Customers",
    text: "Keep contacts, service locations, notes, and job history close to the work.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Jobs",
    text: "Track every job from unscheduled request to finished work and final balance.",
  },
  {
    icon: FileText,
    title: "Estimates",
    text: "Build line-item estimates with labor, materials, tax, status, and conversion to jobs.",
  },
  {
    icon: ReceiptText,
    title: "Invoices",
    text: "Turn completed work into billing records without rebuilding the same details twice.",
  },
  {
    icon: Hammer,
    title: "Services",
    text: "Save repeatable service templates so pricing and scope stay consistent.",
  },
  {
    icon: CalendarClock,
    title: "Time",
    text: "Give employees a focused portal for clock-ins, clock-outs, and time records.",
  },
];

const metrics = [
  ["20+", "small usability improvements crafted for smoother workflows"],
  ["1", "dashboard for customers, work, billing, and time"],
  ["6", "core workflows built for daily service operations"],
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static JSON-LD for SEO.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-[#f6f1e8] text-[#171412]">
        <section className="relative isolate flex min-h-[88svh] overflow-hidden bg-[#efe6d7]">
          <Image
            src={dashboardImage}
            alt="VadosStack dashboard showing service business operations, jobs, customers, estimates, and invoices"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 -z-20 object-cover object-[86%_top] opacity-90"
          />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#f6f1e8_0%,#f6f1e8_48%,rgba(246,241,232,0.78)_66%,rgba(246,241,232,0.18)_100%)]" />
          <div className="absolute inset-x-0 top-0 z-10">
            <div className="flex w-full items-center justify-between px-5 py-5 md:px-8 lg:px-12 2xl:px-16">
              <Link
                href="/"
                className="flex items-center gap-2 font-semibold text-[#171412]"
                aria-label="VadosStack home"
              >
                <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-6 object-contain" />
                <span>{APP_CONFIG.name}</span>
              </Link>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="border-[#171412]/20 bg-[#f6f1e8]/75">
                  <Link href="/employee-time-tracking">
                    <HardHat />
                    Employee portal
                  </Link>
                </Button>
                <Button asChild size="sm" className="bg-[#171412] text-[#f6f1e8] hover:bg-[#171412]/90">
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex w-full items-center px-5 pt-28 pb-20 md:px-8 md:pb-16 lg:px-12 2xl:px-16">
            <div className="grid w-full gap-16 sm:gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1.15fr)] lg:items-end">
              <div className="max-w-3xl animate-[landing-rise_700ms_ease-out_both]">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#171412]/15 bg-[#f6f1e8]/80 px-3 py-1 text-[#594431] text-sm shadow-sm backdrop-blur">
                  <Sparkles className="size-4 text-[#b84a2b]" />
                  Built for service businesses that live in the details
                </div>
                <h1 className="text-balance font-semibold text-5xl leading-[0.95] tracking-normal md:text-7xl">
                  VadosStack
                </h1>
                <p className="mt-5 max-w-2xl text-[#3d352f] text-lg leading-8 md:text-lg 2xl:text-xl">
                  A polished command center for contractors and service teams: customers, jobs, estimates, invoices,
                  services, and employee time tracking in one focused workspace.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="bg-[#171412] text-[#f6f1e8] hover:bg-[#171412]/90">
                    <Link href="/register">
                      Start building your workspace
                      <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-[#171412]/20 bg-[#f6f1e8]/80">
                    <Link href="/login">Sign in to dashboard</Link>
                  </Button>
                </div>
              </div>

              <div
                className="w-full max-w-[360px] animate-[landing-rise_900ms_ease-out_both] rounded-[2rem] border border-[#171412]/10 bg-white/32 p-3 shadow-[0_24px_80px_rgba(59,36,27,0.16)] backdrop-blur-md sm:max-w-[400px] lg:ml-auto lg:max-w-[380px]"
                style={{ animationDelay: "140ms" }}
              >
                <div className="rounded-[1.6rem] border border-white/40 bg-[radial-gradient(circle_at_30%_35%,rgba(173,106,255,0.42),transparent_32%),radial-gradient(circle_at_70%_38%,rgba(104,135,255,0.42),transparent_30%),linear-gradient(145deg,rgba(246,241,232,0.88),rgba(246,241,232,0.38))] p-5 sm:p-6">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#171412]/10 bg-white/55 px-3 py-1 text-[#594431] text-xs uppercase tracking-[0.22em]">
                    <span className="h-2 w-2 rounded-full bg-[#7f5cff]" />
                    The vados way
                  </div>
                  <Image
                    src={vadosstackLogo}
                    alt="VadosStack logo"
                    className="mx-auto h-auto w-full max-w-[300px] object-contain drop-shadow-[0_26px_50px_rgba(109,80,255,0.28)] sm:max-w-[330px]"
                    priority
                  />
                  <p className="mt-4 max-w-sm text-[#594431] text-sm leading-6">
                    Built for reliability, powered by real support whenever you need it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Product highlights" className="border-[#171412]/10 border-y bg-[#171412] text-[#f6f1e8]">
          <div className="grid w-full gap-px bg-[#f6f1e8]/10 md:grid-cols-3">
            {metrics.map(([value, label]) => (
              <div key={value} className="bg-[#171412] px-5 py-6 md:px-8 lg:px-12 2xl:px-16">
                <div className="font-semibold text-3xl text-[#f5c451]">{value}</div>
                <div className="mt-2 max-w-xs text-[#f6f1e8]/72 text-sm leading-6">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#f6f1e8] px-5 py-20 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="workflows-title">
          <div className="w-full">
            <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
              <div>
                <p className="font-medium text-[#b84a2b] text-sm uppercase tracking-normal">Operational flow</p>
                <h2
                  id="workflows-title"
                  className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl"
                >
                  The daily work, stitched into one place.
                </h2>
              </div>
              <p className="max-w-2xl text-[#594431] text-lg leading-8">
                VadosStack is shaped around the real rhythm of a service business: capture the customer, price the
                request, schedule the job, finish the work, bill it, and keep the team moving.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="animate-[landing-rise_700ms_ease-out_both] rounded-lg border border-[#171412]/10 bg-white p-5 shadow-sm"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <div className="grid size-10 place-items-center rounded-lg bg-[#e2f0df] text-[#24533d]">
                        <Icon className="size-5" />
                      </div>
                      <BadgeCheck className="size-5 text-[#b84a2b]" />
                    </div>
                    <h3 className="font-semibold text-xl">{feature.title}</h3>
                    <p className="mt-3 text-[#594431] text-sm leading-6">{feature.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#dfe8e2] px-5 py-20 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="portal-title">
          <div className="grid w-full gap-10 md:grid-cols-[1fr_0.8fr] md:items-center">
            <div>
              <p className="font-medium text-[#24533d] text-sm uppercase tracking-normal">Employee portal</p>
              <h2 id="portal-title" className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl">
                A simpler doorway for the crew.
              </h2>
              <p className="mt-5 max-w-2xl text-[#31443b] text-lg leading-8">
                Employees do not need the full dashboard to get time captured. Send them to a focused portal built for
                quick check-ins and clean time records.
              </p>
            </div>
            <div className="rounded-lg border border-[#24533d]/15 bg-[#f9fbf7] p-5 shadow-sm">
              <div className="flex items-center gap-3 border-[#24533d]/10 border-b pb-4">
                <div className="grid size-11 place-items-center rounded-lg bg-[#24533d] text-white">
                  <HardHat className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Crew access</div>
                  <div className="text-[#31443b]/70 text-sm">Fast, separate, and field-friendly.</div>
                </div>
              </div>
              <Button asChild size="lg" className="mt-5 w-full bg-[#24533d] text-white hover:bg-[#1d4331]">
                <Link href="/employee-time-tracking">
                  Open employee portal
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-[#171412] px-5 py-20 text-[#f6f1e8] md:px-8 lg:px-12 2xl:px-16">
          <div className="grid w-full gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <ShieldCheck className="mb-5 size-9 text-[#f5c451]" />
              <h2 className="text-balance font-semibold text-4xl tracking-normal md:text-5xl">
                Ready when your live site is.
              </h2>
              <p className="mt-5 max-w-2xl text-[#f6f1e8]/72 text-lg leading-8">
                A public front door for the product, direct sign-in for customers, and a dedicated route for employees.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-[#f5c451] text-[#171412] hover:bg-[#f5c451]/90">
                <Link href="/register">Create account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-[#f6f1e8]/25 bg-transparent text-[#f6f1e8]">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <style>{`
        @keyframes landing-rise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [class*="landing-rise"] {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}
