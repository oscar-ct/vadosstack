"use client";

import { useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  ShoppingCart,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

import vadosstackLogoSmall from "../../../../media/vadosstack-logo-transparent-small.png";

const heroViews = [
  { label: "Command Center.", type: "service" },
  { label: "Estimate Pipeline.", type: "estimates" },
  { label: "Orders + Inventory.", type: "orders" },
] as const;

const productFeatures = [
  {
    title: "Command Center",
    eyebrow: "Service operations",
    heading: "A Service Business Command Center",
    copy: "See cash flow, work in motion, estimate momentum, customer concentration, and operational health from one service-first dashboard.",
    bullets: ["Revenue and receivables", "Active jobs and scheduled work", "Estimate and time-review signals"],
    type: "service",
  },
  {
    title: "Estimates",
    eyebrow: "Estimate pipeline",
    heading: "Move Estimates From Draft to Decision",
    copy: "Track draft, ready, waiting, won, and lost estimates so your team knows what needs to be written, sent, followed up, or converted to a job.",
    bullets: ["Pipeline by estimate status", "Customer decision follow-up", "Convert won work into jobs"],
    type: "estimates",
  },
  {
    title: "Customers",
    eyebrow: "One customer record",
    heading: "Customer Management",
    copy: "Keep customer records connected to jobs, estimates, invoices, billing status, service dates, and order history.",
    bullets: ["Customer and billing status", "Job and service history", "Work and order modes"],
    type: "customers",
  },
  {
    title: "Invoices",
    eyebrow: "Service billing",
    heading: "Invoices and Receivables",
    copy: "Turn completed work into clean invoice records with totals, paid amounts, balances, due dates, and export-ready customer documents.",
    bullets: ["Invoice index and due dates", "Paid and balance tracking", "Customer-ready exports"],
    type: "invoices",
  },
  {
    title: "Orders",
    eyebrow: "Built-in commerce",
    heading: "Order Management",
    copy: "Create order records when service customers also buy products, parts, kits, or stock that needs payment and fulfillment tracking.",
    bullets: ["Payment and fulfillment status", "Shipping and tracking details", "Returns, refunds, and receipts"],
    type: "orders",
  },
  {
    title: "Inventory + Pulse",
    eyebrow: "Commerce visibility",
    heading: "Inventory and Commerce Pulse",
    copy: "Track stock movement, low inventory, product sales, returns, fulfillment, and product performance alongside the service business.",
    bullets: ["Stock and reorder signals", "Sales and return reporting", "Top products and inventory health"],
    type: "analytics",
  },
] as const;

const industries = ["HVAC", "PLUMBING", "ELECTRICAL", "CONTRACTORS", "REPAIR", "PRODUCT + SERVICE"];

const proofMetrics = [
  ["3", "Workspace Modes"],
  ["15+", "Connected Tools"],
  ["4", "Reporting Windows"],
  ["1", "Unified Customer History"],
] as const;

const capabilityCards = [
  {
    icon: UsersRound,
    title: "Customer operations",
    copy: "Leads, customers, service locations, notes, follow-up, and history in one place.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Field service",
    copy: "Calendar, jobs, estimates, invoices, service templates, employees, and time tracking.",
  },
  {
    icon: ShoppingCart,
    title: "Commerce add-ons",
    copy: "Orders, inventory, returns, refunds, and product reporting for teams that also sell parts or products.",
  },
] as const;

const faqs = [
  {
    question: "What is VadosStack?",
    answer:
      "VadosStack is web-based field service business software with built-in commerce tools. It connects customers, leads, jobs, estimates, invoices, employee time, orders, inventory, and reporting in one dashboard.",
  },
  {
    question: "Who is VadosStack built for?",
    answer:
      "VadosStack is built primarily for service businesses such as HVAC, plumbing, electrical, repair, contractors, and product-plus-service teams that need customer work, billing, and operations in one place.",
  },
  {
    question: "Does VadosStack support estimates, jobs, and invoices?",
    answer:
      "Yes. Teams can manage estimate records, job records, invoice records, customer documents, email history, and service workflow status from the dashboard.",
  },
  {
    question: "Can service businesses also manage orders and inventory?",
    answer:
      "Yes. VadosStack includes e-commerce tools for orders, fulfillment, inventory, returns, refunds, stock movement, and Commerce Pulse reporting when the business also sells products or parts.",
  },
] as const;

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function MotionSection({
  children,
  className,
  id,
  labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      aria-labelledby={labelledBy}
      className={className}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={stagger}
    >
      {children}
    </motion.section>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold text-xl tracking-[-0.03em]">
      <Image
        src={vadosstackLogoSmall}
        alt=""
        aria-hidden="true"
        className={`h-auto w-8 object-contain ${inverse ? "brightness-0 invert" : ""}`}
      />
      VadosStack
    </span>
  );
}

const productScreens = {
  service: {
    src: "/landing/vadosstack-command-center.png",
    mobileSrc: "/landing/mobile/vadosstack-command-center-mobile.png",
    alt: "VadosStack Command Center showing service revenue, receivables, waiting estimates, pending reviews, cash flow, and operating pulse",
  },
  timeTracking: {
    src: "/landing/vadosstack-time-tracking.png",
    alt: "VadosStack time tracking screen showing weekly hours, employees, pending time reviews, daily entries, and weekly hour summaries",
  },
  estimates: {
    src: "/landing/vadosstack-estimates.png",
    mobileSrc: "/landing/mobile/vadosstack-estimates-mobile.png",
    alt: "VadosStack estimates screen showing draft, ready, waiting, won, and lost estimate pipeline stages",
  },
  createEstimate: {
    src: "/landing/vadosstack-create-estimate.png",
    alt: "VadosStack create estimate screen showing customer details, service scope, schedule, labor, and material pricing fields",
  },
  customers: {
    src: "/landing/vadosstack-customers.png",
    mobileSrc: "/landing/mobile/vadosstack-customers-mobile.png",
    alt: "VadosStack customers screen showing customer billing status, last scheduled service, and job count",
  },
  invoices: {
    src: "/landing/vadosstack-invoices.png",
    mobileSrc: "/landing/mobile/vadosstack-invoices-mobile.png",
    alt: "VadosStack invoices screen showing invoice dates, customers, job descriptions, totals, paid amounts, and balances",
  },
  invoiceDetail: {
    src: "/landing/vadosstack-invoice-detail.png",
    alt: "VadosStack invoice detail screen showing an invoice, customer billing details, service location, balance due, and document actions",
  },
  orders: {
    src: "/landing/vadosstack-orders.png",
    mobileSrc: "/landing/mobile/vadosstack-orders-mobile.png",
    alt: "VadosStack order management screen showing payment and fulfillment status",
  },
  inventory: {
    src: "/landing/vadosstack-inventory.png",
    alt: "VadosStack inventory management screen showing stock levels, locations, and restock alerts",
  },
  analytics: {
    src: "/landing/vadosstack-commerce-pulse.png",
    mobileSrc: "/landing/mobile/vadosstack-commerce-pulse-mobile.png",
    alt: "VadosStack Commerce Pulse dashboard showing sales, orders, top products, and inventory health",
  },
} as const;

function ProductScreenshot({
  type,
  eager = false,
  className = "",
  showMobileOverlay = false,
}: {
  type: keyof typeof productScreens;
  eager?: boolean;
  className?: string;
  showMobileOverlay?: boolean;
}) {
  const screen = productScreens[type];

  return (
    <div className={`relative ${className}`}>
      <div className="h-full w-full overflow-hidden rounded-[18px] border border-black/10 bg-white shadow-[0_28px_80px_rgba(49,43,88,0.18)]">
        <Image
          src={screen.src}
          alt={screen.alt}
          width={1440}
          height={900}
          priority={eager}
          sizes="(max-width: 768px) 94vw, 620px"
          className="h-full w-full object-cover object-top"
        />
      </div>
      {showMobileOverlay && "mobileSrc" in screen ? (
        <div className="pointer-events-none absolute right-5 bottom-5 hidden w-[24%] min-w-[145px] max-w-[178px] rotate-[2deg] rounded-[2rem] border border-white/70 bg-[#15151d] p-1.5 shadow-[0_22px_55px_rgba(28,24,52,0.32)] md:block lg:right-8 lg:bottom-8">
          <div className="overflow-hidden rounded-[1.55rem] bg-white">
            <Image
              src={screen.mobileSrc}
              alt={`${screen.alt} on a mobile viewport`}
              width={390}
              height={844}
              sizes="190px"
              className="aspect-[390/844] h-full w-full object-cover object-top"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeroCard({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-[14px] border border-black/8 shadow-[0_18px_48px_rgba(49,43,88,0.16)] ${tone === "dark" ? "bg-[#111323]" : "bg-white"} ${className}`}
    >
      {children}
    </div>
  );
}

function StatusPill({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "green" | "gold" }) {
  const toneClass = {
    blue: "bg-[#efefff] text-[#6575ee]",
    green: "bg-[#e9f6ee] text-[#2f694a]",
    gold: "bg-[#fff5dc] text-[#936817]",
  }[tone];

  return <span className={`rounded-full px-2 py-1 font-medium text-[8px] ${toneClass}`}>{children}</span>;
}

function ServiceHeroVisual() {
  return (
    <div className="relative h-[390px] w-[640px]">
      <HeroCard className="top-0 left-[104px] z-30 w-[210px] p-3">
        <div className="flex items-center justify-between text-[#817b76] text-[7px] uppercase tracking-[0.12em]">
          Profile
          <StatusPill>General</StatusPill>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-[#efefff] font-semibold text-[#6575ee] text-[10px]">
            AB
          </span>
          <span>
            <span className="block font-semibold text-[9px]">Avery Brooks</span>
            <span className="text-[#817b76] text-[7px]">LTV: 14 orders</span>
          </span>
        </div>
        <div className="mt-3 grid gap-1.5 rounded-lg bg-[#f8f8fb] p-2 text-[7px]">
          <div className="flex justify-between">
            <span className="text-[#817b76]">Address</span>
            <span className="font-medium">1901 Harbor Ave.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#817b76]">Phone</span>
            <span className="font-medium">(555) 418-2290</span>
          </div>
        </div>
      </HeroCard>

      <HeroCard className="top-[88px] right-0 z-20 w-[264px] p-3">
        <div className="flex items-center justify-between border-black/6 border-b pb-2">
          <div className="font-semibold text-[10px]">Jobs & estimates</div>
          <StatusPill>Today</StatusPill>
        </div>
        <div className="mt-2 grid gap-2">
          {[
            ["Wade Warren", "Scheduled", "Lakewood Village"],
            ["Cash Customer", "Completed", "San Marcos"],
            ["John Smith", "Unscheduled", "Chicago"],
          ].map(([name, status, location], index) => (
            <div key={name} className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-[#f3f3f6] font-semibold text-[8px]">
                {index + 1}
              </span>
              <span>
                <span className="block truncate font-medium text-[8px]">{name}</span>
                <span className="block truncate text-[#817b76] text-[7px]">{location}</span>
              </span>
              <StatusPill tone={status === "Completed" ? "green" : "blue"}>{status}</StatusPill>
            </div>
          ))}
        </div>
      </HeroCard>

      <HeroCard className="top-[168px] left-[20px] z-40 w-[255px] p-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-[10px]">Meeting with Brookline Supply</div>
          <StatusPill tone="gold">10:20</StatusPill>
        </div>
        <div className="mt-2 text-[#817b76] text-[8px]">Today at 9:45 to 10:20 am</div>
        <div className="mt-3 rounded-lg bg-[#6575ee] px-3 py-2 text-center font-semibold text-[8px] text-white">
          Open job notes
        </div>
      </HeroCard>

      <HeroCard className="right-[168px] bottom-0 z-10 w-[394px] p-4">
        <div className="flex items-center justify-between border-black/6 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[#efefff] text-[#6575ee]">
              <CalendarDays className="size-3.5" />
            </span>
            <div>
              <div className="font-semibold text-[11px]">Today&apos;s schedule</div>
              <div className="text-[#817b76] text-[8px]">Friday, July 10</div>
            </div>
          </div>
          <StatusPill>3 active</StatusPill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            ["8:30", "HVAC tune-up", "Avery Stone", "Scheduled"],
            ["11:00", "Water heater diagnostic", "Jordan Brooks", "In progress"],
            ["2:30", "Panel safety inspection", "Riley Chen", "Confirmed"],
            ["4:00", "Inventory drop", "Northline Supply", "Ready"],
          ].map(([time, job, customer, status], index) => (
            <div key={job} className="rounded-lg bg-[#f8f8fb] p-2">
              <span className="font-semibold text-[8px]">{time}</span>
              <span className="mt-1 block">
                <span className="block font-medium text-[8px]">{job}</span>
                <span className="block text-[#817b76] text-[7px]">{customer}</span>
              </span>
              <span className="mt-2 block">
                <StatusPill tone={index === 1 ? "green" : "blue"}>{status}</StatusPill>
              </span>
            </div>
          ))}
        </div>
      </HeroCard>
    </div>
  );
}

function EstimateHeroVisual() {
  return (
    <div className="relative h-[390px] w-[640px]">
      <HeroCard className="top-0 left-[82px] z-20 w-[292px] p-3">
        <div className="flex items-center justify-between border-black/6 border-b pb-3">
          <div className="font-semibold text-[10px]">Send estimate</div>
          <span className="rounded-md bg-[#6575ee] px-5 py-2 font-semibold text-[8px] text-white">Send</span>
        </div>
        <div className="mt-3 grid gap-2">
          {[
            ["Surge protection", "Main panel + subpanel", "$4,280.00", "bg-[#dbf6ef]"],
            ["Water heater upgrade", "Tankless conversion", "$6,150.00", "bg-[#f7dfdf]"],
            ["Maintenance plan", "Quarterly service", "$2,400.00", "bg-[#e7efff]"],
          ].map(([item, detail, price, bg]) => (
            <div key={item} className={`flex items-center justify-between rounded-md p-3 ${bg}`}>
              <span>
                <span className="block font-semibold text-[8px]">{item}</span>
                <span className="text-[#686868] text-[7px]">{detail}</span>
              </span>
              <strong className="text-[8px]">{price}</strong>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-black/6 border-t pt-3 text-[8px]">
          <span className="text-[#817b76]">Pipeline value</span>
          <strong>$12,830</strong>
        </div>
      </HeroCard>

      <HeroCard className="top-[76px] right-0 z-30 w-[255px] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#efefff] font-semibold text-[#6575ee] text-[9px]">
            RC
          </span>
          <span>
            <span className="block font-semibold text-[8px]">Riley Chen is waiting on a decision</span>
            <span className="text-[#817b76] text-[7px]">Tankless water heater upgrade</span>
          </span>
          <StatusPill>Follow up</StatusPill>
        </div>
      </HeroCard>

      <HeroCard className="right-[74px] bottom-0 z-40 w-[312px] p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-[16px]">Estimates</div>
          <StatusPill>This week</StatusPill>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="font-semibold text-[42px] leading-none">3</span>
          <span className="pb-1 font-semibold text-[#3e7b58] text-[13px]">$10,430 waiting</span>
        </div>
        <p className="mt-4 text-[#686868] text-[11px] leading-5">
          You have <span className="font-semibold text-[#6575ee]">2 estimates</span> waiting on customer decisions.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-black/6 border-t pt-3 text-[9px]">
          <span>
            <span className="block text-[#817b76]">Won value</span>
            <strong>$2,400</strong>
          </span>
          <span>
            <span className="block text-[#817b76]">Win rate</span>
            <strong>19%</strong>
          </span>
        </div>
      </HeroCard>

      <HeroCard className="top-[172px] left-0 z-10 w-[235px] p-4">
        <div className="font-semibold text-[11px]">Estimate pipeline</div>
        <div className="mt-3 grid gap-2 text-[8px]">
          {[
            ["Drafts", "0", "bg-[#f3f3f6]"],
            ["Waiting", "2", "bg-[#e7efff]"],
            ["Won", "1", "bg-[#e9f6ee]"],
          ].map(([label, value, bg]) => (
            <div key={label} className={`flex items-center justify-between rounded-md p-2 ${bg}`}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </HeroCard>
    </div>
  );
}

function OrdersHeroVisual() {
  return (
    <div className="relative h-[390px] w-[640px]">
      <HeroCard className="top-0 left-[82px] z-20 w-[288px] p-3">
        <div className="flex items-center justify-between border-black/6 border-b pb-3">
          <div className="font-semibold text-[10px]">Send order</div>
          <span className="rounded-md bg-[#6575ee] px-5 py-2 font-semibold text-[8px] text-white">Send</span>
        </div>
        <div className="mt-3 grid gap-2">
          {[
            ["LED Floodlight Pair", "Coverage Area: 24ft", "$327.00", "bg-[#dbf6ef]"],
            ["Inspection Camera", "Cable length: 30ft", "$249.00", "bg-[#f7dfdf]"],
            ["Smart Thermostat Pro", "Dual zone compatible", "$219.00", "bg-[#e7efff]"],
            ["MERV 11 Filter 3-Pack", "Return size: 20x25", "$89.00", "bg-[#dbf6ef]"],
          ].map(([item, detail, price, bg]) => (
            <div key={item} className={`flex items-center justify-between rounded-md p-3 ${bg}`}>
              <span>
                <span className="block font-semibold text-[8px]">{item}</span>
                <span className="text-[#686868] text-[7px]">{detail}</span>
              </span>
              <strong className="text-[8px]">{price}</strong>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-black/6 border-t pt-3 text-[8px]">
          <span className="text-[#817b76]">Subtotal</span>
          <strong>$884.00</strong>
        </div>
      </HeroCard>

      <HeroCard className="top-[95px] right-0 z-30 w-[250px] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#f3f3f6] font-semibold text-[9px]">JS</span>
          <span>
            <span className="block font-semibold text-[8px]">John Smith has sent you a payment</span>
            <span className="text-[#817b76] text-[7px]">Invoice #02029349 - 06/03/2025</span>
          </span>
          <StatusPill tone="green">Paid</StatusPill>
        </div>
      </HeroCard>

      <HeroCard className="right-[68px] bottom-0 z-40 w-[310px] p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-[16px]">Orders</div>
          <StatusPill>This week</StatusPill>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="font-semibold text-[42px] leading-none">8</span>
          <span className="pb-1 font-semibold text-[#3e7b58] text-[13px]">+700% from prior period</span>
        </div>
        <p className="mt-4 text-[#686868] text-[11px] leading-5">
          You have <span className="font-semibold text-[#6575ee]">8 orders</span> generating $2,058 this month.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-black/6 border-t pt-3 text-[9px]">
          <span>
            <span className="block text-[#817b76]">Total YTD</span>
            <strong>$18,359</strong>
          </span>
          <span>
            <span className="block text-[#817b76]">Returns</span>
            <strong>0</strong>
          </span>
        </div>
      </HeroCard>

      <HeroCard className="top-[174px] left-0 z-10 w-[230px] p-4">
        <div className="flex items-center justify-between border-black/6 border-b pb-3">
          <div className="flex items-center gap-2 font-semibold text-[11px]">
            <ShoppingCart className="size-3.5 text-[#6575ee]" /> Orders
          </div>
          <StatusPill tone="gold">3 need action</StatusPill>
        </div>
        <div className="mt-2 grid gap-1">
          {[
            ["ORD-2408", "$250.74", "Pending"],
            ["ORD-2407", "$295.12", "Paid"],
            ["ORD-2406", "$212.85", "Fulfilled"],
          ].map(([order, total, status]) => (
            <div key={order} className="flex items-center justify-between border-black/5 border-b py-2 text-[8px]">
              <strong>{order}</strong>
              <span className="font-medium">{total}</span>
              <StatusPill tone={status === "Pending" ? "gold" : "green"}>{status}</StatusPill>
            </div>
          ))}
        </div>
      </HeroCard>

      <HeroCard className="top-[20px] left-[375px] z-10 w-[190px] p-4">
        <div className="flex items-center justify-between text-[#817b76] text-[8px] uppercase tracking-[0.12em]">
          Inventory <Boxes className="size-3.5 text-[#6575ee]" />
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="font-semibold text-2xl">30%</span>
          <StatusPill tone="gold">3 restock</StatusPill>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ececf1]">
          <div className="h-full w-[30%] rounded-full bg-gradient-to-r from-[#9365f4] to-[#6877ef]" />
        </div>
      </HeroCard>
    </div>
  );
}

function AnalyticsHeroVisual() {
  return (
    <div className="relative h-[390px] w-[640px]">
      <HeroCard className="top-0 left-[72px] z-10 w-[420px] p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[11px]">Sales overview</span>
          <StatusPill>This month</StatusPill>
        </div>
        <svg
          viewBox="0 0 340 130"
          role="img"
          aria-label="Sales trend increasing across July"
          className="mt-3 h-[132px] w-full"
        >
          <title>Sales trend increasing across July</title>
          <path d="M8 104H332M8 70H332M8 36H332" fill="none" stroke="#ececf1" strokeWidth="1" />
          <path
            d="M10 96 L48 76 L86 84 L124 112 L162 62 L200 28 L238 83 L276 112 L330 70"
            fill="none"
            stroke="#6877ef"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <path
            d="M10 96 L48 76 L86 84 L124 112 L162 62 L200 28 L238 83 L276 112 L330 70 L330 126 L10 126 Z"
            fill="url(#sales-fill)"
            opacity="0.22"
          />
          <defs>
            <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#9365f4" />
              <stop offset="1" stopColor="#9365f4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <div className="grid grid-cols-3 gap-2 border-black/6 border-t pt-3 text-[8px]">
          <span>
            <span className="block text-[#817b76]">Net sales</span>
            <strong>$2,058.83</strong>
          </span>
          <span>
            <span className="block text-[#817b76]">Orders</span>
            <strong>8</strong>
          </span>
          <span>
            <span className="block text-[#817b76]">Units sold</span>
            <strong>26</strong>
          </span>
        </div>
      </HeroCard>

      <HeroCard className="top-[58px] right-0 z-30 w-[205px] p-4">
        <div className="text-[#817b76] text-[8px] uppercase tracking-[0.12em]">Gross sales</div>
        <div className="mt-2 font-semibold text-2xl">$2,058.83</div>
        <div className="mt-1 text-[#3e7b58] text-[8px]">+707% vs previous period</div>
      </HeroCard>

      <HeroCard tone="dark" className="bottom-[42px] left-0 z-40 w-[224px] p-4 text-white">
        <div className="text-[8px] text-white/60 uppercase tracking-[0.12em]">Inventory readiness</div>
        <div className="mt-2 font-semibold text-4xl">
          30<span className="text-lg text-white/40">%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[30%] rounded-full bg-[#7fe1a0]" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[7px] text-white/65">
          <span>11 stock</span>
          <span>6 low</span>
          <span>3 out</span>
        </div>
      </HeroCard>

      <HeroCard className="right-[34px] bottom-0 z-20 w-[285px] p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[10px]">Top products</span>
          <StatusPill tone="green">67% of sales</StatusPill>
        </div>
        <div className="mt-3 grid gap-2 text-[8px]">
          {[
            ["LED Floodlight Pair", "$327"],
            ["Inspection Camera", "$249"],
            ["Smart Thermostat Pro", "$219"],
          ].map(([product, sales], index) => (
            <div key={product} className="grid grid-cols-[1fr_70px_auto] items-center gap-2">
              <span className="truncate">{product}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[#ececf1]">
                <span className="block h-full rounded-full bg-[#6877ef]" style={{ width: `${82 - index * 18}%` }} />
              </span>
              <strong>{sales}</strong>
            </div>
          ))}
        </div>
      </HeroCard>
    </div>
  );
}

function HeroProductCollage({ type }: { type: (typeof heroViews)[number]["type"] }) {
  const activeView = heroViews.find((view) => view.type === type) ?? heroViews[0];

  return (
    <div className="relative mx-auto h-[280px] w-full max-w-[660px] overflow-visible sm:h-[330px] lg:h-[390px]">
      <div className="absolute inset-6 -z-10 rounded-[50%] bg-[#dcd5ff]/42 blur-2xl" />
      <div className="absolute top-0 left-1/2 w-[640px] origin-top -translate-x-1/2 scale-[0.56] sm:scale-[0.78] lg:scale-100">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={activeView.type}
            data-hero-scene={activeView.type}
            className="transform-gpu will-change-[opacity,transform] [backface-visibility:hidden]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView.type === "service" ? (
              <ServiceHeroVisual />
            ) : activeView.type === "estimates" ? (
              <EstimateHeroVisual />
            ) : activeView.type === "orders" ? (
              <OrdersHeroVisual />
            ) : (
              <AnalyticsHeroVisual />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AppScreen({
  type,
  showMobileOverlay = false,
}: {
  type: keyof typeof productScreens;
  showMobileOverlay?: boolean;
}) {
  return <ProductScreenshot type={type} showMobileOverlay={showMobileOverlay} className="aspect-[16/10] w-full" />;
}

function FlowShot({ step }: { step: "capture" | "operate" | "deliver" }) {
  const type = step === "capture" ? "customers" : step === "operate" ? "createEstimate" : "invoiceDetail";
  return <ProductScreenshot type={type} className="h-[215px]" />;
}

function BandVisual({ type }: { type: "documents" | "commerce" | "pulse" | "service" }) {
  if (type === "service") return <AppScreen type="timeTracking" />;
  if (type === "pulse") return <AppScreen type="analytics" />;
  if (type === "commerce") return <AppScreen type="inventory" />;
  return <AppScreen type="invoices" />;
}

export function LandingExperience() {
  const [heroView, setHeroView] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reducedMotion = useReducedMotion();
  const feature = productFeatures[activeFeature];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => setHeroView((current) => (current + 1) % heroViews.length), 4200);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-[#303030] selection:bg-[#6f78f7] selection:text-white">
      <div className="hidden h-10 items-center justify-end gap-8 bg-white px-8 text-[#4f4f4f] text-xs md:flex lg:px-14">
        <span>Field Service Management</span>
        <a href="#features" className="hover:text-[#6f78f7]">
          Features
        </a>
        <Link href="/employee-time-tracking" className="hover:text-[#6f78f7]">
          Employee Portal
        </Link>
        <Link href="/login" className="hover:text-[#6f78f7]">
          Sign In
        </Link>
      </div>

      <header
        className={`sticky top-0 z-50 border-black/5 border-b transition-colors duration-300 ${scrolled ? "bg-gradient-to-r from-[#9365f4] to-[#6877ef] text-white shadow-md" : "bg-[#f7f5ff] text-[#303030]"}`}
      >
        <div className="mx-auto flex h-[82px] max-w-[1440px] items-center justify-between px-5 md:px-8 lg:px-12">
          <Link href="/" aria-label="VadosStack home">
            <Brand inverse={scrolled} />
          </Link>
          <nav aria-label="Primary navigation" className="hidden items-center gap-8 text-sm lg:flex">
            <a href="#features" className="inline-flex items-center gap-1 hover:opacity-70">
              Product Tour <ChevronDown className="size-3.5" />
            </a>
            <a href="#industries" className="inline-flex items-center gap-1 hover:opacity-70">
              Industries <ChevronDown className="size-3.5" />
            </a>
            <a href="#features" className="hover:opacity-70">
              Features
            </a>
            <a href="#how-it-works" className="hover:opacity-70">
              How It Works
            </a>
            <a href="#why-vadosstack" className="hover:opacity-70">
              Why VadosStack?
            </a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <Button
              asChild
              size="lg"
              className={`rounded-full px-7 ${scrolled ? "bg-white text-[#303030] hover:bg-white/90" : "bg-gradient-to-r from-[#9365f4] to-[#6877ef] text-white hover:brightness-95"}`}
            >
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className={`grid size-10 place-items-center rounded-full border sm:hidden ${scrolled ? "border-white/30" : "border-black/10"}`}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.nav
              aria-label="Mobile navigation"
              className={`absolute inset-x-3 top-[74px] grid gap-1 rounded-2xl border p-3 shadow-xl ${scrolled ? "border-white/15 bg-gradient-to-r from-[#9365f4] to-[#6877ef]" : "border-black/10 bg-white"}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {[
                ["Features", "#features"],
                ["Industries", "#industries"],
                ["How It Works", "#how-it-works"],
                ["Why VadosStack?", "#why-vadosstack"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  className="rounded-xl px-4 py-3 font-medium text-sm hover:bg-black/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-current/10 border-t pt-3">
                <Button
                  asChild
                  variant="outline"
                  className="rounded-full bg-white text-[#303030] hover:bg-white/90 hover:text-[#303030]"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild className="rounded-full bg-[#303030] text-white">
                  <Link href="/register">Create Account</Link>
                </Button>
              </div>
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </header>

      <section className="relative isolate bg-[#f7f5ff]">
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <div className="absolute -right-20 -bottom-48 size-[650px] rounded-full bg-[repeating-radial-gradient(circle,rgba(116,99,241,0.075)_0_1px,transparent_1px_7px)]" />
          <div className="absolute right-[9%] bottom-[16%] h-20 w-[400px] rotate-[-7deg] rounded-full bg-[#d9d3ff]/58" />
        </div>
        <div className="mx-auto grid min-h-[500px] max-w-[1440px] gap-7 px-5 pt-14 pb-20 md:px-8 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:px-12 lg:pt-10 lg:pb-16">
          <motion.div
            className="relative z-10 max-w-[680px]"
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={stagger}
          >
            <motion.h1
              variants={reveal}
              className="font-semibold text-[clamp(2.45rem,3.8vw,3.25rem)] leading-[1.06] tracking-[-0.035em]"
            >
              Field Service
              <br />
              Management Software.
            </motion.h1>
            <motion.div
              variants={reveal}
              className="relative mt-1 min-h-[2.3em] overflow-hidden font-semibold text-[2.15rem] leading-[1.1] tracking-[-0.035em] sm:min-h-[1.18em] sm:text-[clamp(2.35rem,3.7vw,3.15rem)]"
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={heroViews[heroView].label}
                  className="absolute inset-x-0 top-0 bg-gradient-to-r from-[#9564f4] via-[#7d69f3] to-[#6877ef] bg-clip-text text-transparent"
                  initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -18 }}
                  transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
                >
                  {heroViews[heroView].label}
                </motion.span>
              </AnimatePresence>
            </motion.div>
            <motion.p variants={reveal} className="mt-6 max-w-[570px] text-[#505050] text-lg leading-8">
              Manage customers, estimates, jobs, invoices, employee time, and service operations—with built-in orders
              and inventory when your business also sells products.
            </motion.p>
            <motion.div variants={reveal} className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-full bg-gradient-to-r from-[#9365f4] to-[#6877ef] px-7 text-base text-white shadow-[0_12px_28px_rgba(116,99,241,0.22)] hover:brightness-95"
              >
                <Link href="/register">
                  Create Account <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-14 rounded-full border-black/15 bg-white/55 px-7 text-base"
              >
                <a href="#features">Explore Features</a>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative z-10 min-w-0"
            initial={reducedMotion ? false : { opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <HeroProductCollage type={heroViews[heroView].type} />
          </motion.div>
        </div>

        <div className="relative z-20 mx-auto -mb-14 max-w-[1380px] px-5 md:px-8">
          <div className="grid overflow-hidden rounded-[2rem] border border-black/6 bg-white shadow-[0_24px_65px_rgba(45,39,37,0.1)] sm:grid-cols-2 lg:grid-cols-4">
            {proofMetrics.map(([value, label], index) => (
              <div
                key={label}
                className={`px-5 py-6 text-center lg:py-7 ${index ? "border-black/8 border-t sm:border-t-0 sm:border-l" : ""}`}
              >
                <div className="font-semibold text-4xl tracking-[-0.03em]">{value}</div>
                <div className="mt-2 text-[#686868] text-sm">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Industries supported" className="bg-white px-5 pt-28 pb-14">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-center text-[#7a7a7a] text-xs uppercase tracking-[0.16em]">
            Built for service teams that also need the stockroom and counter connected
          </p>
          <div className="mt-8 grid grid-cols-2 items-center gap-7 text-center sm:grid-cols-3 lg:grid-cols-6">
            {industries.map((industry, index) => (
              <div
                key={industry}
                className={`font-semibold text-xl tracking-[-0.02em] ${index % 3 === 0 ? "text-[#6575ee]" : index % 3 === 1 ? "text-[#3e7b58]" : "text-[#5d5d5d]"}`}
              >
                {industry}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MotionSection
        id="features"
        className="scroll-mt-24 bg-white px-5 py-20 md:px-8 lg:px-12"
        labelledBy="features-title"
      >
        <div className="mx-auto max-w-[1380px]">
          <motion.h2
            id="features-title"
            variants={reveal}
            className="text-center font-semibold text-4xl tracking-[-0.035em] md:text-5xl"
          >
            Features
          </motion.h2>
          <motion.div
            variants={reveal}
            className="mt-11 flex flex-wrap justify-center gap-x-5 gap-y-3 border-black/10 border-b md:gap-x-7"
          >
            {productFeatures.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`relative min-w-fit pb-4 text-base transition-colors sm:text-lg ${activeFeature === index ? "font-semibold text-[#6f78f7]" : "text-[#565656] hover:text-[#303030]"}`}
                onClick={() => setActiveFeature(index)}
              >
                {item.title}
                {activeFeature === index ? (
                  <motion.span layoutId="feature-tab" className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#6f78f7]" />
                ) : null}
              </button>
            ))}
          </motion.div>
          <div className="mt-12 grid gap-12 lg:grid-cols-[0.8fr_1fr] lg:items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${feature.title}-copy`}
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
              >
                <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">{feature.eyebrow}</p>
                <h3 className="mt-4 font-semibold text-4xl leading-[1.08] tracking-[-0.035em]">{feature.heading}</h3>
                <p className="mt-5 text-[#565656] text-lg leading-8">{feature.copy}</p>
                <div className="mt-6 grid gap-3">
                  {feature.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-3 text-[#454545]">
                      <span className="grid size-6 place-items-center rounded-full bg-[#e9f6ee] text-[#326b4b]">
                        <Check className="size-3.5" />
                      </span>
                      {bullet}
                    </div>
                  ))}
                </div>
                <Button asChild size="lg" className="mt-8 rounded-full bg-[#6f78f7] px-7 text-white hover:bg-[#5964dd]">
                  <Link href="/register">Create Account</Link>
                </Button>
              </motion.div>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${feature.title}-screen`}
                className="mx-auto w-full max-w-[760px] lg:mr-0"
                initial={reducedMotion ? false : { opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: -18 }}
                transition={{ duration: 0.4 }}
              >
                <AppScreen type={feature.type} showMobileOverlay />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </MotionSection>

      <MotionSection
        id="why-vadosstack"
        className="scroll-mt-24 bg-[#f7f7f7] px-5 py-24 md:px-8 lg:px-12"
        labelledBy="teams-title"
      >
        <div className="mx-auto max-w-[1260px]">
          <motion.h2
            id="teams-title"
            variants={reveal}
            className="text-center font-semibold text-4xl tracking-[-0.035em] md:text-5xl"
          >
            One Platform for the Service Business
          </motion.h2>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {capabilityCards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.article
                  key={card.title}
                  variants={reveal}
                  whileHover={reducedMotion ? undefined : { y: -6 }}
                  className="bg-white p-8 text-center shadow-[0_12px_35px_rgba(35,35,35,0.05)]"
                >
                  <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f0edff] text-[#6f78f7]">
                    <Icon className="size-7" />
                  </span>
                  <h3 className="mt-7 font-semibold text-2xl">{card.title}</h3>
                  <p className="mt-4 text-[#606060] leading-7">{card.copy}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </MotionSection>

      <MotionSection
        id="how-it-works"
        className="scroll-mt-24 bg-[#f2f2f2] px-5 py-24 md:px-8 lg:px-12"
        labelledBy="how-title"
      >
        <div className="mx-auto max-w-[1380px]">
          <motion.h2
            id="how-title"
            variants={reveal}
            className="text-center font-semibold text-4xl tracking-[-0.035em] md:text-5xl"
          >
            How it Works?
          </motion.h2>
          <div className="mt-14 grid gap-7 lg:grid-cols-3">
            {[
              {
                step: "capture" as const,
                number: "1.",
                title: "Capture the Customer",
                copy: "Create the lead, customer, service request, or estimate with the details your team needs.",
              },
              {
                step: "operate" as const,
                number: "2.",
                title: "Move the Service Work",
                copy: "Send the estimate, schedule the job, track status, and keep customer details connected.",
              },
              {
                step: "deliver" as const,
                number: "3.",
                title: "Bill, Review, and Grow",
                copy: "Invoice completed work, review receivables, and use order and inventory tools when products are part of the job.",
              },
            ].map((item) => (
              <motion.article key={item.number} variants={reveal}>
                <FlowShot step={item.step} />
                <h3 className="mt-6 font-semibold text-2xl">
                  {item.number} {item.title}
                </h3>
                <p className="mt-3 text-[#626262] text-lg leading-7">{item.copy}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-white px-5 py-24 md:px-8 lg:px-12" labelledBy="service-band-title">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-2 lg:items-center">
          <motion.div variants={reveal}>
            <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">Service management</p>
            <h2
              id="service-band-title"
              className="mt-4 font-semibold text-4xl leading-[1.08] tracking-[-0.035em] md:text-5xl"
            >
              Time Tracking That Keeps Crew Hours in View
            </h2>
            <p className="mt-5 text-[#565656] text-lg leading-8">
              Review weekly hours, daily time entries, employee summaries, and pending edits so payroll and job costing
              stay connected to the service work.
            </p>
            <Button asChild size="lg" className="mt-7 rounded-full bg-[#6f78f7] px-7 text-white hover:bg-[#5964dd]">
              <a href="#features">Learn More</a>
            </Button>
          </motion.div>
          <motion.div variants={reveal}>
            <BandVisual type="service" />
          </motion.div>
        </div>
      </MotionSection>

      <MotionSection className="bg-[#fafafa] px-5 py-24 md:px-8 lg:px-12" labelledBy="commerce-band-title">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-2 lg:items-center">
          <motion.div variants={reveal} className="lg:order-2">
            <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">Commerce add-ons</p>
            <h2
              id="commerce-band-title"
              className="mt-4 font-semibold text-4xl leading-[1.08] tracking-[-0.035em] md:text-5xl"
            >
              Order and Inventory Tools for Product-Plus-Service Teams
            </h2>
            <p className="mt-5 text-[#565656] text-lg leading-8">
              When customers also buy products, parts, or kits, create orders, monitor fulfillment, track stock
              movement, and handle returns from the same workspace.
            </p>
            <Button asChild size="lg" className="mt-7 rounded-full bg-[#6f78f7] px-7 text-white hover:bg-[#5964dd]">
              <a href="#features">Learn More</a>
            </Button>
          </motion.div>
          <motion.div variants={reveal} className="lg:order-1">
            <BandVisual type="commerce" />
          </motion.div>
        </div>
      </MotionSection>

      <MotionSection className="bg-white px-5 py-24 md:px-8 lg:px-12" labelledBy="pulse-band-title">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-2 lg:items-center">
          <motion.div variants={reveal}>
            <p className="font-medium text-[#6f78f7] text-sm uppercase tracking-[0.12em]">Business intelligence</p>
            <h2
              id="pulse-band-title"
              className="mt-4 font-semibold text-4xl leading-[1.08] tracking-[-0.035em] md:text-5xl"
            >
              Reporting for Service Revenue and Product Activity
            </h2>
            <p className="mt-5 text-[#565656] text-lg leading-8">
              Review service revenue, receivables, estimate momentum, order activity, top products, and inventory health
              without stitching together separate spreadsheets.
            </p>
            <Button asChild size="lg" className="mt-7 rounded-full bg-[#6f78f7] px-7 text-white hover:bg-[#5964dd]">
              <a href="#features">Learn More</a>
            </Button>
          </motion.div>
          <motion.div variants={reveal}>
            <BandVisual type="pulse" />
          </motion.div>
        </div>
      </MotionSection>

      <MotionSection
        id="industries"
        className="scroll-mt-24 bg-[#f7f7f7] px-5 py-24 md:px-8 lg:px-12"
        labelledBy="industries-title"
      >
        <div className="mx-auto max-w-[1260px]">
          <motion.h2
            id="industries-title"
            variants={reveal}
            className="text-center font-semibold text-4xl tracking-[-0.035em] md:text-5xl"
          >
            Businesses VadosStack Works With
          </motion.h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [CalendarDays, "Field Service", "Scheduling, jobs, estimates, invoices, and customer history."],
              [Package, "Retail & Wholesale", "Orders, inventory, fulfillment, returns, and product reporting."],
              [FileText, "Contractors", "Leads, reusable service pricing, documents, and time tracking."],
              [Boxes, "Product + Service", "Sell products and deliver service from the same customer record."],
              [UserRoundCog, "Growing Teams", "Employee records, time history, workflows, and role-aware access."],
              [
                LayoutDashboard,
                "Owner-Operators",
                "A focused command center for the work, the sale, and the next action.",
              ],
            ].map(([Icon, title, copy]) => {
              const IndustryIcon = Icon as typeof CalendarDays;
              return (
                <motion.article
                  key={title as string}
                  variants={reveal}
                  whileHover={reducedMotion ? undefined : { y: -5 }}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >
                  <IndustryIcon className="size-6 text-[#6f78f7]" />
                  <h3 className="mt-7 font-semibold text-xl">{title as string}</h3>
                  <p className="mt-3 text-[#646464] leading-6">{copy as string}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </MotionSection>

      <MotionSection id="faq" className="bg-white px-5 py-24 md:px-8 lg:px-12" labelledBy="faq-title">
        <div className="mx-auto max-w-[1000px]">
          <motion.h2
            id="faq-title"
            variants={reveal}
            className="text-center font-semibold text-4xl tracking-[-0.035em] md:text-5xl"
          >
            VadosStack FAQs
          </motion.h2>
          <motion.div variants={reveal} className="mt-12 divide-y divide-black/10 border-black/10 border-y">
            {faqs.map((faq, index) => (
              <details key={faq.question} className="group py-1" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-semibold text-lg [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6f78f7] transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-3xl pb-6 text-[#5f5f5f] leading-7">{faq.answer}</p>
              </details>
            ))}
          </motion.div>
        </div>
      </MotionSection>

      <section className="bg-gradient-to-r from-[#9365f4] to-[#6877ef] px-5 py-20 text-center text-white md:px-8">
        <h2 className="mx-auto mt-6 max-w-[900px] text-balance font-semibold text-4xl tracking-[-0.04em] md:text-6xl">
          Ready to run your service business in one place?
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-white/82 leading-8">
          Create a VadosStack workspace for your service business, with commerce tools ready when you need them.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-14 items-center justify-center gap-1.5 rounded-full bg-white px-8 font-medium text-[#303030] text-sm transition-colors hover:bg-white/90 hover:text-[#303030]"
          >
            Create Account <ArrowRight className="size-4" />
          </Link>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 rounded-full border-white/35 bg-transparent px-8 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      <footer className="bg-[#292929] px-5 py-12 text-white md:px-8 lg:px-12">
        <div className="mx-auto max-w-[1380px]">
          <div className="grid gap-10 border-white/10 border-b pb-10 md:grid-cols-[1fr_auto]">
            <div>
              <Brand inverse />
              <p className="mt-4 max-w-md text-sm text-white/55 leading-6">
                Field service management software with built-in e-commerce tools for businesses that need the whole
                operation in view.
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-white/65 sm:grid-cols-3"
            >
              <a href="#features" className="hover:text-white">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-white">
                How It Works
              </a>
              <a href="#industries" className="hover:text-white">
                Industries
              </a>
              <Link href="/login" className="hover:text-white">
                Sign In
              </Link>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </nav>
          </div>
          <div className="mt-7 flex flex-col gap-2 text-white/45 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p>{APP_CONFIG.copyright}</p>
            <p>Service first. Commerce ready.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
