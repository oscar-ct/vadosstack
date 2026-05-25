import z from "zod";

const customerAddressSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

const jobPaymentSchema = z.object({
  id: z.string(),
  paidOn: z.string(),
  amount: z.string(),
  paymentType: z.string().default("deposit"),
  method: z.string(),
  referenceNumber: z.string().optional(),
  description: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const jobCustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  addresses: z.array(customerAddressSchema),
});

export const jobRowSchema = z.object({
  id: z.string(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  description: z.string(),
  serviceLocation: z.string().optional(),
  dateBegin: z.string().optional(),
  dateEnd: z.string().optional(),
  estimatedCost: z.string().optional(),
  laborCost: z.string().optional(),
  laborItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.string().optional(),
      unit: z.string().optional(),
      unitPrice: z.string().optional(),
      price: z.string(),
    }),
  ),
  materialTaxRate: z.string().optional(),
  materials: z.array(
    z.object({
      description: z.string(),
      type: z.enum(["purchase", "return"]).optional(),
      vendor: z.string().optional(),
      purchaseDate: z.string().optional(),
      quantity: z.string(),
      unit: z.string().optional(),
      unitPrice: z.string(),
      price: z.string(),
    }),
  ),
  paymentStatus: z.string(),
  depositPaid: z.string().optional(),
  amountPaid: z.string().optional(),
  outstandingBalance: z.string().optional(),
  finalCost: z.string().optional(),
  scope: z.string().optional(),
  category: z.string(),
  status: z.string(),
  pictures: z.array(z.string()),
  notes: z.string().optional(),
  payments: z.array(jobPaymentSchema),
  invoiceId: z.string().optional(),
  invoiceIssuedAt: z.string().optional(),
  estimateId: z.string().optional(),
  estimateIssuedAt: z.string().optional(),
  createdAt: z.string(),
});

export type JobCustomer = z.infer<typeof jobCustomerSchema>;
export type JobRow = z.infer<typeof jobRowSchema>;
