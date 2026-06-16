"use client";

import * as React from "react";

import Link from "next/link";

import { ArrowRight, Mail, MailPlus, NotebookText, ReceiptText, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { EmailTemplateRow } from "../types";

function getSearchText(template: EmailTemplateRow) {
  return [template.title, template.scope, template.subject, template.bodyText].filter(Boolean).join(" ").toLowerCase();
}

function getScopeLabel(scope: EmailTemplateRow["scope"]) {
  if (scope === "invoice") return "Invoice";
  if (scope === "estimate") return "Estimate";
  return "General";
}

function ScopeIcon({ scope }: { scope: EmailTemplateRow["scope"] }) {
  const Icon = scope === "invoice" ? ReceiptText : scope === "estimate" ? NotebookText : MailPlus;

  return <Icon className="size-3" />;
}

export function EmailTemplatesDashboard({ templates }: { templates: EmailTemplateRow[] }) {
  const [query, setQuery] = React.useState("");
  const [activeScope, setActiveScope] = React.useState<"All" | EmailTemplateRow["scope"]>("All");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTemplates = templates.filter(
    (template) =>
      (activeScope === "All" || template.scope === activeScope) &&
      (!normalizedQuery || getSearchText(template).includes(normalizedQuery)),
  );
  const estimateCount = templates.filter((template) => template.scope === "estimate").length;
  const generalCount = templates.filter((template) => template.scope === "general").length;
  const invoiceCount = templates.filter((template) => template.scope === "invoice").length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 flex-wrap gap-2">
          {[
            { count: templates.length, label: "All", value: "All" as const },
            { count: generalCount, label: "General", value: "general" as const },
            { count: estimateCount, label: "Estimates", value: "estimate" as const },
            { count: invoiceCount, label: "Invoices", value: "invoice" as const },
          ].map((scope) => (
            <Button
              key={scope.value}
              type="button"
              variant={activeScope === scope.value ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setActiveScope(scope.value)}
            >
              {scope.label}
              <span className="tabular-nums">{scope.count}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder="Search templates..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {filteredTemplates.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Link
              key={template.id}
              prefetch={false}
              href={`/dashboard/email-templates/${template.id}/edit`}
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="h-full overflow-hidden rounded-lg transition-colors group-hover:bg-muted/20" size="sm">
                <CardContent className="grid h-full gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-sm">{template.title}</div>
                      <p className="line-clamp-2 text-muted-foreground text-sm">{template.subject}</p>
                    </div>
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <ScopeIcon scope={template.scope} />
                      {getScopeLabel(template.scope)}
                    </Badge>
                    {template.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                  </div>
                  <p className="line-clamp-3 text-muted-foreground text-sm">{template.bodyText}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid place-items-center rounded-lg border bg-muted/20 p-8 text-center">
          <div className="grid max-w-sm gap-2">
            <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-background text-muted-foreground">
              {templates.length ? <Sparkles className="size-5" /> : <Mail className="size-5" />}
            </div>
            <div className="font-medium text-sm">
              {templates.length ? "No templates match your filters." : "No email templates yet."}
            </div>
            <p className="text-muted-foreground text-sm">
              {templates.length
                ? "Try another document type, subject, message, or template name."
                : "Create reusable estimate and invoice emails with document variables."}
            </p>
            {!templates.length ? (
              <Button asChild className="mt-2">
                <Link prefetch={false} href="/dashboard/email-templates/create">
                  Create template
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
