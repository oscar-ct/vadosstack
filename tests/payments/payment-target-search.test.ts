import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  prisma: {
    invoice: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    job: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    workspace: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getPermittedDashboardAuthorization: mocks.authorize,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import {
  getPaymentTargetDetailsAction,
  searchPaymentTargetsAction,
} from "@/app/(main)/w/[workspaceSlug]/dashboard/payments/actions";

describe("payment wizard target queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ workspaceId: "workspace-1" });
    mocks.prisma.workspace.findUnique.mockResolvedValue({ invoiceDueDays: 15 });
  });

  it("searches and paginates invoices on the server without loading payment history", async () => {
    mocks.prisma.invoice.count.mockResolvedValue(45);
    mocks.prisma.invoice.findMany.mockResolvedValue([
      {
        amountPaid: "25.00",
        balanceDue: "75.00",
        customerName: "Taylor Reed",
        finalCost: "100.00",
        id: "invoice-1",
        invoiceNumber: "INV0100",
        issuedAt: new Date("2026-10-01T12:00:00.000Z"),
        jobId: "job-1",
        jobTitle: "Kitchen repair",
      },
    ]);

    const result = await searchPaymentTargetsAction({ kind: "invoice_payment", page: 2, query: "Taylor" });

    expect(result).toMatchObject({ page: 2, success: true, total: 45, totalPages: 3 });
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]).toMatchObject({ paymentCount: 0, payments: [] });
    expect(mocks.prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        select: expect.not.objectContaining({ job: expect.anything() }),
      }),
    );
  });

  it("loads recent payment history only after an invoice is selected", async () => {
    mocks.prisma.invoice.findFirst.mockResolvedValue({
      amountPaid: "25.00",
      balanceDue: "75.00",
      customerName: "Taylor Reed",
      finalCost: "100.00",
      id: "invoice-1",
      invoiceNumber: "INV0100",
      issuedAt: new Date("2026-10-01T12:00:00.000Z"),
      jobId: "job-1",
      jobTitle: "Kitchen repair",
      job: {
        _count: { payments: 1 },
        payments: [
          {
            amount: "25.00",
            id: "payment-1",
            method: "Check",
            paidOn: new Date("2026-10-10T12:00:00.000Z"),
            paymentType: "invoice_payment",
            referenceNumber: "1042",
            status: "succeeded",
          },
        ],
      },
    });

    const result = await getPaymentTargetDetailsAction({ id: "invoice-1", kind: "invoice_payment" });

    expect(result.success).toBe(true);
    expect(result.invoice).toMatchObject({ paymentCount: 1 });
    expect(result.invoice?.payments).toEqual([
      expect.objectContaining({ amount: "25.00", id: "payment-1", referenceNumber: "1042" }),
    ]);
    expect(mocks.prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "invoice-1", ownerId: "workspace-1" }),
      }),
    );
  });

  it("searches eligible jobs across the workspace in pages of twenty", async () => {
    mocks.prisma.job.count.mockResolvedValue(21);
    mocks.prisma.job.findMany.mockResolvedValue([
      {
        amountPaid: "0",
        customer: { name: "Morgan Lee" },
        depositPaid: "0",
        description: "Bathroom remodel",
        estimatedCost: "4200.00",
        finalCost: null,
        id: "job-21",
        invoice: null,
        serviceAddressLine1: "1 Main St",
        serviceAddressLine2: null,
        serviceCity: "Austin",
        serviceLocation: null,
        servicePostalCode: "78701",
        serviceState: "TX",
        status: "Scheduled",
      },
    ]);

    const result = await searchPaymentTargetsAction({ kind: "deposit", page: 2, query: "Morgan" });

    expect(result).toMatchObject({ page: 2, success: true, total: 21, totalPages: 2 });
    expect(result.jobs).toEqual([
      expect.objectContaining({ customerName: "Morgan Lee", id: "job-21", paymentCount: 0, payments: [] }),
    ]);
    expect(mocks.prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        select: expect.not.objectContaining({ payments: expect.anything() }),
      }),
    );
  });
});
