import Image from "next/image";
import Link from "next/link";

import { ArrowRight, Check, ClipboardCheck, Clock3, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

import vadosstackLogoSmall from "../../../media/vadosstack-logo-transparent-small.png";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vadosstack.com";
const title = "Employee Time Tracking Software for Service Businesses";
const description =
  "Track employee hours, connect time to service jobs, and review employee-submitted changes from one VadosStack workspace.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/time-tracking`,
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: `${siteUrl}/time-tracking`,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const benefits = [
  {
    icon: Clock3,
    title: "Weekly hours in view",
    copy: "See daily entries, weekly totals, and recent employee activity without assembling a separate spreadsheet.",
  },
  {
    icon: ClipboardCheck,
    title: "Manager-reviewed changes",
    copy: "Employees submit additions, edits, and deletions for approval before the official timesheet changes.",
  },
  {
    icon: ShieldCheck,
    title: "Private employee access",
    copy: "Employees use a dedicated portal with revocable sessions and access limited to their own time records.",
  },
] as const;

const faq = [
  {
    question: "Can employees enter their own time?",
    answer:
      "Yes. Employees can securely access the employee portal, review their weekly hours, and submit new time or corrections for manager approval.",
  },
  {
    question: "Can time be connected to customer jobs?",
    answer:
      "Yes. Time entries can be associated with active service jobs so managers can review labor in the context of the work performed.",
  },
  {
    question: "Do employee changes update timesheets immediately?",
    answer:
      "No. Employee-submitted additions, edits, and deletions stay pending until a manager approves or rejects the request.",
  },
] as const;

export default function TimeTrackingMarketingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-[#303030] selection:bg-[#6f78f7] selection:text-white">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Static JSON-LD assembled from local constants for SEO.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="border-black/5 border-b bg-[#f7f5ff]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link
            href="/"
            aria-label="VadosStack home"
            className="inline-flex items-center gap-2.5 font-semibold text-xl tracking-[-0.03em]"
          >
            <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-8 object-contain" priority />
            VadosStack
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/employee-portal" className="hidden text-sm hover:text-[#6f78f7] sm:block">
              Employee Portal
            </Link>
            <Button
              asChild
              className="rounded-full bg-gradient-to-r from-[#9365f4] to-[#6877ef] px-6 text-white hover:brightness-95"
            >
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#f7f5ff]">
        <div
          className="absolute -right-48 -bottom-72 -z-10 size-[760px] rounded-full bg-[repeating-radial-gradient(circle,rgba(116,99,241,0.08)_0_1px,transparent_1px_8px)]"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div>
            <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">Employee time tracking</p>
            <h1 className="mt-4 max-w-2xl font-semibold text-[clamp(2.65rem,5vw,4.5rem)] leading-[1.02] tracking-[-0.045em]">
              Crew hours connected to the work.
            </h1>
            <p className="mt-6 max-w-xl text-[#5f5f67] text-lg leading-8">
              Give employees a focused place to review and submit time while managers keep control of every approved
              change.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-gradient-to-r from-[#9365f4] to-[#6877ef] px-7 text-white hover:brightness-95"
              >
                <Link href="/register">
                  Start with VadosStack
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full bg-white px-7">
                <Link href="/employee-portal">Open Employee Portal</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white p-2 shadow-[0_30px_90px_rgba(49,43,88,0.18)]">
            <Image
              src="/landing/vadosstack-time-tracking.png"
              alt="VadosStack employee time tracking dashboard with weekly hours and pending time reviews"
              width={1440}
              height={900}
              priority
              className="h-auto w-full rounded-[1.3rem]"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="time-benefits-heading" className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <div className="max-w-2xl">
          <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">Built for service teams</p>
          <h2 id="time-benefits-heading" className="mt-3 font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
            Less chasing. Cleaner timesheets.
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title: benefitTitle, copy }) => (
            <article key={benefitTitle} className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
              <span className="grid size-12 place-items-center rounded-2xl bg-[#efedff] text-[#6f78f7]">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 font-semibold text-xl">{benefitTitle}</h3>
              <p className="mt-3 text-[#68686f] leading-7">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="time-workflow-heading" className="bg-[#303030] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-medium text-[#b9b3ff] text-sm uppercase tracking-[0.12em]">A controlled workflow</p>
            <h2 id="time-workflow-heading" className="mt-3 font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
              Employees submit. Managers decide.
            </h2>
          </div>
          <div className="grid gap-4">
            {[
              "Employees review their own weekly records.",
              "New time and corrections enter a pending queue.",
              "Approved requests update the official timesheet atomically.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#6f78f7]">
                  <Check className="size-3.5" />
                </span>
                <p className="text-white/80 leading-6">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="time-faq-heading" className="mx-auto max-w-4xl px-5 py-20 md:px-8">
        <h2 id="time-faq-heading" className="text-center font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
          Time tracking FAQs
        </h2>
        <div className="mt-10 grid gap-4">
          {faq.map((item) => (
            <article key={item.question} className="rounded-2xl border border-black/8 p-6">
              <h3 className="font-semibold text-lg">{item.question}</h3>
              <p className="mt-2 text-[#68686f] leading-7">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
