import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { adjustmentCredit } from "@/lib/commerce/order-cancellation";
import { getOrderEditPolicy } from "@/lib/commerce/order-edit-policy";
import { getOrderListSummary } from "@/lib/commerce/order-list-summary";
import { type OrderResolutionRecord, orderRecordStatus } from "@/lib/commerce/order-resolution";
import {
  formatMoney,
  getReturnedItemsDiscount,
  getReturnedItemsSubtotal,
  getReturnedItemsTax,
  type ReturnRefundFormValues,
} from "@/lib/commerce/returns";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { getRenderedDocumentEmailTemplates } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

import { OrderActions } from "../../_components/order-actions";
import { OrderOperations } from "../../_components/order-operations";
import { ReceiveReturnedItems } from "../../_components/receive-returned-items";
import { getOrderCustomers, getOrderFormValues, getOrderInventoryItems } from "../../_lib/order-data";
import { getOrderDocumentData } from "../../_lib/order-document";
import { emailOrderAction, emailOriginalOrderAction } from "../../actions";
import { OrderWorkspace } from "../../create/_components/order";
import { ReturnReceiptActions } from "../return/_components/return-actions";
import { getSavedReturnRefundWorkspaces } from "../return/_lib/return-data";
import { emailReturnReceiptAction } from "../return/actions";

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
      items: {
        include: {
          returnItems: { select: { returnQuantity: true, orderReturnId: true, disposition: true } },
          physicalReturnItems: { select: { receivedQuantity: true, receipt: { select: { orderReturnId: true } } } },
          adjustmentItems: { include: { adjustment: { select: { kind: true } } } },
        },
      },
      adjustments: {
        include: { items: { include: { orderItem: { select: { product: true } } } } },
        orderBy: { effectiveAt: "asc" },
      },
      shippingExpenses: { where: { ownerId: workspaceId }, orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }] },
      payments: { orderBy: { paidAt: "asc" } },
      refunds: { where: { status: "succeeded" }, orderBy: { refundedAt: "asc" } },
      shipments: { include: { reversal: true }, orderBy: { shippedAt: "asc" } },
      returns: { orderBy: { createdAt: "asc" } },
    },
  });
  const summary = getOrderListSummary(operations);
  const savedResolutions = canManageReturns ? await getSavedReturnRefundWorkspaces(workspaceId, orderId) : [];
  const pendingCredit = new Map<string, number>();
  let creditRemaining = Math.round(summary.creditOwed * 100);
  for (const adjustment of operations.adjustments) {
    const refunded = operations.refunds
      .filter((entry) => entry.adjustmentId === adjustment.id)
      .reduce((sum, entry) => sum + Math.round(Number(entry.amount) * 100), 0);
    const available = Math.max(
      Math.round(
        adjustmentCredit({
          merchandiseAmount: Number(adjustment.merchandiseAmount),
          discountAmount: Number(adjustment.discountAmount),
          taxAmount: Number(adjustment.taxAmount),
          shippingAmount: Number(adjustment.shippingAmount),
        }) * 100,
      ) - refunded,
      0,
    );
    const pending = Math.min(available, creditRemaining);
    pendingCredit.set(adjustment.id, pending / 100);
    creditRemaining -= pending;
  }
  const linkedAdjustments = new Set<string>();
  const resolutions: OrderResolutionRecord[] = savedResolutions.flatMap<OrderResolutionRecord>(
    ({ values, returnId }) => {
      const receipt = operations.returns.find((entry) => entry.id === returnId);
      if (!receipt) return [];
      const adjustment = receipt.submissionKey
        ? operations.adjustments.find((entry) => entry.idempotencyKey === `${receipt.submissionKey}:cancel`)
        : undefined;
      if (adjustment) linkedAdjustments.add(adjustment.id);
      const paidReturnRefunds = operations.refunds
        .filter((entry) => entry.orderReturnId === receipt.id)
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const pendingReturn = ["requested", "partially_refunded"].includes(receipt.refundState)
        ? Math.max(Number(receipt.refundAmount) - paidReturnRefunds, 0)
        : 0;
      const pending = pendingReturn + (adjustment ? (pendingCredit.get(adjustment.id) ?? 0) : 0);
      const hasCancellation = values.items.some((item) => item.cancelQuantity > 0);
      const hasReturn = values.items.some((item) => item.returnQuantity > 0);
      const state =
        pending > 0
          ? values.refundAmount > 0
            ? "partially_refunded"
            : "requested"
          : values.refundAmount > 0
            ? "succeeded"
            : receipt.refundState;
      return [
        {
          id: receipt.id,
          reference: values.returnNumber,
          date: receipt.returnDate.toISOString(),
          kind: hasCancellation ? (hasReturn ? "Mixed" : "Cancellation") : hasReturn ? "Return" : "Credit",
          refundState: state,
          refunded: values.refundAmount,
          requestedRefund: values.refundAmount + pending,
          credit:
            getReturnedItemsSubtotal(values) -
            getReturnedItemsDiscount(values) +
            getReturnedItemsTax(values) +
            Number(adjustment?.shippingAmount ?? 0),
          reason: receipt.reason ?? adjustment?.reason ?? "",
          values: { ...values, refundState: state },
        },
      ];
    },
  );
  if (canManageReturns || canEdit)
    for (const adjustment of operations.adjustments) {
      if (
        linkedAdjustments.has(adjustment.id) ||
        operations.returns.some(
          (receipt) => receipt.submissionKey && adjustment.idempotencyKey === `${receipt.submissionKey}:cancel`,
        )
      )
        continue;
      const credit = adjustmentCredit({
        merchandiseAmount: Number(adjustment.merchandiseAmount),
        discountAmount: Number(adjustment.discountAmount),
        taxAmount: Number(adjustment.taxAmount),
        shippingAmount: Number(adjustment.shippingAmount),
      });
      const refunds = operations.refunds.filter((entry) => entry.adjustmentId === adjustment.id);
      const refunded = refunds.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const pending = pendingCredit.get(adjustment.id) ?? 0;
      const refundState =
        pending > 0 ? (refunded > 0 ? "partially_refunded" : "requested") : refunded > 0 ? "succeeded" : "not_required";
      const reference =
        adjustment.kind === "Cancellation" ? `${order.orderNumber} · Cancellation` : `${order.orderNumber} · Credit`;
      const values: ReturnRefundFormValues = {
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerNote: "",
        internalNotes: "",
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        originalDiscountAmount: order.discount,
        originalSubtotal: Number(operations.subtotal),
        originalTaxAmount: Number(operations.taxAmount),
        originalTotal: Number(operations.total),
        paymentId: "",
        reason: adjustment.reason,
        refundAmount: refunded,
        refundExplanation: "",
        refundMethod: refunds[0]?.method ?? "",
        refundReference: refunds[0]?.reference ?? "",
        refundStatus: refunded > 0 ? "Other" : "No Refund",
        refundState,
        returnDate: adjustment.effectiveAt.toISOString().slice(0, 10),
        returnNumber: reference,
        returnStatus: "Returned",
        restockItems: false,
        shippingAddressLines: [],
        items: adjustment.items.map((entry) => {
          const item = operations.items.find((line) => line.id === entry.orderItemId);
          if (!item) throw new Error("The resolution references a missing order item.");
          return {
            id: entry.id,
            orderItemId: item.id,
            product: item.product,
            description: item.description,
            unit: item.unit,
            sku: item.sku ?? "",
            category: item.category ?? "",
            taxable: item.taxable,
            taxRate: Number(item.taxRate),
            unitPrice: Number(item.unitPrice),
            orderedQuantity: entry.quantity,
            originalQuantity: entry.quantity,
            cancelQuantity: entry.quantity,
            cancellableQuantity: entry.quantity,
            returnQuantity: 0,
            returnableQuantity: 0,
            restock: false,
            disposition: "Returned",
            originalDiscountAmount: Number(entry.discountAmount),
            originalTaxAmount: Number(entry.taxAmount),
          };
        }),
      };
      resolutions.push({
        id: adjustment.id,
        reference,
        date: adjustment.effectiveAt.toISOString(),
        kind: adjustment.kind === "Cancellation" ? "Cancellation" : "Credit",
        refundState,
        refunded,
        requestedRefund: refunded + pending,
        credit,
        reason: adjustment.reason,
        values,
      });
    }
  resolutions.sort((left, right) => right.date.localeCompare(left.date));
  const companyLogoSrc = await getCompanyLogoSrc(workspaceId);
  const company = {
    address: workspace.companyAddress,
    email: workspace.companyEmail ?? workspace.legacyOwner?.email ?? authorization.principal.user.email,
    logoSrc: companyLogoSrc,
    name: workspace.name,
    phone: workspace.companyPhone,
  };
  const orderTitle =
    resolutions.length > 0 ? "Original Order" : order.paymentStatus === "Paid" ? "Order Receipt" : "Order Confirmation";
  const displayedOrderTotal = resolutions.length > 0 ? formatMoney(Number(operations.total)) : documentData.total;
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
          orderTotal: displayedOrderTotal,
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
      receiptActions={
        canManageReturns
          ? Object.fromEntries(
              savedResolutions
                .filter((entry) => entry.returnId && entry.values.items.some((item) => item.returnQuantity > 0))
                .map((entry) => [
                  entry.returnId,
                  <ReceiveReturnedItems key={entry.returnId} orderId={orderId} returnId={entry.returnId ?? ""} />,
                ]),
            )
          : undefined
      }
      resolutionActions={
        canSend
          ? Object.fromEntries(
              savedResolutions
                .filter((entry) => entry.returnId)
                .map(({ values, returnId }) => [
                  returnId,
                  <ReturnReceiptActions
                    key={returnId}
                    action={emailReturnReceiptAction.bind(null, returnId ?? null)}
                    canManageGmailAccount={canManageGmailAccount}
                    companyName={company.name}
                    customerEmail={values.customerEmail}
                    customerName={values.customerName}
                    gmailConnected={Boolean(googleMailAccount)}
                    gmailSenderEmail={googleMailAccount?.email}
                    orderId={orderId}
                    refundAmount={formatMoney(values.refundAmount)}
                    returnDate={values.returnDate}
                    returnNumber={values.returnNumber}
                    returnTo={`/dashboard/orders/${orderId}/edit`}
                  />,
                ]),
            )
          : undefined
      }
      recordSummary={summary}
      resolutions={resolutions}
      operations={
        <OrderOperations
          resolutionBrowser={resolutions.length > 0}
          canManageMoney={can(authorization.membership, "orders.payments.manage")}
          canShip={canEdit}
          canManageReturns={canManageReturns}
          order={{
            summary,
            id: operations.id,
            orderNumber: operations.orderNumber,
            deliveryMethod: order.deliveryMethod ?? "delivery",
            version: operations.version,
            total: Number(operations.total),
            shippingAmount: Number(operations.shippingAmount),
            orderStatus: operations.orderStatus,
            reservationExpiresAt: operations.reservationExpiresAt?.toISOString() ?? null,
            items: operations.items.map((item) => ({
              id: item.id,
              product: item.product,
              quantity: item.quantity,
              shippedQuantity: item.shippedQuantity,
              returnedQuantity: item.returnItems.reduce((sum, entry) => sum + entry.returnQuantity, 0),
              cancelledQuantity: item.adjustmentItems.reduce(
                (sum, entry) => sum + (entry.adjustment.kind === "Cancellation" ? entry.quantity : 0),
                0,
              ),
              lineTotal: Number(item.lineTotal),
              discountAmount: Number(item.discountAmount),
              taxAmount: Number(item.taxAmount),
            })),
            adjustments: operations.adjustments.map((entry) => ({
              id: entry.id,
              kind: entry.kind,
              merchandiseAmount: Number(entry.merchandiseAmount),
              discountAmount: Number(entry.discountAmount),
              taxAmount: Number(entry.taxAmount),
              shippingAmount: Number(entry.shippingAmount),
              reason: entry.reason,
              effectiveAt: entry.effectiveAt.toISOString(),
              items: entry.items.map((item) => ({
                id: item.id,
                product: item.orderItem.product,
                quantity: item.quantity,
                grossAmount: Number(item.grossAmount),
                discountAmount: Number(item.discountAmount),
                taxAmount: Number(item.taxAmount),
              })),
            })),
            shippingExpenses: operations.shippingExpenses.map((entry) => ({
              id: entry.id,
              kind: entry.kind,
              amount: Number(entry.amount),
              date: entry.incurredAt.toISOString(),
              reference: entry.reference,
              notes: entry.notes,
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
              adjustmentId: entry.adjustmentId,
              amount: Number(entry.amount),
              method: entry.method,
              reference: entry.reference,
              batchKey: entry.idempotencyKey.replace(/:\d{3}$/, ""),
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
      editPolicy={getOrderEditPolicy(operations)}
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
            action={resolutions.length > 0 ? emailOriginalOrderAction : emailOrderAction}
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
            orderTotal={displayedOrderTotal}
            paymentStatus={order.paymentStatus}
            returnTo={`/dashboard/orders/${orderId}/edit`}
            templates={templates}
          />
        ) : null
      }
      statusBadge={
        <Badge
          variant="outline"
          className={
            summary.refundDue > 0
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
              : summary.refunded > 0
                ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300"
                : operations.orderStatus === "Active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          }
        >
          {orderRecordStatus(summary, operations.orderStatus)}
        </Badge>
      }
      title={`Order ${order.orderNumber}`}
    />
  );
}
