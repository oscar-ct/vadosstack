import { format } from "date-fns";
import { CreditCard } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getApplicationFeeConfig } from "@/lib/payments/application-fee";
import { getWorkspacePaymentHealth } from "@/lib/payments/health";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { syncStripeProviderConnection } from "@/lib/payments/stripe-connect";
import type { StripePaymentMethodReadiness } from "@/lib/payments/stripe-payment-methods";
import { prisma } from "@/lib/prisma";

import { StripeSetupExperience } from "./_components/provider-actions";

function money(value: { toString(): string } | null | undefined) {
  return `$${Number(value?.toString() ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusVariant(status: string) {
  return status === "succeeded" || status === "active" ? "default" : status === "failed" ? "destructive" : "outline";
}

export default async function PaymentsPage({ searchParams }: { searchParams?: Promise<{ stripe?: string }> }) {
  const authorization = await getPermittedDashboardAuthorization("payments.view");
  if (!authorization) {
    return (
      <AuthRequiredState title="Payments access required" description="You do not have permission to view payments." />
    );
  }

  const configured = isStripeConfigured();
  const existingConnection = await prisma.paymentProviderConnection.findUnique({
    where: { ownerId_provider: { ownerId: authorization.workspaceId, provider: "stripe" } },
  });
  let connection = existingConnection;
  let paymentMethods: StripePaymentMethodReadiness | null = null;
  if (configured && existingConnection && existingConnection.status !== "disconnected") {
    try {
      const synced = await syncStripeProviderConnection(authorization.workspaceId);
      connection = synced.connection;
      paymentMethods = synced.paymentMethods;
    } catch (error) {
      console.error("Stripe connection status could not be refreshed.", error);
    }
  }

  const [payments, paymentHealth] = await Promise.all([
    prisma.jobPayment.findMany({
      where: { ownerId: authorization.workspaceId },
      include: { invoice: { select: { customerName: true, invoiceNumber: true } } },
      orderBy: [{ paidOn: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    getWorkspacePaymentHealth(authorization.workspaceId),
  ]);
  const resolvedSearchParams = await searchParams;
  const canManageProviders = can(authorization.membership, "payments.settings.manage");
  const ready = connection?.accountType === "standard" && connection.status === "active" && connection.chargesEnabled;
  const requiresStandardReconnect = Boolean(
    connection && connection.status !== "disconnected" && connection.accountType !== "standard",
  );
  const fee = getApplicationFeeConfig();
  const returnedFromStripe = resolvedSearchParams?.stripe === "returned";
  const health = {
    canManage: canManageProviders,
    failedRefunds: paymentHealth.failedRefunds,
    healthy: paymentHealth.healthy,
    issueCount: paymentHealth.issueCount,
    lastProcessedAt: paymentHealth.lastProcessedAt?.toISOString() ?? null,
    openDisputes: paymentHealth.openDisputes,
    webhookIssues: paymentHealth.webhookIssues.map((issue) => ({
      ...issue,
      nextAttemptAt: issue.nextAttemptAt?.toISOString() ?? null,
      receivedAt: issue.receivedAt.toISOString(),
    })),
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4" /> Payments
          </CardTitle>
          <CardDescription>Connect payment providers and review invoice transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <StripeSetupExperience
            canManage={canManageProviders}
            configured={configured}
            connected={Boolean(connection && connection.status !== "disconnected")}
            feeLabel={`${fee.basisPoints / 100}%${
              fee.fixedMinorUnits ? ` + ${money({ toString: () => (fee.fixedMinorUnits / 100).toFixed(2) })}` : ""
            }`}
            health={health}
            paymentMethods={paymentMethods}
            ready={ready}
            requiresReconnect={requiresStandardReconnect}
            returnedIncomplete={returnedFromStripe}
            showReadyCelebration={ready && returnedFromStripe}
            status={connection?.status ?? "not_connected"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>The latest 100 manual and online payment records.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer / invoice</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length ? (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(payment.paidOn, "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <div>{payment.invoice?.customerName ?? payment.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {payment.invoice?.invoiceNumber ?? "No invoice"}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{payment.provider}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payment.status)}>{payment.status.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(payment.amount)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
