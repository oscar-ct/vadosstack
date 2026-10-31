import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import { OrderActions } from "../../_components/order-actions";
import { OrderOperations } from "../../_components/order-operations";
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
  const [order, customers, inventoryItems, googleMailAccount, documentData, workspace] = await Promise.all([
    getOrderFormValues(workspaceId, orderId),
    can(authorization.membership, "customers.view") ? getOrderCustomers(workspaceId) : [],
    can(authorization.membership, "inventory.view") ? getOrderInventoryItems(workspaceId) : [],
    canSend ? prisma.googleMailAccount.findUnique({ where: { workspaceId } }) : null,
    getOrderDocumentData(workspaceId, orderId),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { legacyOwner: { select: { email: true } } },
    }),
  ]);

  if (!order || !documentData || !workspace) {
    return (
      <AuthRequiredState
        title="Order not found"
        description="This order may have been deleted or you may not have access to it."
      />
    );
  }

  const operations = await prisma.order.findFirstOrThrow({
    where: { id: orderId, ownerId: workspaceId },
    include: {
      items: true,
      payments: { orderBy: { paidAt: "asc" } },
      refunds: { where: { status: "succeeded" }, orderBy: { refundedAt: "asc" } },
      shipments: { include: { reversal: true }, orderBy: { shippedAt: "asc" } },
      returns: { orderBy: { createdAt: "asc" } },
    },
  });
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
      key={operations.version}
      operations={
        <OrderOperations
          canManageMoney={can(authorization.membership, "orders.payments.manage")}
          canShip={canEdit}
          canManageReturns={canManageReturns}
          order={{
            id: operations.id,
            orderNumber: operations.orderNumber,
            version: operations.version,
            total: Number(operations.total),
            orderStatus: operations.orderStatus,
            reservationExpiresAt: operations.reservationExpiresAt?.toISOString() ?? null,
            items: operations.items.map((item) => ({
              id: item.id,
              product: item.product,
              quantity: item.quantity,
              shippedQuantity: item.shippedQuantity,
            })),
            payments: operations.payments.map((entry) => ({
              id: entry.id,
              amount: Number(entry.amount),
              method: entry.method,
              reference: entry.reference,
              source: entry.source,
            })),
            refunds: operations.refunds.map((entry) => ({
              id: entry.id,
              paymentId: entry.paymentId,
              orderReturnId: entry.orderReturnId,
              amount: Number(entry.amount),
              method: entry.method,
              reference: entry.reference,
            })),
            returns: operations.returns.map((entry) => ({
              id: entry.id,
              returnNumber: entry.returnNumber,
              refundAmount: Number(entry.refundAmount),
              refundState: entry.refundState,
            })),
            shipments: operations.shipments.map((entry) => ({
              id: entry.id,
              carrier: entry.carrier,
              trackingNumber: entry.trackingNumber,
              shippedAt: entry.shippedAt.toISOString(),
              reversal: entry.reversal
                ? { reason: entry.reversal.reason, reversedAt: entry.reversal.reversedAt.toISOString() }
                : null,
            })),
          }}
        />
      }
      canEdit={canEdit && operations.orderStatus === "Active"}
      canOverridePrices={can(authorization.membership, "orders.prices.override")}
      company={company}
      customers={customers}
      defaultValues={order}
      description="Review this order in read-only mode. Unlock it when you need to make changes."
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
