import z from "zod";

const customerAddressSchema = z.object({
  label: z.string().optional(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const recentCustomersSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  billing: z.string(),
  joined: z.string(),
  lastScheduledJobDate: z.string().optional(),
  jobCount: z.number(),
  lastOrderDate: z.string().optional(),
  orderCount: z.number().optional(),
  returnedOrderCount: z.number().optional(),
  totalOrderRefunded: z.string().optional(),
  totalOrderRefundedValue: z.number().optional(),
  totalOrderSpent: z.string().optional(),
  totalOrderSpentValue: z.number().optional(),
  outstandingAmount: z.string().optional(),
  address: customerAddressSchema.optional(),
  addresses: z.array(customerAddressSchema).optional(),
  phoneNumbers: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  jobHistory: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        date: z.string(),
        total: z.string().optional(),
        amountPaid: z.string().optional(),
        paymentStatus: z.string().optional(),
        outstandingAmount: z.string().optional(),
        linkedJobId: z.string().optional(),
      }),
    )
    .optional(),
  unpaidJobs: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        date: z.string(),
        balance: z.string(),
        paymentStatus: z.string().optional(),
        linkedJobId: z.string().optional(),
        linkedInvoiceId: z.string().optional(),
      }),
    )
    .optional(),
  invoiceHistory: z
    .array(
      z.object({
        id: z.string(),
        status: z.string(),
        issuedAt: z.string(),
        dueAt: z.string().optional(),
        total: z.string(),
        balance: z.string().optional(),
      }),
    )
    .optional(),
  orderHistory: z
    .array(
      z.object({
        id: z.string(),
        orderNumber: z.string(),
        paymentStatus: z.string(),
        fulfillmentStatus: z.string(),
        orderedAt: z.string(),
        total: z.string(),
        totalValue: z.number(),
        itemCount: z.number(),
        returnNumber: z.string().optional(),
        refundAmount: z.string().optional(),
        refundAmountValue: z.number().optional(),
        refundStatus: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export type RecentCustomerRow = z.infer<typeof recentCustomersSchema>;
