"use client";

import { useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  FileText,
  Hammer,
  HardHat,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

import vadosstackLogoSmall from "../../../../media/vadosstack-logo-transparent-small.png";

const features = [
  {
    icon: UsersRound,
    title: "Customers",
    text: "Keep contacts, service locations, notes, and job history close to the work.",
    stat: "Full history",
    tone: "bg-[#e8f5f0] text-[#24533d]",
  },
  {
    icon: BriefcaseBusiness,
    title: "Jobs",
    text: "Track every job from unscheduled request to finished work and final balance.",
    stat: "Live status",
    tone: "bg-[#eef3ff] text-[#24436f]",
  },
  {
    icon: FileText,
    title: "Estimates",
    text: "Build line-item estimates with labor, materials, tax, status, and conversion to jobs.",
    stat: "Reusable pricing",
    tone: "bg-[#fff0e7] text-[#8b3e28]",
  },
  {
    icon: ReceiptText,
    title: "Invoices",
    text: "Turn completed work into billing records without rebuilding the same details twice.",
    stat: "Clean billing",
    tone: "bg-[#f7f1ff] text-[#634299]",
  },
  {
    icon: Hammer,
    title: "Services",
    text: "Save repeatable service templates so pricing and scope stay consistent.",
    stat: "Templates",
    tone: "bg-[#fff8d8] text-[#6a5620]",
  },
  {
    icon: CalendarClock,
    title: "Time",
    text: "Give employees a focused portal for clock-ins, clock-outs, and time records.",
    stat: "Crew portal",
    tone: "bg-[#eaf7f8] text-[#1e5a63]",
  },
];

const metrics = [
  ["1", "dashboard for customers, work, billing, and time"],
  ["6", "core workflows built for daily service operations"],
  ["24/7", "self-serve access for crews that only need time tracking"],
  ["PDF", "estimate and invoice exports ready for customer records"],
];

const workflowTabs = [
  {
    title: "Estimate",
    eyebrow: "Price the request",
    copy: "Build polished estimates with consistent labor, material, tax, and service line details before the job ever hits the calendar.",
    rows: ["Customer and location attached", "Reusable service templates", "Status ready for follow-up"],
    metric: "$8.4k",
    metricLabel: "open estimate value",
  },
  {
    title: "Schedule",
    eyebrow: "Move the work",
    copy: "Keep jobs organized around the people doing them, with the details nearby and the next step easy to see.",
    rows: ["Job scope in one place", "Upcoming work visible", "Team handoff stays clear"],
    metric: "12",
    metricLabel: "jobs in motion",
  },
  {
    title: "Invoice",
    eyebrow: "Finish cleanly",
    copy: "Turn completed work into billing records without retyping the operational details that already exist in the system.",
    rows: ["Balanced job records", "Invoice-ready details", "Customer history preserved"],
    metric: "98%",
    metricLabel: "records ready to bill",
  },
];

const industryLabels = ["HVAC", "Plumbing", "Electrical", "Landscaping", "Cleaning", "Remodeling"];

const heroRevenueBars = [
  { height: 34, id: "mon" },
  { height: 48, id: "tue" },
  { height: 42, id: "wed" },
  { height: 66, id: "thu" },
  { height: 58, id: "fri" },
  { height: 86, id: "sat" },
  { height: 78, id: "sun" },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

function MotionSection({
  children,
  className,
  "aria-labelledby": ariaLabelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-labelledby"?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section
      aria-labelledby={ariaLabelledBy}
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-120px" }}
      variants={stagger}
    >
      {children}
    </motion.section>
  );
}

function HeroPreview() {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.35], [0, reducedMotion ? 0 : -28]);

  return (
    <motion.div
      className="relative w-full max-w-[560px] lg:ml-auto"
      initial={reducedMotion ? false : { opacity: 0, x: 34, rotate: 0.6 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      style={{ y }}
    >
      <motion.div
        className="absolute top-10 -left-6 z-10 hidden w-[240px] rounded-2xl border border-[#171412]/10 bg-white p-4 shadow-[0_24px_70px_rgba(47,47,47,0.12)] md:block"
        initial={reducedMotion ? false : { opacity: 0, x: -18, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.48, duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">Send estimate</span>
          <span className="rounded-full bg-[#4d89dc] px-3 py-1 text-white text-xs">Send</span>
        </div>
        <div className="mt-4 grid gap-2">
          {[
            ["HVAC tune-up", "$425"],
            ["Pipe repair", "$780"],
            ["Electrical visit", "$350"],
          ].map(([item, price]) => (
            <div key={item} className="flex items-center justify-between rounded-lg bg-[#f6f8fb] px-3 py-2 text-xs">
              <span className="text-[#3d352f]">{item}</span>
              <span className="font-semibold">{price}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="absolute right-3 bottom-8 z-10 hidden w-[250px] rounded-2xl border border-[#171412]/10 bg-white p-4 shadow-[0_24px_70px_rgba(47,47,47,0.12)] sm:block"
        initial={reducedMotion ? false : { opacity: 0, x: 18, y: 16 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.62, duration: 0.5 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[#594431] text-xs uppercase">Jobs</div>
            <div className="mt-1 font-semibold text-4xl">12</div>
          </div>
          <span className="rounded-full bg-[#e8f5f0] px-3 py-1 text-[#24533d] text-xs">This week</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-[#171412]/10 border-t pt-4 text-xs">
          <div>
            <div className="text-[#594431]">Open value</div>
            <div className="mt-1 font-semibold">$8.4k</div>
          </div>
          <div>
            <div className="text-[#594431]">Ready to bill</div>
            <div className="mt-1 font-semibold">5</div>
          </div>
        </div>
      </motion.div>

      <div className="overflow-hidden rounded-[1.75rem] border border-[#171412]/10 bg-white shadow-[0_30px_100px_rgba(47,47,47,0.14)]">
        <div className="flex items-center justify-between bg-[#4d89dc] px-4 py-3 text-white">
          <div className="flex items-center gap-2 font-semibold">
            <Image
              src={vadosstackLogoSmall}
              alt=""
              aria-hidden="true"
              className="h-auto w-5 object-contain brightness-0 invert"
            />
            VadosStack
          </div>
          <div className="hidden items-center gap-4 text-xs opacity-90 sm:flex">
            <span>Customers</span>
            <span>Jobs</span>
            <span>Invoices</span>
          </div>
        </div>
        <div className="bg-[#f6f8fb] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_0.85fr]">
            <div className="rounded-2xl border border-[#171412]/8 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[#594431] text-xs uppercase">Today</div>
                  <div className="mt-1 font-semibold text-xl">Field schedule</div>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-[#e8f5f0] text-[#24533d]">
                  <Check className="size-4" />
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {["Estimate approved", "Crew dispatched", "Invoice drafted"].map((item, index) => (
                  <motion.div
                    key={item}
                    className="flex items-center gap-3 rounded-xl bg-[#f6f8fb] px-3 py-3 text-sm"
                    initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.36 + index * 0.1, duration: 0.42 }}
                  >
                    <span className="size-2 rounded-full bg-[#d9443c]" />
                    <span className="font-medium">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-[#171412]/8 bg-white p-4 shadow-sm">
                <div className="text-[#594431] text-xs uppercase">Revenue</div>
                <div className="mt-1 font-semibold text-2xl">$18,420</div>
                <div className="mt-5 flex h-24 items-end gap-2">
                  {heroRevenueBars.map((bar, index) => (
                    <motion.span
                      key={bar.id}
                      className="flex-1 rounded-t-lg bg-[#24533d]/75"
                      initial={reducedMotion ? false : { height: 8 }}
                      animate={{ height: bar.height }}
                      transition={{ delay: 0.4 + index * 0.05, duration: 0.45 }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#171412]/8 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Crew time</span>
                  <span className="rounded-full bg-[#f7f0f0] px-3 py-1 text-[#d9443c] text-xs">Live</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-[#edf0f3]">
                  <motion.div
                    className="h-2 rounded-full bg-[#d9443c]"
                    initial={reducedMotion ? false : { width: "28%" }}
                    animate={{ width: "72%" }}
                    transition={{ delay: 0.58, duration: 0.7 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProductMockup({
  active,
  reducedMotion,
}: {
  active: (typeof workflowTabs)[number];
  reducedMotion: boolean | null;
}) {
  return (
    <div className="relative">
      <motion.div
        className="absolute -top-7 right-8 z-10 hidden rounded-2xl border border-[#171412]/10 bg-white px-5 py-4 shadow-[0_22px_70px_rgba(47,47,47,0.12)] md:block"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[#594431] text-xs uppercase">This week</div>
        <div className="mt-1 font-semibold text-3xl">{active.metric}</div>
        <div className="text-[#24533d] text-sm">{active.metricLabel}</div>
      </motion.div>

      <div className="overflow-hidden rounded-[1.5rem] border border-[#171412]/10 bg-white shadow-[0_28px_90px_rgba(47,47,47,0.12)]">
        <div className="flex items-center justify-between bg-[#4d89dc] px-4 py-3 text-white">
          <div className="flex items-center gap-2 font-semibold">
            <Image
              src={vadosstackLogoSmall}
              alt=""
              aria-hidden="true"
              className="h-auto w-5 object-contain brightness-0 invert"
            />
            VadosStack
          </div>
          <div className="hidden items-center gap-5 text-xs opacity-90 md:flex">
            <span>Customers</span>
            <span>Jobs</span>
            <span>Estimates</span>
            <span>Invoices</span>
          </div>
        </div>
        <div className="grid min-h-[360px] bg-[#f6f8fb] md:grid-cols-[220px_1fr]">
          <div className="hidden border-[#171412]/10 border-r bg-white p-4 md:block">
            <div className="mb-4 text-[#594431] text-xs uppercase">Workspace</div>
            {workflowTabs.map((tab) => (
              <div
                key={tab.title}
                className={`mb-2 rounded-lg px-3 py-2 text-sm ${
                  tab.title === active.title ? "bg-[#edf4ff] font-semibold text-[#24436f]" : "text-[#594431]"
                }`}
              >
                {tab.title}
              </div>
            ))}
          </div>
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-[#594431] text-sm">{active.eyebrow}</div>
                <div className="font-semibold text-2xl">{active.title} board</div>
              </div>
              <span className="w-fit rounded-full bg-[#e8f5f0] px-3 py-1 font-medium text-[#24533d] text-xs">
                Live status
              </span>
            </div>
            <div className="grid gap-3">
              {active.rows.map((row, index) => (
                <motion.div
                  key={row}
                  className="grid gap-3 rounded-xl border border-[#171412]/8 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto]"
                  initial={reducedMotion ? false : { opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.35 }}
                >
                  <div>
                    <div className="font-medium">{row}</div>
                    <div className="mt-1 h-2 w-full max-w-[260px] rounded-full bg-[#edf0f3]">
                      <div className="h-2 rounded-full bg-[#4d89dc]" style={{ width: `${74 + index * 7}%` }} />
                    </div>
                  </div>
                  <BadgeCheck className="size-5 text-[#24533d]" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingExperience() {
  const [activeWorkflow, setActiveWorkflow] = useState(0);
  const reducedMotion = useReducedMotion();
  const active = workflowTabs[activeWorkflow];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f1e8] text-[#171412]">
      <section className="relative isolate flex min-h-[88svh] overflow-hidden bg-[#efe6d7]">
        <Image
          src="/vadosstack-dashboard-preview.svg"
          alt="VadosStack dashboard showing service business operations, jobs, customers, estimates, and invoices"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-[86%_top] opacity-30 md:opacity-90"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#f6f1e8_0%,#f6f1e8_46%,rgba(246,241,232,0.78)_68%,rgba(246,241,232,0.18)_100%)]" />
        <div className="absolute inset-x-0 top-0 z-10">
          <motion.div
            className="mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-[1376px] items-center justify-between rounded-full border border-[#171412]/10 bg-[#f6f1e8]/78 px-4 py-3 shadow-[0_16px_60px_rgba(59,36,27,0.1)] backdrop-blur md:px-5"
            initial={reducedMotion ? false : { opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-[#171412]"
              aria-label="VadosStack home"
            >
              <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-6 object-contain" />
              <span>{APP_CONFIG.name}</span>
            </Link>
            <nav aria-label="Landing navigation" className="hidden items-center gap-7 text-[#3d352f] text-sm lg:flex">
              <a href="#features" className="transition-colors hover:text-[#d9443c]">
                Features
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-[#d9443c]">
                How it works
              </a>
              <Link href="/employee-time-tracking" className="transition-colors hover:text-[#d9443c]">
                Crew portal
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden border-[#171412]/20 bg-white/55 sm:inline-flex"
              >
                <Link href="/employee-time-tracking">
                  <HardHat />
                  Employee portal
                </Link>
              </Button>
              <Button asChild size="sm" className="rounded-full bg-[#d9443c] text-white hover:bg-[#c53b35]">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="mx-auto flex w-full max-w-[1376px] items-center px-5 pt-28 pb-20 md:px-8 lg:px-12 2xl:px-16">
          <div className="grid w-full gap-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.78fr)] lg:items-end">
            <motion.div
              className="max-w-3xl"
              initial={reducedMotion ? false : "hidden"}
              animate="visible"
              variants={stagger}
            >
              <motion.div
                variants={reveal}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#171412]/15 bg-[#f6f1e8]/80 px-3 py-1 text-[#594431] text-sm shadow-sm backdrop-blur"
              >
                <Sparkles className="size-4 text-[#d9443c]" />
                Built for businesses that live in the details
              </motion.div>
              <motion.h1
                variants={reveal}
                className="max-w-3xl text-balance font-semibold text-4xl leading-[1.02] tracking-normal md:text-6xl"
              >
                <span className="mb-3 block font-semibold text-[#d9443c] text-base uppercase">VadosStack</span> Field
                service management software for service businesses.
              </motion.h1>
              <motion.p
                variants={reveal}
                className="mt-5 max-w-2xl text-[#3d352f] text-lg leading-8 md:text-lg 2xl:text-xl"
              >
                Field service software for contractors and service teams that need customer management, job tracking,
                estimate creation, invoice records, service templates, and employee time tracking in one focused
                workspace.
              </motion.p>
              <motion.div variants={reveal} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-full bg-[#d9443c] text-white hover:bg-[#c53b35]">
                  <Link href="/register">
                    Start building your workspace
                    <ArrowRight />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="rounded-full border-[#171412]/20 bg-[#f6f1e8]/80"
                >
                  <Link href="/login">Sign in to dashboard</Link>
                </Button>
              </motion.div>
              <motion.div
                variants={reveal}
                className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[#594431] text-sm"
                aria-label="Hero workflow highlights"
              >
                {["Estimate creation", "Job order management", "Customer records"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Check className="size-4 text-[#24533d]" />
                    {item}
                  </span>
                ))}
              </motion.div>
            </motion.div>

            <HeroPreview />
          </div>
        </div>
      </section>

      <MotionSection className="relative z-10 -mt-16 px-5 md:px-8 lg:px-12 2xl:px-16">
        <motion.div
          variants={reveal}
          className="mx-auto grid max-w-[1376px] gap-px overflow-hidden rounded-[2rem] bg-[#171412]/10 shadow-[0_32px_80px_rgba(59,36,27,0.12)] md:grid-cols-4"
        >
          {metrics.map(([value, label]) => (
            <div key={value} className="bg-white px-6 py-7 text-center md:px-8">
              <div className="font-semibold text-4xl text-[#171412]">{value}</div>
              <div className="mx-auto mt-2 max-w-xs text-[#594431] text-sm leading-6">{label}</div>
            </div>
          ))}
        </motion.div>
      </MotionSection>

      <MotionSection className="bg-[#f6f1e8] px-5 pt-16 pb-10 md:px-8 lg:px-12 2xl:px-16">
        <motion.div
          variants={reveal}
          className="mx-auto flex max-w-[1376px] flex-wrap items-center justify-center gap-x-8 gap-y-4 border-[#171412]/10 border-b pb-10 text-center"
        >
          <span className="w-full text-[#594431] text-sm uppercase">Built for field-service teams like</span>
          {industryLabels.map((label) => (
            <span key={label} className="font-semibold text-[#545454] text-xl">
              {label}
            </span>
          ))}
        </motion.div>
      </MotionSection>

      <MotionSection className="bg-white px-5 py-24 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="workflows-title">
        <div id="features" className="scroll-mt-24" />
        <div className="mx-auto w-full max-w-[1376px]">
          <motion.div variants={reveal} className="mx-auto max-w-4xl text-center">
            <p className="font-medium text-[#d9443c] text-sm uppercase tracking-normal">Features</p>
            <h2 id="workflows-title" className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl">
              Top rated field-service workflows, without the clutter.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-[#594431] text-lg leading-8">
              VadosStack follows the rhythm of a service business: capture the customer, price the request, schedule the
              job, finish the work, bill it, and keep the team moving.
            </p>
          </motion.div>

          <motion.div
            variants={reveal}
            className="mt-10 flex gap-8 overflow-x-auto border-[#171412]/10 border-b [scrollbar-width:none] md:justify-center [&::-webkit-scrollbar]:hidden"
          >
            {workflowTabs.map((tab, index) => (
              <button
                key={tab.title}
                type="button"
                className={`relative min-w-fit px-1 pb-4 font-semibold text-lg transition-colors ${
                  activeWorkflow === index ? "text-[#d9443c]" : "text-[#545454] hover:text-[#171412]"
                }`}
                onClick={() => setActiveWorkflow(index)}
              >
                {tab.title}
                {activeWorkflow === index ? (
                  <motion.span
                    layoutId="workflow-tab-underline"
                    className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#d9443c]"
                  />
                ) : null}
              </button>
            ))}
          </motion.div>

          <motion.div variants={reveal} className="mt-12 grid gap-10 lg:grid-cols-[0.38fr_0.62fr] lg:items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${active.title}-copy`}
                initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.32 }}
              >
                <p className="font-medium text-[#d9443c] text-sm uppercase">{active.eyebrow}</p>
                <h3 className="mt-3 font-semibold text-4xl tracking-normal">{active.title} workspace</h3>
                <p className="mt-4 text-[#594431] text-lg leading-8">{active.copy}</p>
                <div className="mt-7 grid gap-3">
                  {active.rows.map((row) => (
                    <div key={row} className="flex items-center gap-3 text-[#3d352f]">
                      <span className="grid size-6 place-items-center rounded-full bg-[#e8f5f0] text-[#24533d]">
                        <Check className="size-3.5" />
                      </span>
                      {row}
                    </div>
                  ))}
                </div>
                <Button asChild size="lg" className="mt-8 rounded-full bg-[#d9443c] text-white hover:bg-[#c53b35]">
                  <Link href="/register">
                    Start your workspace
                    <ArrowRight />
                  </Link>
                </Button>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${active.title}-mockup`}
                initial={reducedMotion ? false : { opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.38 }}
              >
                <ProductMockup active={active} reducedMotion={reducedMotion} />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </MotionSection>

      <MotionSection className="bg-[#f7f8fa] px-5 py-24 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="how-title">
        <div id="how-it-works" className="scroll-mt-24" />
        <div className="mx-auto max-w-[1376px]">
          <motion.div variants={reveal} className="mx-auto max-w-3xl text-center">
            <p className="font-medium text-[#d9443c] text-sm uppercase tracking-normal">How it works</p>
            <h2 id="how-title" className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl">
              From request to paid work in three clear moves.
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {workflowTabs.map((tab, index) => (
              <motion.article
                key={tab.title}
                variants={reveal}
                whileHover={reducedMotion ? undefined : { y: -6 }}
                className="rounded-2xl border border-[#171412]/10 bg-white p-6 shadow-[0_18px_55px_rgba(47,47,47,0.07)]"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="font-semibold text-4xl text-[#d9443c]">{index + 1}</span>
                  <span className="rounded-full bg-[#f7f0f0] px-3 py-1 text-[#d9443c] text-sm">{tab.title}</span>
                </div>
                <h3 className="font-semibold text-2xl">{tab.eyebrow}</h3>
                <p className="mt-4 text-[#594431] leading-7">{tab.copy}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-white px-5 py-24 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="features-title">
        <div className="mx-auto max-w-[1376px]">
          <motion.div variants={reveal} className="mx-auto max-w-3xl text-center">
            <p className="font-medium text-[#24533d] text-sm uppercase tracking-normal">Product coverage</p>
            <h2 id="features-title" className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl">
              Everything the office and field need, organized by the work.
            </h2>
          </motion.div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  variants={reveal}
                  whileHover={reducedMotion ? undefined : { y: -6 }}
                  transition={{ duration: 0.25, delay: index * 0.02 }}
                  className="group rounded-2xl border border-[#171412]/10 bg-white p-5 shadow-[0_18px_55px_rgba(47,47,47,0.06)]"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div className={`grid size-11 place-items-center rounded-xl ${feature.tone}`}>
                      <Icon className="size-5" />
                    </div>
                    <span className="rounded-full border border-[#171412]/10 bg-[#f7f8fa] px-3 py-1 text-[#594431] text-xs transition-colors group-hover:border-[#d9443c]/30 group-hover:text-[#d9443c]">
                      {feature.stat}
                    </span>
                  </div>
                  <h3 className="font-semibold text-xl">{feature.title}</h3>
                  <p className="mt-3 text-[#594431] text-sm leading-6">{feature.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-[#dfe8e2] px-5 py-24 md:px-8 lg:px-12 2xl:px-16" aria-labelledby="portal-title">
        <div className="mx-auto grid max-w-[1376px] gap-10 md:grid-cols-[1fr_0.8fr] md:items-center">
          <motion.div variants={reveal}>
            <p className="font-medium text-[#24533d] text-sm uppercase tracking-normal">Employee portal</p>
            <h2 id="portal-title" className="mt-3 text-balance font-semibold text-4xl tracking-normal md:text-5xl">
              A simpler doorway for the crew.
            </h2>
            <p className="mt-5 max-w-2xl text-[#31443b] text-lg leading-8">
              Employees do not need the full dashboard to get time captured. Send them to a focused portal built for
              quick check-ins and clean time records.
            </p>
          </motion.div>
          <motion.div
            variants={reveal}
            whileHover={reducedMotion ? undefined : { y: -4 }}
            className="rounded-2xl border border-[#24533d]/15 bg-[#f9fbf7] p-5 shadow-[0_24px_70px_rgba(36,83,61,0.12)]"
          >
            <div className="flex items-center gap-3 border-[#24533d]/10 border-b pb-4">
              <div className="grid size-11 place-items-center rounded-xl bg-[#24533d] text-white">
                <HardHat className="size-5" />
              </div>
              <div>
                <div className="font-semibold">Crew access</div>
                <div className="text-[#31443b]/70 text-sm">Fast, separate, and field-friendly.</div>
              </div>
            </div>
            <Button asChild size="lg" className="mt-5 w-full rounded-full bg-[#24533d] text-white hover:bg-[#1d4331]">
              <Link href="/employee-time-tracking">
                Open employee portal
                <ArrowRight />
              </Link>
            </Button>
          </motion.div>
        </div>
      </MotionSection>

      <section className="bg-[#171412] px-5 py-20 text-[#f6f1e8] md:px-8 lg:px-12 2xl:px-16">
        <div className="mx-auto w-full max-w-[1376px]">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
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
              <Button asChild size="lg" className="rounded-full bg-[#f5c451] text-[#171412] hover:bg-[#f5c451]/90">
                <Link href="/register">Create account</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-[#f6f1e8]/25 bg-transparent text-[#f6f1e8]"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-3 border-[#f6f1e8]/12 border-t pt-6 text-[#f6f1e8]/60 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>{APP_CONFIG.copyright}</p>
            <nav aria-label="Legal links" className="flex gap-4">
              <Link href="/privacy" className="transition-colors hover:text-[#f6f1e8]">
                Privacy
              </Link>
              <Link href="/terms" className="transition-colors hover:text-[#f6f1e8]">
                Terms
              </Link>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
