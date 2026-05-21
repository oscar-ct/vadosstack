import Image from "next/image";
import Link from "next/link";

import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

import vadosstackLogoSmall from "../../../../media/vadosstack-logo-transparent-small.png";

type PolicySection = {
  title: string;
  body: string[];
};

type PolicyPageProps = {
  title: string;
  eyebrow: string;
  description: string;
  lastUpdated: string;
  sections: PolicySection[];
};

export function PolicyPage({ title, eyebrow, description, lastUpdated, sections }: PolicyPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f1e8] text-[#171412]">
      <header className="border-[#171412]/10 border-b bg-[#f6f1e8]/92 backdrop-blur">
        <div className="flex w-full items-center justify-between px-5 py-5 md:px-8 lg:px-12 2xl:px-16">
          <Link href="/" className="flex items-center gap-2 font-semibold text-[#171412]" aria-label="VadosStack home">
            <Image src={vadosstackLogoSmall} alt="" aria-hidden="true" className="h-auto w-6 object-contain" />
            <span>{APP_CONFIG.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-[#171412]/20 bg-white/45">
              <Link href="/">
                <ArrowLeft />
                Home
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-[#171412] text-[#f6f1e8] hover:bg-[#171412]/90">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="px-5 py-14 md:px-8 md:py-18 lg:px-12 2xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
          <aside className="lg:sticky lg:top-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#171412]/12 bg-white/55 px-3 py-1 text-[#594431] text-sm shadow-sm">
              <ShieldCheck className="size-4 text-[#24533d]" />
              {eyebrow}
            </div>
            <h1 className="mt-5 text-balance font-semibold text-5xl leading-tight tracking-normal md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-[#594431] text-lg leading-8">{description}</p>

            <div className="mt-8 rounded-lg border border-[#171412]/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-lg bg-[#dfe8e2] text-[#24533d]">
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="font-semibold">Last updated</div>
                  <div className="text-[#594431] text-sm">{lastUpdated}</div>
                </div>
              </div>
              <p className="mt-4 text-[#594431] text-sm leading-6">
                These pages are written in plain language for a small business software product. They are not a
                substitute for legal advice.
              </p>
            </div>
          </aside>

          <div className="rounded-lg border border-[#171412]/10 bg-white shadow-sm">
            {sections.map((section, index) => (
              <section key={section.title} className="border-[#171412]/10 border-b p-6 last:border-b-0 md:p-8">
                <div className="mb-5 flex items-start gap-4">
                  <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-lg bg-[#171412] font-medium text-[#f6f1e8] text-sm">
                    {index + 1}
                  </span>
                  <h2 className="font-semibold text-2xl tracking-normal">{section.title}</h2>
                </div>
                <div className="space-y-4 text-[#3d352f] leading-7">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
