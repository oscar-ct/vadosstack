import { RotateCcw } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view orders"
        description="Order records are private to each signed-in account."
      />
    );
  }

  const { orderId } = await params;
  const [order, customers, inventoryItems, googleMailAccount, documentData] = await Promise.all([
    getOrderFormValues(currentUser.id, orderId),
    getOrderCustomers(currentUser.id),
    getOrderInventoryItems(currentUser.id),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
    getOrderDocumentData(currentUser.id, orderId),
  ]);

  if (!order || !documentData) {
    return (
      <AuthRequiredState
        title="Order not found"
        description="This order may have been deleted or you may not have access to it."
      />
    );
  }

  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
  const company = {
    address: currentUser.companyAddress,
    email: currentUser.companyEmail ?? currentUser.email,
    logoSrc: companyLogoSrc,
    name: currentUser.companyName,
    phone: currentUser.companyPhone,
  };
  const orderTitle = order.paymentStatus === "Paid" ? "Order Receipt" : "Order Confirmation";
  const templates = await getRenderedDocumentEmailTemplates({
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
    ownerId: currentUser.id,
    scope: "order",
  });

  return (
    <OrderWorkspace
      company={company}
      customers={customers}
      defaultValues={order}
      description="Review this order in read-only mode. Unlock it when you need to make changes."
      headerActions={
        <Button type="button" variant="outline" size="sm" className="min-w-32 justify-center" disabled>
          <RotateCcw />
          Start return/refund
        </Button>
      }
      inventoryItems={inventoryItems}
      mode="edit"
      orderId={orderId}
      previewActions={
        <OrderActions
          action={emailOrderAction}
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
      }
      title={`Order ${order.orderNumber}`}
    />
  );
}
