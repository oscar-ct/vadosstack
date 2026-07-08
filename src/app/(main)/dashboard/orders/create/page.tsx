import { AuthRequiredState } from "@/components/auth-required-state";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyLogoSrc } from "@/lib/company-logo";

import { getOrderCount, getOrderCustomers, getOrderInventoryItems } from "../_lib/order-data";
import { blankOrderValues, formatOrderNumberFromCount } from "./_components/data";
import { OrderWorkspace } from "./_components/order";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to create orders"
        description="Order records are private to each signed-in account."
      />
    );
  }

  const [customers, inventoryItems, orderCount] = await Promise.all([
    getOrderCustomers(currentUser.id),
    getOrderInventoryItems(currentUser.id),
    getOrderCount(currentUser.id),
  ]);
  const companyLogoSrc = await getCompanyLogoSrc(currentUser.id);
  const company = {
    address: currentUser.companyAddress,
    email: currentUser.companyEmail ?? currentUser.email,
    logoSrc: companyLogoSrc,
    name: currentUser.companyName,
    phone: currentUser.companyPhone,
  };
  const defaultValues = {
    ...blankOrderValues,
    footerMessage: currentUser.orderMessageText,
    orderNumber: formatOrderNumberFromCount(orderCount + 1),
  };

  return (
    <OrderWorkspace
      company={company}
      customers={customers}
      defaultValues={defaultValues}
      description="Add order details, review the confirmation preview, and save it when the order workflow is ready."
      inventoryItems={inventoryItems}
      mode="create"
      title="Create Order"
    />
  );
}
