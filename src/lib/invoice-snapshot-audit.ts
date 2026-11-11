import type { Invoice } from "@prisma/client";

// Keep document revisions in the existing audit ledger, in the same transaction
// as the invoice write. Decimal/date values must remain JSON-safe and exact.
export function invoiceSnapshotAudit(invoice: Invoice) {
  return {
    invoiceNumber: invoice.invoiceNumber ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    customerId: invoice.customerId ?? null,
    customerName: invoice.customerName ?? null,
    customerEmail: invoice.customerEmail ?? null,
    customerPhone: invoice.customerPhone ?? null,
    jobTitle: invoice.jobTitle ?? null,
    jobDescription: invoice.jobDescription ?? null,
    serviceLocation: invoice.serviceLocation ?? null,
    serviceAddressLine1: invoice.serviceAddressLine1 ?? null,
    serviceAddressLine2: invoice.serviceAddressLine2 ?? null,
    serviceCity: invoice.serviceCity ?? null,
    serviceState: invoice.serviceState ?? null,
    servicePostalCode: invoice.servicePostalCode ?? null,
    dateBegin: invoice.dateBegin?.toISOString() ?? null,
    dateEnd: invoice.dateEnd?.toISOString() ?? null,
    lines: invoice.materials ?? null,
    laborCost: invoice.laborCost?.toString() ?? null,
    materialsSubtotal: invoice.materialsSubtotal?.toString() ?? null,
    taxRate: invoice.materialTaxRate?.toString() ?? null,
    taxAmount: invoice.materialTaxAmount?.toString() ?? null,
    otherFeesEnabled: invoice.otherFeesEnabled ?? false,
    otherFeesRate: invoice.otherFeesRate?.toString() ?? null,
    otherFeesAmount: invoice.otherFeesAmount?.toString() ?? null,
    total: invoice.finalCost?.toString() ?? null,
  };
}
