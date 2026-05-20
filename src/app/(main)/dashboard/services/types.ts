import type { JobMaterial } from "../jobs/_components/materials";
import type { PricingLineItem } from "../jobs/_components/pricing-items";

export type ServiceTemplateRow = {
  id: string;
  title: string;
  description?: string;
  category: string;
  notes?: string;
  laborItems: PricingLineItem[];
  materialTaxRate: string;
  materials: JobMaterial[];
  createdAt: string;
  updatedAt: string;
};
