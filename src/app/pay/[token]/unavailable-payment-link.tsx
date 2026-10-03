import Link from "next/link";

import { Clock3, Link2Off, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvoicePaymentLinkUnavailableReason } from "@/lib/payments/payment-links";

const content = {
  disabled: {
    description: "This payment link was disabled. Contact the company that sent the invoice for a new link.",
    icon: Link2Off,
    title: "Payment link disabled",
  },
  expired: {
    description: "This payment link has expired. Contact the company that sent the invoice for a new link.",
    icon: Clock3,
    title: "Payment link expired",
  },
  replaced: {
    description:
      "A newer payment link was created for this invoice. Please use the most recent link you received or contact the company for help.",
    icon: RefreshCw,
    title: "Payment link replaced",
  },
} satisfies Record<InvoicePaymentLinkUnavailableReason, { description: string; icon: typeof Link2Off; title: string }>;

export function UnavailablePaymentLink({ reason }: { reason: InvoicePaymentLinkUnavailableReason }) {
  const status = content[reason];
  const Icon = status.icon;

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.08),transparent_32%),linear-gradient(to_bottom,var(--color-background),var(--color-muted))] px-4 py-10">
      <Card className="w-full max-w-lg text-center shadow-black/5 shadow-xl">
        <CardHeader className="items-center">
          <span className="mb-2 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-6" />
          </span>
          <CardTitle>{status.title}</CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6">{status.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/">Go to home page</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
