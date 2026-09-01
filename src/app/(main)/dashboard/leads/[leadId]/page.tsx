import Link from "next/link";
import { notFound } from "next/navigation";

import { format } from "date-fns";
import {
  CalendarClock,
  CalendarDays,
  Flame,
  Mail,
  MailWarning,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { BackButton } from "@/components/back-button";
import { CustomerLink } from "@/components/customer-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress } from "@/lib/service-address";
import { cn } from "@/lib/utils";

import { ConvertLeadButton, DeleteLeadButton, LeadStatusButton } from "../_components/lead-action-buttons";
import { LeadEmailComposer } from "../_components/lead-email-composer";
import { LeadForm } from "../_components/lead-form";
import { getLead } from "../_lib/lead-data";
import {
  convertLeadToCustomerAction,
  deleteLeadAction,
  sendLeadEmailAction,
  updateLeadAction,
  updateLeadStatusAction,
} from "../actions";

type LeadPageProps = {
  params: Promise<{
    leadId: string;
  }>;
  searchParams?: Promise<{
    gmail_connected?: string;
    gmail_error?: string;
  }>;
};

const gmailErrorMessages: Record<string, string> = {
  callback: "Gmail could not be connected. Please try again.",
  config: "Google OAuth is not configured for Gmail sending yet.",
  denied: "Gmail connection was cancelled.",
  mismatch: "Connect Gmail with the same Google account you use to sign in.",
  refresh: "Google did not return offline Gmail access. Please try connecting again.",
  scope: "Gmail send permission was not granted.",
  state: "Gmail connection expired. Please try again.",
  unverified: "Google account email must be verified before connecting Gmail.",
};

function statusClassName(status: string) {
  if (status === "Won") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900";
  if (status === "Lost") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900";
  if (status === "In Progress") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function formatDate(value?: string) {
  return value ? format(new Date(value), "MMM d, yyyy") : "Not set";
}

const detailTileTones = {
  amber: {
    container: "border-amber-200/80 bg-amber-50/65 dark:border-amber-900/60 dark:bg-amber-950/20",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  cyan: {
    container: "border-cyan-200/80 bg-cyan-50/65 dark:border-cyan-900/60 dark:bg-cyan-950/20",
    icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  emerald: {
    container: "border-emerald-200/80 bg-emerald-50/65 dark:border-emerald-900/60 dark:bg-emerald-950/20",
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  orange: {
    container: "border-orange-200/80 bg-orange-50/65 dark:border-orange-900/60 dark:bg-orange-950/20",
    icon: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  },
  rose: {
    container: "border-rose-200/80 bg-rose-50/65 dark:border-rose-900/60 dark:bg-rose-950/20",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  sky: {
    container: "border-sky-200/80 bg-sky-50/65 dark:border-sky-900/60 dark:bg-sky-950/20",
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
  violet: {
    container: "border-violet-200/80 bg-violet-50/65 dark:border-violet-900/60 dark:bg-violet-950/20",
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
} as const;

function DetailTile({
  children,
  icon,
  label,
  tone,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
  tone: keyof typeof detailTileTones;
}) {
  const classes = detailTileTones[tone];

  return (
    <div className={cn("grid gap-2 rounded-lg border p-3", classes.container)}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-md", classes.icon)}>{icon}</span>
        {label}
      </div>
      <div className="min-w-0 font-medium text-sm">{children}</div>
    </div>
  );
}

function LeadEmailWarning() {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
      <MailWarning className="size-4" />
      <AlertTitle>No email on this lead</AlertTitle>
      <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
        You can still create estimates and convert this lead, but sending estimates or invoices by email will need an
        email address later.
      </AlertDescription>
    </Alert>
  );
}

export default async function LeadPage({ params, searchParams }: LeadPageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState title="Sign in to view this lead" description="Lead records are private to each account." />
    );
  }

  const { leadId } = await params;
  const resolvedSearchParams = await searchParams;
  const [lead, googleMailAccount] = await Promise.all([
    getLead(currentUser.id, leadId),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
      select: {
        email: true,
      },
    }),
  ]);

  if (!lead) {
    notFound();
  }

  const leadFirstName = lead.name.split(" ")[0] || lead.name;
  const serviceType = lead.serviceType?.toLowerCase() ?? "project";
  const serviceLocation = formatServiceAddress(lead);
  const templates = await getRenderedDocumentEmailTemplates({
    ownerId: currentUser.id,
    scope: "lead",
    context: {
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyName: currentUser.companyName,
      companyPhone: currentUser.companyPhone,
      followUpDate: formatDate(lead.followUpAt),
      leadEmail: lead.email,
      leadFirstName,
      leadName: lead.name,
      leadPhone: lead.phone ? formatPhoneNumber(lead.phone) : undefined,
      leadSource: lead.source,
      serviceLocation,
      serviceLocationPhrase: serviceLocation ? ` at ${serviceLocation}` : "",
      serviceType,
    },
  });
  const returnTo = `/dashboard/leads/${lead.id}`;
  const gmailError = resolvedSearchParams?.gmail_error;
  const notice = resolvedSearchParams?.gmail_connected
    ? { message: "Gmail is connected. You can email leads from this account.", type: "success" as const }
    : gmailError
      ? { message: gmailErrorMessages[gmailError] ?? "Gmail could not be connected.", type: "error" as const }
      : null;

  return (
    <div className="@container/main mx-auto grid w-full max-w-6xl gap-4 md:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackButton fallbackHref="/dashboard/leads" />
        <div className="flex flex-wrap items-center gap-2">
          {!lead.estimateRecordId && lead.status === "Lost" ? (
            <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="New" />
          ) : null}
          {!lead.estimateRecordId && lead.status !== "Lost" && lead.status !== "Won" ? (
            <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="Lost" />
          ) : null}
          <DeleteLeadButton action={deleteLeadAction} lead={lead} />
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4">
          <div className="grid min-w-0 gap-2">
            <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 break-words text-xl leading-tight">{lead.name}</span>
              <Badge variant="outline" className={cn("w-fit", statusClassName(lead.status))}>
                {lead.status}
              </Badge>
              {lead.priority === "High" ? (
                <span className="inline-flex items-center gap-1 font-medium text-rose-600 text-xs dark:text-rose-400">
                  <Flame className="size-3.5" />
                  High priority
                </span>
              ) : null}
            </CardTitle>
            <CardDescription>Lead created {formatDate(lead.createdAt)}.</CardDescription>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <LeadEmailComposer
              action={sendLeadEmailAction}
              gmailConnected={Boolean(googleMailAccount)}
              lead={lead}
              returnTo={returnTo}
              senderEmail={googleMailAccount?.email}
              templates={templates}
            />
            {lead.estimateRecordId ? (
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={`/dashboard/estimates/records/${lead.estimateRecordId}`}>
                  <ReceiptText />
                  {lead.estimateNumber ?? "Open estimate"}
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={`/dashboard/estimates/create?leadId=${lead.id}`}>
                  <ReceiptText />
                  Create estimate
                </Link>
              </Button>
            )}
            <ConvertLeadButton action={convertLeadToCustomerAction} lead={lead} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!lead.email ? <LeadEmailWarning /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailTile icon={<Mail className="size-3.5" />} label="Email" tone="sky">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="hover:underline">
                  {lead.email}
                </a>
              ) : (
                "Not on file"
              )}
            </DetailTile>
            <DetailTile icon={<Phone className="size-3.5" />} label="Phone" tone="emerald">
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="hover:underline">
                  {formatPhoneNumber(lead.phone)}
                </a>
              ) : (
                "Not on file"
              )}
            </DetailTile>
            <DetailTile icon={<CalendarClock className="size-3.5" />} label="Follow-up" tone="amber">
              {formatDate(lead.followUpAt)}
            </DetailTile>
            <DetailTile icon={<CalendarDays className="size-3.5" />} label="Created" tone="violet">
              {formatDate(lead.createdAt)}
            </DetailTile>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <DetailTile icon={<UserRound className="size-3.5" />} label="Customer" tone="cyan">
              {lead.customerId ? (
                <CustomerLink customerId={lead.customerId} name={lead.customerName} />
              ) : (
                "Not converted"
              )}
            </DetailTile>
            <DetailTile icon={<Pencil className="size-3.5" />} label="Service type" tone="orange">
              {lead.serviceType ?? "Not set"}
            </DetailTile>
            <DetailTile icon={<MapPin className="size-3.5" />} label="Service location" tone="rose">
              <span className="whitespace-pre-wrap">{serviceLocation ?? "Not on file"}</span>
            </DetailTile>
          </div>

          {lead.notes ? (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/60 dark:bg-amber-950/15">
              <div className="font-medium text-amber-700 text-xs dark:text-amber-300">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{lead.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <LeadForm action={updateLeadAction} lead={lead} />
    </div>
  );
}
