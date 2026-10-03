import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoicePaymentLink: { findUnique: mocks.findUnique },
  },
}));

import { getInvoicePaymentLinkUnavailableReason } from "@/lib/payments/payment-links";

const accessedAt = new Date("2026-10-02T12:00:00.000Z");
const createdAt = new Date("2026-10-01T12:00:00.000Z");

function unavailableLink(overrides: Record<string, unknown> = {}) {
  return {
    createdAt,
    expiresAt: null,
    revokedAt: new Date("2026-10-02T10:00:00.000Z"),
    invoice: {
      owner: { status: "Active" },
      paymentLinks: [],
    },
    ...overrides,
  };
}

describe("payment link unavailable reasons", () => {
  beforeEach(() => {
    mocks.findUnique.mockResolvedValue(null);
  });

  it("identifies a link replaced by a newer active link", async () => {
    mocks.findUnique.mockResolvedValue(
      unavailableLink({
        invoice: {
          owner: { status: "Active" },
          paymentLinks: [{ createdAt: new Date("2026-10-02T10:00:00.000Z") }],
        },
      }),
    );

    await expect(getInvoicePaymentLinkUnavailableReason("valid-token", accessedAt)).resolves.toBe("replaced");
  });

  it("identifies a manually disabled link", async () => {
    mocks.findUnique.mockResolvedValue(unavailableLink());

    await expect(getInvoicePaymentLinkUnavailableReason("valid-token", accessedAt)).resolves.toBe("disabled");
  });

  it("identifies an expired link", async () => {
    mocks.findUnique.mockResolvedValue(
      unavailableLink({ expiresAt: new Date("2026-10-02T11:00:00.000Z"), revokedAt: null }),
    );

    await expect(getInvoicePaymentLinkUnavailableReason("valid-token", accessedAt)).resolves.toBe("expired");
  });

  it("does not reveal whether an unknown token exists", async () => {
    await expect(getInvoicePaymentLinkUnavailableReason("unknown-token", accessedAt)).resolves.toBeNull();
  });
});
