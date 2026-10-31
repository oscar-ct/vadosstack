import { AuthRequiredState } from "@/components/auth-required-state";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";
import { getCompanyLogoSrc } from "@/lib/company-logo";
import { peekNextDocumentNumber } from "@/lib/document-numbering";
import { prisma } from "@/lib/prisma";

import { getOrderCustomers, getOrderInventoryItems } from "../_lib/order-data";
import { blankOrderValues } from "./_components/data";
import { OrderWorkspace } from "./_components/order";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("orders.create");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to create orders"
        description="Order records are private to each signed-in account."
      />
    );
  }
  const workspaceId = authorization.workspaceId;

  const [customers, inventoryItems, nextOrderNumber, workspace] = await Promise.all([
    can(authorization.membership, "customers.view") ? getOrderCustomers(workspaceId) : [],
    can(authorization.membership, "inventory.view") ? getOrderInventoryItems(workspaceId) : [],
    peekNextDocumentNumber(workspaceId, "order"),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { legacyOwner: { select: { email: true } } },
    }),
  ]);
  if (!workspace) {
    return <AuthRequiredState title="Workspace unavailable" description="This workspace could not be loaded." />;
  }
  const companyLogoSrc = await getCompanyLogoSrc(workspaceId);
  const company = {
    address: workspace.companyAddress,
    email: workspace.companyEmail ?? workspace.legacyOwner?.email ?? authorization.principal.user.email,
    logoSrc: companyLogoSrc,
    name: workspace.name,
    phone: workspace.companyPhone,
  };
  const defaultValues = {
    ...blankOrderValues,
    footerMessage: workspace.orderMessageText,
    tax: Number(workspace.defaultOrderTaxRate),
    orderNumber: nextOrderNumber,
  };

  return (
    <OrderWorkspace
      canRecordPayment={can(authorization.membership, "orders.payments.manage")}
      canOverridePrices={can(authorization.membership, "orders.prices.override")}
      company={company}
      customers={customers}
      defaultValues={defaultValues}
      description="Choose a customer, add items, then review and create the order."
      inventoryItems={inventoryItems}
      mode="create"
      title="Create Order"
    />
  );
}
