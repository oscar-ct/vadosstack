import Link from "next/link";
import { notFound } from "next/navigation";

import { format } from "date-fns";
import {
  CalendarClock,
  FileText,
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
import { cn, formatCurrency } from "@/lib/utils";

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
  if (status === "Estimate Sent") return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900";
  if (status === "Estimate Needed") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900";
  if (status === "Contacted") return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900";
  return "bg-muted-foreground/10 text-muted-foreground";
}

function formatDate(value?: string) {
  return value ? format(new Date(value), "MMM d, yyyy") : "Not set";
}

function formatMoney(value?: string) {
  return value ? formatCurrency(Number(value)) : "No value";
}

function DetailTile({ children, icon, label }: { children: React.ReactNode; icon: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
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
  const templates = await getRenderedDocumentEmailTemplates({
    ownerId: currentUser.id,
    scope: "lead",
    context: {
      companyEmail: currentUser.companyEmail ?? currentUser.email,
      companyName: currentUser.companyName,
      companyPhone: currentUser.companyPhone,
      estimatedValue: lead.estimatedValue ? formatMoney(lead.estimatedValue) : undefined,
      followUpDate: formatDate(lead.followUpAt),
      leadEmail: lead.email,
      leadFirstName,
      leadName: lead.name,
      leadPhone: lead.phone ? formatPhoneNumber(lead.phone) : undefined,
      leadSource: lead.source,
      serviceLocation: lead.serviceLocation,
      serviceLocationPhrase: lead.serviceLocation ? ` at ${lead.serviceLocation}` : "",
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
          {lead.status !== "New" ? <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="New" /> : null}
          <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="Contacted" />
          <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="Won" />
          <LeadStatusButton action={updateLeadStatusAction} lead={lead} status="Lost" />
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
            </CardTitle>
            <CardDescription>
              {lead.source ?? "Unknown source"} inquiry created {formatDate(lead.createdAt)}.
            </CardDescription>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            {lead.estimateRecordId ? (
              <Button asChild size="sm" className="w-full sm:w-auto">
                <Link href={`/dashboard/estimates/records/${lead.estimateRecordId}`}>
                  <ReceiptText />
                  Open estimate
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
            <DetailTile icon={<Mail className="size-3.5" />} label="Email">
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="hover:underline">
                  {lead.email}
                </a>
              ) : (
                "Not on file"
              )}
            </DetailTile>
            <DetailTile icon={<Phone className="size-3.5" />} label="Phone">
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="hover:underline">
                  {formatPhoneNumber(lead.phone)}
                </a>
              ) : (
                "Not on file"
              )}
            </DetailTile>
            <DetailTile icon={<CalendarClock className="size-3.5" />} label="Follow-up">
              {formatDate(lead.followUpAt)}
            </DetailTile>
            <DetailTile icon={<FileText className="size-3.5" />} label="Estimated value">
              {formatMoney(lead.estimatedValue)}
            </DetailTile>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <DetailTile icon={<UserRound className="size-3.5" />} label="Customer">
              {lead.customerId ? (
                <CustomerLink customerId={lead.customerId} name={lead.customerName} />
              ) : (
                "Not converted"
              )}
            </DetailTile>
            <DetailTile icon={<Pencil className="size-3.5" />} label="Service type">
              {lead.serviceType ?? "Not set"}
            </DetailTile>
            <DetailTile icon={<MapPin className="size-3.5" />} label="Service location">
              <span className="whitespace-pre-wrap">{lead.serviceLocation ?? "Not on file"}</span>
            </DetailTile>
          </div>

          {lead.notes ? (
            <div className="rounded-lg border bg-background p-3">
              <div className="text-muted-foreground text-xs">Notes</div>
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

      <LeadEmailComposer
        action={sendLeadEmailAction}
        gmailConnected={Boolean(googleMailAccount)}
        lead={lead}
        returnTo={returnTo}
        senderEmail={googleMailAccount?.email}
        templates={templates}
      />

      <LeadForm action={updateLeadAction} lead={lead} />
    </div>
  );
}
