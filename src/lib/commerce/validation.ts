import { z } from "zod";

export const amountSchema = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use at most two decimal places.");
export const quantitySchema = z.number().int().min(1).max(1_000_000);
export const taxRateSchema = amountSchema.pipe(z.number().max(100));
export const submissionKeySchema = z.string().trim().min(8).max(100);
const text = z.string().trim().max(5000).nullish();

export const paymentStatuses = ["Paid", "Pending", "Partially Paid", "Refunded", "Partially Refunded"] as const;
export const fulfillmentStatuses = ["Fulfilled", "Unfulfilled", "Partially Fulfilled"] as const;

export const orderInputSchema = z
  .object({
    submissionKey: submissionKeySchema.optional(),
    expectedVersion: z.number().int().positive().optional(),
    externalPaymentConfirmed: z.boolean().optional(),
    customerId: text,
    customerEmail: z.union([z.email(), z.literal("")]).nullish(),
    customerName: z.string().trim().min(1).max(200),
    customerNotes: text,
    customerPhone: text,
    discountAmount: amountSchema.default(0),
    shippingAmount: amountSchema.default(0),
    taxRate: taxRateSchema.default(0),
    estimatedDelivery: z.date().nullish(),
    orderDate: z.date(),
    orderNumber: z.string().max(100),
    footerMessage: z.string().max(180).nullish(),
    fulfillmentStatus: z.enum(fulfillmentStatuses),
    paymentStatus: z.enum(paymentStatuses),
    paymentMethod: text,
    paymentReference: text,
    shippingCity: text,
    shippingLine1: text,
    shippingLine2: text,
    shippingPostalCode: text,
    shippingService: text,
    shippingState: text,
    trackingNumber: text,
    items: z
      .array(
        z
          .object({
            id: z.string().max(100).optional(),
            category: text,
            description: text,
            unit: text,
            inventoryItemId: text,
            product: z.string().trim().min(1).max(500),
            quantity: quantitySchema,
            sku: text,
            taxRate: taxRateSchema.optional(),
            taxable: z.boolean().optional(),
            unitPrice: amountSchema,
          })
          .strict(),
      )
      .min(1)
      .max(250),
  })
  .strict()
  .superRefine((input, ctx) => {
    const inventoryIds = input.items.map((item) => item.inventoryItemId).filter(Boolean);
    const lineIds = input.items.map((item) => item.id).filter(Boolean);
    if (new Set(inventoryIds).size !== inventoryIds.length || new Set(lineIds).size !== lineIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Each product and line may appear only once. Increase its quantity instead.",
      });
    }
  });

export type OrderInput = z.infer<typeof orderInputSchema>;

export class CommerceInputError extends Error {}

export function parseCommerceInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new CommerceInputError(parsed.error.issues[0]?.message ?? "Invalid input.");
  return parsed.data;
}
