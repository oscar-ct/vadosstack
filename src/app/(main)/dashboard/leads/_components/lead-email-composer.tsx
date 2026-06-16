"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Mail, Send } from "lucide-react";
import { siGmail } from "simple-icons";

import { EmailDeliveryResult, type EmailDeliveryResultValue } from "@/components/email-delivery-result";
import { SimpleIcon } from "@/components/simple-icon";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { LeadRow } from "../_lib/lead-data";
import type { EmailLeadState } from "../actions";

export type LeadEmailTemplate = {
  body: string;
  subject: string;
  title: string;
};

const initialState: EmailLeadState = {
  success: false,
  message: "",
};

export function LeadEmailComposer({
  action,
  gmailConnected,
  lead,
  returnTo,
  senderEmail,
  templates,
}: {
  action: (state: EmailLeadState, formData: FormData) => Promise<EmailLeadState>;
  gmailConnected: boolean;
  lead: LeadRow;
  returnTo: string;
  senderEmail?: string | null;
  templates: LeadEmailTemplate[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = React.useActionState(action, initialState);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [result, setResult] = React.useState<EmailDeliveryResultValue | null>(null);
  const stateSubmittedAt = state.submittedAt;
  const needsReconnect = state.reconnectRequired;
  const canSendEmail = gmailConnected && !needsReconnect;
  const gmailConnectLabel = needsReconnect ? "Reconnect Gmail" : "Connect Gmail";
  const hasRecipient = Boolean(lead.email);

  React.useEffect(() => {
    if (!state.message || !stateSubmittedAt) return;

    setResult({
      id: stateSubmittedAt,
      message: state.message,
      type: state.success ? "success" : "error",
    });

    if (state.success) {
      setSubject("");
      setMessage("");
      router.refresh();
    }
  }, [router, state.message, state.success, stateSubmittedAt]);

  function applyTemplate(template: LeadEmailTemplate) {
    setSubject(template.subject);
    setMessage(template.body);
  }

  return (
    <Card className="rounded-lg border border-cyan-200 bg-cyan-50/50 ring-cyan-200/70 dark:border-cyan-900/60 dark:bg-cyan-950/15 dark:ring-cyan-900/50">
      <CardHeader className="border-cyan-200/80 border-b bg-cyan-50/80 dark:border-cyan-900/60 dark:bg-cyan-950/25">
        <CardTitle className="flex min-w-30 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow-sm dark:bg-cyan-500">
            <Mail className="size-4" />
          </span>
          <span>Email lead</span>
        </CardTitle>
        <CardDescription className="col-span-full text-cyan-950/70 dark:text-cyan-100/70">
          Send a direct Gmail message or start from a helper template.
        </CardDescription>
        <CardAction>
          {canSendEmail ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 text-xs dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
              Gmail connected: {senderEmail ?? "ready"}
            </div>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-cyan-300 bg-background text-cyan-800 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
            >
              <a href={`/api/auth/google/mail?returnTo=${encodeURIComponent(returnTo)}`}>
                <SimpleIcon icon={siGmail} className="size-3.5 fill-current" />
                {gmailConnectLabel}
              </a>
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="pt-0">
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="leadId" value={lead.id} />

          <div className="grid gap-3 rounded-lg border border-cyan-200/80 bg-background/90 p-3 text-sm shadow-sm md:grid-cols-2 dark:border-cyan-900/60">
            <div className="grid gap-1">
              <span className="text-muted-foreground text-xs">To</span>
              <span className="font-medium">{lead.email ?? "Add an email address to this lead"}</span>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground text-xs">Lead</span>
              <span className="font-medium">{lead.name}</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`lead-email-subject-${lead.id}`}>Subject</Label>
            <Input
              id={`lead-email-subject-${lead.id}`}
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Type a subject or choose a template"
              className="border-cyan-200 bg-background shadow-sm focus-visible:border-cyan-500 dark:border-cyan-900/70"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`lead-email-message-${lead.id}`}>Message</Label>
            <Textarea
              id={`lead-email-message-${lead.id}`}
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a custom message..."
              className="min-h-44 border-cyan-200 bg-background font-mono text-sm shadow-sm focus-visible:border-cyan-500 dark:border-cyan-900/70"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Helper templates</Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.title}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-cyan-200 bg-background text-cyan-900 hover:bg-cyan-100/70 dark:border-cyan-900/70 dark:text-cyan-100 dark:hover:bg-cyan-950/50"
                  onClick={() => applyTemplate(template)}
                >
                  {template.title}
                </Button>
              ))}
            </div>
          </div>

          <EmailDeliveryResult result={result} onDone={() => setResult(null)} />

          <div className="flex justify-end border-cyan-200/80 border-t pt-1 dark:border-cyan-900/60">
            <Button
              type="submit"
              disabled={isPending || !canSendEmail || !hasRecipient}
              className="bg-cyan-700 text-white hover:bg-cyan-800 dark:bg-cyan-500 dark:hover:bg-cyan-600"
            >
              <Send />
              {isPending ? "Sending..." : "Send email"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
