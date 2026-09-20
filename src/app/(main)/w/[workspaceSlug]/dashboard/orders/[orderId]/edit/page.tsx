import { RotateCcw } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import { OrderActions } from "../../_components/order-actions";
import { getOrderCustomers, getOrderFormValues, getOrderInventoryItems } from "../../_lib/order-data";
import { getOrderDocumentData } from "../../_lib/order-document";
import { emailOrderAction } from "../../actions";
import { OrderWorkspace } from "../../create/_components/order";

type PageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const authorization = await getPermittedDashboardAuthorization("orders.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view orders"
        description="Order records are private to each signed-in account."
      />
    );
  }
  const workspaceId = authorization.workspaceId;
  const canEdit = can(authorization.membership, "orders.update");
  const canManageReturns = can(authorization.membership, "orders.returns.manage");
  const canSend = can(authorization.membership, "email.send");
  const canManageGmailAccount = can(authorization.membership, "email.account.manage");

  const { orderId } = await params;
  const [order, customers, inventoryItems, googleMailAccount, documentData, orderReturn, workspace] = await Promise.all(
    [
      getOrderFormValues(workspaceId, orderId),
      can(authorization.membership, "customers.view") ? getOrderCustomers(workspaceId) : [],
      can(authorization.membership, "inventory.view") ? getOrderInventoryItems(workspaceId) : [],
      canSend ? prisma.googleMailAccount.findUnique({ where: { workspaceId } }) : null,
      getOrderDocumentData(workspaceId, orderId),
      prisma.orderReturn.findFirst({
        where: {
          orderId,
          ownerId: workspaceId,
        },
        select: {
          returnNumber: true,
        },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { legacyOwner: { select: { email: true } } },
      }),
    ],
  );

  if (!order || !documentData || !workspace) {
    return (
      <AuthRequiredState
        title="Order not found"
        description="This order may have been deleted or you may not have access to it."
      />
    );
  }

  const companyLogoSrc = await getCompanyLogoSrc(workspaceId);
  const company = {
    address: workspace.companyAddress,
    email: workspace.companyEmail ?? workspace.legacyOwner?.email ?? authorization.principal.user.email,
    logoSrc: companyLogoSrc,
    name: workspace.name,
    phone: workspace.companyPhone,
  };
  const orderTitle = order.paymentStatus === "Paid" ? "Order Receipt" : "Order Confirmation";
  const templates = canSend
    ? await getRenderedDocumentEmailTemplates({
        context: {
          companyEmail: company.email,
          companyName: company.name,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          estimatedDelivery: documentData.estimatedDelivery,
          fulfillmentStatus: order.fulfillmentStatus,
          orderDate: documentData.orderDate,
          orderNumber: order.orderNumber,
          orderTitle,
          orderTitleLower: orderTitle.toLowerCase(),
          orderTotal: documentData.total,
          paymentStatus: order.paymentStatus,
          trackingNumber: order.trackingNumber,
        },
        ownerId: workspaceId,
        scope: "order",
      })
    : [];

  return (
    <OrderWorkspace
      canEdit={canEdit}
      company={company}
      customers={customers}
      defaultValues={order}
      description="Review this order in read-only mode. Unlock it when you need to make changes."
      headerActions={
        canManageReturns ? (
          <Button asChild variant={orderReturn ? "default" : "outline"} size="sm" className="min-w-32 justify-center">
            <Link href={`/dashboard/orders/${orderId}/return`}>
              <RotateCcw />
              {orderReturn ? `View ${orderReturn.returnNumber}` : "Start return/refund"}
            </Link>
          </Button>
        ) : null
      }
      inventoryItems={inventoryItems}
      mode="edit"
      orderId={orderId}
      previewActions={
        canSend ? (
          <OrderActions
            action={emailOrderAction}
            canManageGmailAccount={canManageGmailAccount}
            companyName={company.name}
            customerEmail={order.customerEmail}
            customerName={order.customerName}
            fulfillmentStatus={order.fulfillmentStatus}
            gmailConnected={Boolean(googleMailAccount)}
            gmailSenderEmail={googleMailAccount?.email}
            orderDate={documentData.orderDate}
            orderId={orderId}
            orderNumber={order.orderNumber}
            orderTitle={orderTitle}
            orderTotal={documentData.total}
            paymentStatus={order.paymentStatus}
            returnTo={`/dashboard/orders/${orderId}/edit`}
            templates={templates}
          />
        ) : null
      }
      title={`Order ${order.orderNumber}`}
    />
  );
}
