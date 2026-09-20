"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { scopeWorkspacePath } from "@/lib/workspace-path";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

export type CreateCustomerState = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

export type CustomerMutationState = CreateCustomerState;

const customerDetailsSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.preprocess((value) => {
    const email = String(value ?? "").trim();
    return email || undefined;
  }, z.string().email("Enter a valid email address.").optional()),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => isValidOptionalPhoneNumber(value), "Enter a valid 10-digit phone number.")
    .transform((value) => {
      const digits = normalizePhoneNumber(value);
      return digits || undefined;
    }),
  notes: z.string().trim().optional(),
  addresses: z
    .array(
      z.object({
        line1: z.string().trim(),
        line2: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        postalCode: z.string().trim().optional(),
      }),
    )
    .max(5)
    .optional(),
});

const createCustomerSchema = customerDetailsSchema.extend({
  email: z.preprocess((value) => {
    const email = String(value ?? "").trim();
    return email;
  }, z.string().min(1, "Email is required.").email("Enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required.")
    .refine((value) => isValidOptionalPhoneNumber(value), "Enter a valid 10-digit phone number.")
    .transform((value) => normalizePhoneNumber(value)),
});

async function findCustomerByEmail(ownerId: string, email?: string, excludeCustomerId?: string) {
  if (!email) {
    return null;
  }

  return prisma.customer.findFirst({
    where: {
      ownerId,
      email,
      id: excludeCustomerId
        ? {
            not: excludeCustomerId,
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });
}

function getAddressesPayload(formData: FormData) {
  const lines = formData.getAll("addressLine1");
  const line2Values = formData.getAll("addressLine2");
  const cities = formData.getAll("addressCity");
  const states = formData.getAll("addressState");
  const postalCodes = formData.getAll("addressPostalCode");

  return lines
    .map((line, index) => ({
      line1: String(line ?? "").trim(),
      line2: String(line2Values[index] ?? "").trim(),
      city: String(cities[index] ?? "").trim(),
      state: String(states[index] ?? "").trim(),
      postalCode: String(postalCodes[index] ?? "").trim(),
    }))
    .filter((address) => address.line1 || address.line2 || address.city || address.state || address.postalCode)
    .map((address) => ({
      ...address,
      line1:
        address.line1 ||
        [address.line2, [address.city, address.state].filter(Boolean).join(", "), address.postalCode]
          .filter(Boolean)
          .join(", "),
    }));
}

export async function createCustomerAction(
  _previousState: CreateCustomerState,
  formData: FormData,
): Promise<CreateCustomerState> {
  const authorization = await getPermittedDashboardAuthorization("customers.create");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to create customers.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = createCustomerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    addresses: getAddressesPayload(formData),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the customer details and try again.",
    };
  }

  const { name, email, phone, notes, addresses } = parsed.data;

  try {
    const existingCustomer = await findCustomerByEmail(workspaceId, email);

    if (existingCustomer) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      const customer = await transaction.customer.create({
        data: {
          ownerId: workspaceId,
          name,
          email: email ?? null,
          billingStatus: "No Balance",
          notes: notes || null,
          addresses: addresses?.length
            ? {
                create: addresses.map((address, index) => ({
                  label: index === 0 ? "Primary" : index === 1 ? "Secondary" : `Additional ${index + 1}`,
                  line1: address.line1,
                  line2: address.line2 || null,
                  city: address.city || null,
                  state: address.state || null,
                  postalCode: address.postalCode || null,
                })),
              }
            : undefined,
          phoneNumbers: phone
            ? {
                create: {
                  label: "Primary",
                  value: phone,
                },
              }
            : undefined,
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "customer.create",
          targetType: "Customer",
          targetId: customer.id,
        },
        transaction,
      );
    });
  } catch (error) {
    if (email && error instanceof Error && error.message.includes("Unique constraint failed")) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    return {
      success: false,
      message: "Customer could not be created. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");

  return {
    success: true,
    message: "Customer created.",
  };
}

const updateCustomerSchema = customerDetailsSchema.extend({
  id: z.string().trim().min(1, "Customer is required."),
});

export async function updateCustomerAction(
  _previousState: CustomerMutationState,
  formData: FormData,
): Promise<CustomerMutationState> {
  const authorization = await getPermittedDashboardAuthorization("customers.update");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to update customers.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateCustomerSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    addresses: getAddressesPayload(formData),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check the customer details and try again.",
    };
  }

  const { id, name, email, phone, notes, addresses } = parsed.data;

  try {
    const customer = await prisma.customer.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: workspaceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return {
        success: false,
        message: "Customer not found.",
      };
    }

    const existingCustomer = await findCustomerByEmail(workspaceId, email, customer.id);

    if (existingCustomer) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.customerAddress.deleteMany({
        where: {
          customerId: customer.id,
        },
      });
      await transaction.customerPhoneNumber.deleteMany({
        where: {
          customerId: customer.id,
        },
      });
      await transaction.customer.update({
        where: {
          id_ownerId: {
            id: customer.id,
            ownerId: workspaceId,
          },
        },
        data: {
          name,
          email: email ?? null,
          notes: notes || null,
          addresses: addresses?.length
            ? {
                create: addresses.map((address, index) => ({
                  label: index === 0 ? "Primary" : index === 1 ? "Secondary" : `Additional ${index + 1}`,
                  line1: address.line1,
                  line2: address.line2 || null,
                  city: address.city || null,
                  state: address.state || null,
                  postalCode: address.postalCode || null,
                })),
              }
            : undefined,
          phoneNumbers: phone
            ? {
                create: {
                  label: "Primary",
                  value: phone,
                },
              }
            : undefined,
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "customer.update",
          targetType: "Customer",
          targetId: customer.id,
        },
        transaction,
      );
    });
  } catch (error) {
    if (email && error instanceof Error && error.message.includes("Unique constraint failed")) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    return {
      success: false,
      message: "Customer could not be updated. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");
  revalidateWorkspacePath(authorization.membership.workspaceSlug, `/dashboard/customers/${id}`);

  return {
    success: true,
    message: "Customer updated.",
  };
}

const deleteCustomerSchema = z.object({
  id: z.string().trim().min(1, "Customer is required."),
  redirectTo: z.string().trim().optional(),
});

export async function deleteCustomerAction(
  _previousState: CustomerMutationState,
  formData: FormData,
): Promise<CustomerMutationState> {
  const authorization = await getPermittedDashboardAuthorization("customers.delete");

  if (!authorization) {
    return {
      success: false,
      message: "You do not have permission to delete customers.",
    };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = deleteCustomerSchema.safeParse({
    id: formData.get("id"),
    redirectTo: formData.get("redirectTo"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a customer and try again.",
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.customer.delete({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: workspaceId,
          },
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "customer.delete",
          targetType: "Customer",
          targetId: parsed.data.id,
        },
        transaction,
      );
    });
  } catch {
    return {
      success: false,
      message: "Customer could not be deleted. Please try again.",
    };
  }

  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");

  if (parsed.data.redirectTo?.startsWith("/dashboard/")) {
    redirect(scopeWorkspacePath(authorization.membership.workspaceSlug, parsed.data.redirectTo));
  }

  return {
    success: true,
    message: "Customer deleted.",
  };
}
