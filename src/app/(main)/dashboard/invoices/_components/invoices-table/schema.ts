import z from "zod";

export const invoiceTableItemSchema = z.object({
  customerName: z.string().optional(),
  invoiceNumber: z.string(),
  href: z.string(),
  issuedAt: z.string(),
  jobTitle: z.string(),
  total: z.string(),
});

export type InvoiceTableItem = z.infer<typeof invoiceTableItemSchema>;
