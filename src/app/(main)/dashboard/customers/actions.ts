"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

export type CreateCustomerState = {
  success: boolean;
  message: string;
};

export type CustomerMutationState = CreateCustomerState;

const createCustomerSchema = z.object({
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
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to create a customer.",
    };
  }

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
    const existingCustomer = await findCustomerByEmail(currentUser.id, email);

    if (existingCustomer) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    await prisma.customer.create({
      data: {
        ownerId: currentUser.id,
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

  revalidatePath("/dashboard/customers");

  return {
    success: true,
    message: "Customer created.",
  };
}

const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().trim().min(1, "Customer is required."),
});

export async function updateCustomerAction(
  _previousState: CustomerMutationState,
  formData: FormData,
): Promise<CustomerMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to update a customer.",
    };
  }

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
          ownerId: currentUser.id,
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

    const existingCustomer = await findCustomerByEmail(currentUser.id, email, customer.id);

    if (existingCustomer) {
      return {
        success: false,
        message: "A customer with that email already exists in your account.",
      };
    }

    await prisma.$transaction([
      prisma.customerAddress.deleteMany({
        where: {
          customerId: customer.id,
        },
      }),
      prisma.customerPhoneNumber.deleteMany({
        where: {
          customerId: customer.id,
        },
      }),
      prisma.customer.update({
        where: {
          id_ownerId: {
            id: customer.id,
            ownerId: currentUser.id,
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
      }),
    ]);
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

  revalidatePath("/dashboard/customers");

  return {
    success: true,
    message: "Customer updated.",
  };
}

const deleteCustomerSchema = z.object({
  id: z.string().trim().min(1, "Customer is required."),
});

export async function deleteCustomerAction(
  _previousState: CustomerMutationState,
  formData: FormData,
): Promise<CustomerMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return {
      success: false,
      message: "You must be signed in to delete a customer.",
    };
  }

  const parsed = deleteCustomerSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Select a customer and try again.",
    };
  }

  try {
    await prisma.customer.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
    });
  } catch {
    return {
      success: false,
      message: "Customer could not be deleted. Please try again.",
    };
  }

  revalidatePath("/dashboard/customers");

  return {
    success: true,
    message: "Customer deleted.",
  };
}
