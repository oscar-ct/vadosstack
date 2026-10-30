import { AuthRequiredState } from "@/components/auth-required-state";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import { ReturnReceiptActions } from "./_components/return-actions";
import { ReturnRefundWorkspace } from "./_components/return-workspace";
import { formatMoney, getReturnRefundWorkspaceData } from "./_lib/return-data";
import { emailReturnReceiptAction } from "./actions";

type PageProps = {
  searchParams: Promise<{ returnId?: string; new?: string }>;
  params: Promise<{
    orderId: string;
  }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("orders.returns.manage");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Returns access required"
        description="You do not have permission to manage returns and refunds in this workplace."
      />
    );
  }

  const { orderId } = await params;
  const query = await searchParams;
  const workspaceId = authorization.workspaceId;
  const canSendEmail = can(authorization.membership, "email.send");
  const canManageGmailAccount = can(authorization.membership, "email.account.manage");
  const [workspaceData, googleMailAccount] = await Promise.all([
    getReturnRefundWorkspaceData(workspaceId, orderId, query.new === "1" ? null : query.returnId),
    canSendEmail
      ? prisma.googleMailAccount.findUnique({
          where: {
            workspaceId,
          },
        })
      : null,
  ]);

  if (!workspaceData) {
    return (
      <AuthRequiredState
        title="Order not found"
        description="This order may have been deleted or you may not have access to it."
      />
    );
  }

  if (!workspaceData.returnId && !workspaceData.values.items.length)
    return (
      <div className="grid gap-3">
        <h1 className="font-medium text-xl">All order items have been resolved</h1>
        <p>Open an existing return from the order history to review its receipt.</p>
        <Link className="underline" href={`/dashboard/orders/${orderId}/edit`}>
          Back to order
        </Link>
      </div>
    );

  const returnDate = workspaceData.values.returnDate
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${workspaceData.values.returnDate}T12:00:00`))
    : "Return date pending";
  const templates = canSendEmail
    ? await getRenderedDocumentEmailTemplates({
        context: {
          companyEmail: workspaceData.company.email,
          companyName: workspaceData.company.name,
          customerEmail: workspaceData.values.customerEmail,
          customerName: workspaceData.values.customerName,
          orderNumber: workspaceData.values.orderNumber,
          refundAmount: formatMoney(workspaceData.values.refundAmount),
          refundMethod: workspaceData.values.refundMethod,
          refundStatus: workspaceData.values.refundStatus,
          returnDate,
          returnNumber: workspaceData.values.returnNumber,
        },
        ownerId: workspaceId,
        scope: "return-receipt",
      })
    : [];

  return (
    <ReturnRefundWorkspace
      key={workspaceData.returnId ?? `new-${workspaceData.values.orderVersion}`}
      company={workspaceData.company}
      defaultValues={workspaceData.values}
      emailAction={
        workspaceData.returnId && canSendEmail ? (
          <ReturnReceiptActions
            action={emailReturnReceiptAction.bind(null, workspaceData.returnId)}
            canManageGmailAccount={canManageGmailAccount}
            companyName={workspaceData.company.name}
            customerEmail={workspaceData.values.customerEmail}
            customerName={workspaceData.values.customerName}
            gmailConnected={Boolean(googleMailAccount)}
            gmailSenderEmail={googleMailAccount?.email}
            orderId={orderId}
            refundAmount={formatMoney(workspaceData.values.refundAmount)}
            returnDate={returnDate}
            returnNumber={workspaceData.values.returnNumber}
            returnTo={`/dashboard/orders/${orderId}/return`}
            templates={templates}
          />
        ) : null
      }
      orderId={orderId}
      returnId={workspaceData.returnId}
    />
  );
}
