import z from "zod";

export const estimateRecordRowSchema = z.object({
  id: z.string(),
  convertedJobId: z.string().optional(),
  printableEstimateId: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  leadId: z.string().optional(),
  leadName: z.string().optional(),
  description: z.string(),
  serviceLocation: z.string().optional(),
  dateBegin: z.string().optional(),
  dateEnd: z.string().optional(),
  laborCost: z.string().optional(),
  jobType: z.enum(["Residential", "Commercial"]).default("Residential"),
  measurementRooms: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string(),
      length: z.string(),
      width: z.string(),
      area: z.string().optional(),
    }),
  ),
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
      quantity: z.string(),
      unit: z.string().optional(),
      unitPrice: z.string(),
      price: z.string(),
    }),
  ),
  estimatedTotal: z.string().optional(),
  scope: z.string().optional(),
  category: z.string(),
  status: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export type EstimateRecordRow = z.infer<typeof estimateRecordRowSchema>;
