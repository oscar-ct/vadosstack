import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  customerFindUnique: vi.fn(),
  customerUpdate: vi.fn(),
  getAuthorization: vi.fn(),
  jobCreate: vi.fn(),
  jobFindMany: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/authorization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/authorization")>()),
  getPermittedDashboardAuthorization: mocks.getAuthorization,
}));
vi.mock("@/lib/authorization/audit", () => ({ recordAuthorizationAuditEvent: mocks.audit }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: mocks.customerFindUnique,
      update: mocks.customerUpdate,
    },
    job: {
      create: mocks.jobCreate,
      findMany: mocks.jobFindMany,
    },
  },
}));
vi.mock("@/lib/workspace-revalidation", () => ({ revalidateWorkspacePath: mocks.revalidate }));

import { createJobAction } from "@/app/(main)/w/[workspaceSlug]/dashboard/jobs/actions";

const initialState = { message: "", success: false };

function createJobForm(materialQuantity: string) {
  const formData = new FormData();
  formData.set("customerId", "customer-a");
  formData.set("description", "Converted estimate job");
  formData.set("category", "General");
  formData.set("status", "Unscheduled");
  formData.set(
    "materials",
    JSON.stringify([
      {
        description: "Customer provided",
        quantity: materialQuantity,
        unit: "",
        unitPrice: "0",
        price: "0",
      },
    ]),
  );
  return formData;
}

describe("job material quantity validation", () => {
  beforeEach(() => {
    mocks.getAuthorization.mockResolvedValue({
      membership: {
        id: "membership-a",
        permissions: new Set(["jobs.create"]),
        roleSystemKey: null,
        workspaceSlug: "business-a",
      },
      principal: { user: { id: "user-a" } },
      workspaceId: "workspace-a",
    });
    mocks.customerFindUnique.mockResolvedValue({ id: "customer-a" });
    mocks.jobCreate.mockResolvedValue({ customerId: "customer-a", id: "job-a" });
    mocks.jobFindMany.mockResolvedValue([]);
    mocks.customerUpdate.mockResolvedValue({ id: "customer-a" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("saves a customer-provided material with zero quantity and zero total", async () => {
    const result = await createJobAction(initialState, createJobForm("0"));

    expect(result).toMatchObject({ success: true });
    const createInput = mocks.jobCreate.mock.calls[0]?.[0];
    expect(JSON.parse(createInput.data.materials)).toEqual([
      {
        description: "Customer provided",
        purchaseDate: "",
        price: "0.00",
        quantity: "0",
        type: "purchase",
        unit: "",
        unitPrice: "0.00",
        vendor: "",
      },
    ]);
  });

  it("still rejects a negative material quantity", async () => {
    const result = await createJobAction(initialState, createJobForm("-1"));

    expect(result).toEqual({ success: false, message: "Enter a valid material quantity." });
    expect(mocks.jobCreate).not.toHaveBeenCalled();
  });
});
