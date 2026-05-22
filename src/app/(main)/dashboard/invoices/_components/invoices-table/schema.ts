import z from "zod";

const invoicePaymentSchema = z.object({
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

export const invoiceTableItemSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  customerName: z.string().optional(),
  invoiceNumber: z.string(),
  href: z.string(),
  issuedAt: z.string(),
  dueAt: z.string(),
  jobTitle: z.string(),
  jobDescription: z.string().optional(),
  jobNumber: z.string(),
  jobHref: z.string(),
  paymentStatus: z.string(),
  laborCost: z.string(),
  materialsSubtotal: z.string(),
  materialTaxAmount: z.string(),
  depositPaid: z.string(),
  amountPaid: z.string(),
  balanceDue: z.string(),
  total: z.string(),
  jobServiceLocation: z.string(),
  payments: z.array(invoicePaymentSchema),
});

export type InvoiceTableItem = z.infer<typeof invoiceTableItemSchema>;
