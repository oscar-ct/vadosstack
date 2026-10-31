export const orderSteps = [
  { id: "customer", title: "Customer", description: "Choose who the order is for and how they will receive it." },
  { id: "items", title: "Items", description: "Choose products, quantities, and any agreed price overrides." },
  {
    id: "review",
    title: "Review & payment",
    description: "Review the total, then confirm order, payment, and fulfillment details.",
  },
] as const;

export type OrderStep = (typeof orderSteps)[number]["id"];
