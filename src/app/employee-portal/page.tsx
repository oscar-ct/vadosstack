import Image from "next/image";
import Link from "next/link";

import { ArrowLeft, Check, Clock3, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import vadosstackLogoSmall from "../../../media/vadosstack-logo-transparent-small.png";
import { EmployeeLoginForm } from "./_components/employee-login-form";

export const metadata: Metadata = {
  title: "Employee Time Portal",
  description: "Securely view and submit employee time in VadosStack.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function Page() {
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-[#f7f5ff] text-[#303030] selection:bg-[#6f78f7] selection:text-white">
      <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-52 -bottom-64 size-[760px] rounded-full bg-[repeating-radial-gradient(circle,rgba(116,99,241,0.08)_0_1px,transparent_1px_8px)]" />
        <div className="absolute top-[-14rem] left-[-10rem] size-[34rem] rounded-full bg-[#d9d3ff]/55 blur-3xl" />
      </div>

      <header className="border-black/5 border-b bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Link
            href="/"
            aria-label="VadosStack home"
            className="inline-flex items-center gap-2.5 font-semibold text-xl tracking-[-0.03em]"
          >
            <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-8 object-contain" priority />
            VadosStack
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm transition-colors hover:text-[#6f78f7]">
            <ArrowLeft className="size-4" />
            Back to website
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-12 px-5 py-12 md:px-8 lg:grid-cols-[1fr_0.82fr] lg:py-16">
        <section aria-labelledby="employee-portal-heading" className="max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#6f78f7]/15 bg-white/80 px-4 py-2 font-medium text-[#5964dd] text-sm shadow-sm">
            <Clock3 className="size-4" />
            Employee Time Portal
          </div>
          <h1
            id="employee-portal-heading"
            className="font-semibold text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            Manage your time
            <span className="block text-[#6f78f7]">with confidence.</span>
          </h1>
          <p className="mt-6 max-w-lg text-[#5f5f67] text-lg leading-8">
            Review weekly hours, submit time for worked days, and follow manager approvals from any device.
          </p>
          <div className="mt-8 grid gap-3 text-[#4d4d55] text-sm sm:grid-cols-2">
            {["12-hour secure sessions", "Manager-reviewed changes"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-[#ebe8ff] text-[#6f78f7]">
                  <Check className="size-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="employee-login-heading" className="w-full lg:justify-self-end">
          <Card className="mx-auto w-full max-w-md rounded-[1.75rem] border-white/80 bg-white/90 shadow-[0_28px_80px_rgba(49,43,88,0.16)] backdrop-blur-xl">
            <CardHeader className="space-y-3 px-6 pt-7 sm:px-8 sm:pt-8">
              <div className="grid size-11 place-items-center rounded-2xl bg-[#efedff] text-[#6f78f7]">
                <ShieldCheck className="size-5" />
              </div>
              <div className="space-y-1.5">
                <CardTitle id="employee-login-heading" className="text-2xl tracking-[-0.025em]">
                  Access your timesheet
                </CardTitle>
                <CardDescription className="leading-6">
                  Use the phone number on file and your four-digit employee ID.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
              <EmployeeLoginForm />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
