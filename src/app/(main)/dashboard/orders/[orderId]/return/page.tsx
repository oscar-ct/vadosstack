import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import { ReturnReceiptActions } from "./_components/return-actions";
import { ReturnRefundWorkspace } from "./_components/return-workspace";
import { formatMoney, getReturnRefundWorkspaceData } from "./_lib/return-data";
import { emailReturnReceiptAction } from "./actions";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to manage returns"
        description="Return and refund records are private to each signed-in account."
      />
    );
  }

  const { orderId } = await params;
  const [workspaceData, googleMailAccount] = await Promise.all([
    getReturnRefundWorkspaceData(currentUser.id, orderId),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
  ]);

  if (!workspaceData) {
    return (
      <AuthRequiredState
        title="Order not found"
        description="This order may have been deleted or you may not have access to it."
      />
    );
  }

  const returnDate = workspaceData.values.returnDate
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${workspaceData.values.returnDate}T12:00:00`))
    : "Return date pending";
  const templates = await getRenderedDocumentEmailTemplates({
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
    ownerId: currentUser.id,
    scope: "return-receipt",
  });

  return (
    <ReturnRefundWorkspace
      company={workspaceData.company}
      defaultValues={workspaceData.values}
      emailAction={
        workspaceData.returnId ? (
          <ReturnReceiptActions
            action={emailReturnReceiptAction}
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
