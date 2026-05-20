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
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export type RecentCustomerRow = z.infer<typeof recentCustomersSchema>;
