"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { plainTextToEmailHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import { leadPriorities, leadStatuses } from "./constants";

export type LeadMutationState = {
  redirectTo?: string;
  success: boolean;
  message: string;
};

export type EmailLeadState = {
  success: boolean;
  message: string;
  reconnectRequired?: boolean;
  submittedAt?: number;
};

const optionalText = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
};

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(`${value}T12:00:00`) : undefined))
  .refine((value) => !value || !Number.isNaN(value.getTime()), "Enter a valid follow-up date.");

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid estimated value.")
  .transform((value) => (value ? Number(value).toFixed(2) : undefined));

const leadDetailsSchema = z.object({
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
  source: z.string().trim().optional(),
  serviceType: z.string().trim().optional(),
  serviceLocation: z.string().trim().optional(),
  estimatedValue: optionalMoney,
  status: z.enum(leadStatuses),
  priority: z.enum(leadPriorities),
  followUpAt: optionalDate,
  notes: z.string().trim().optional(),
  lostReason: z.string().trim().optional(),
});

const updateLeadSchema = leadDetailsSchema.extend({
  id: z.string().trim().min(1, "Lead is required."),
});

const leadIdSchema = z.object({
  id: z.string().trim().min(1, "Lead is required."),
});

const leadStatusSchema = leadIdSchema.extend({
  status: z.enum(leadStatuses),
  lostReason: z.string().trim().optional(),
});

const emailLeadSchema = z.object({
  leadId: z.string().trim().min(1, "Lead is required."),
  subject: z.string().trim().min(1, "Subject is required."),
  message: z.string().trim().min(1, "Message is required."),
});

function createEmailLeadState(success: boolean, message: string, reconnectRequired = false): EmailLeadState {
  return {
    success,
    message,
    reconnectRequired,
    submittedAt: Date.now(),
  };
}

function getLeadPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    source: optionalText(formData.get("source")),
    serviceType: optionalText(formData.get("serviceType")),
    serviceLocation: optionalText(formData.get("serviceLocation")),
    estimatedValue: optionalText(formData.get("estimatedValue")),
    status: formData.get("status"),
    priority: formData.get("priority"),
    followUpAt: optionalText(formData.get("followUpAt")),
    notes: optionalText(formData.get("notes")),
    lostReason: optionalText(formData.get("lostReason")),
  };
}

function revalidateLeadPaths(leadId?: string) {
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/command-center");
  if (leadId) {
    revalidatePath(`/dashboard/leads/${leadId}`);
  }
}

export async function createLeadAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to create a lead." };
  }

  const parsed = leadDetailsSchema.safeParse(getLeadPayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the lead details and try again." };
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        ...parsed.data,
        ownerId: currentUser.id,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        source: parsed.data.source || null,
        serviceType: parsed.data.serviceType || null,
        serviceLocation: parsed.data.serviceLocation || null,
        estimatedValue: parsed.data.estimatedValue ?? null,
        followUpAt: parsed.data.followUpAt ?? null,
        notes: parsed.data.notes || null,
        lostReason: parsed.data.status === "Lost" ? parsed.data.lostReason || null : null,
      },
      select: {
        id: true,
      },
    });

    revalidateLeadPaths(lead.id);

    return {
      success: true,
      message: "Lead created.",
      redirectTo: `/dashboard/leads/${lead.id}`,
    };
  } catch {
    return { success: false, message: "Lead could not be created. Please try again." };
  }
}

export async function updateLeadAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update a lead." };
  }

  const parsed = updateLeadSchema.safeParse({
    id: formData.get("id"),
    ...getLeadPayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the lead details and try again." };
  }

  const { id, ...lead } = parsed.data;

  try {
    await prisma.lead.update({
      where: {
        id_ownerId: {
          id,
          ownerId: currentUser.id,
        },
      },
      data: {
        ...lead,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        source: lead.source || null,
        serviceType: lead.serviceType || null,
        serviceLocation: lead.serviceLocation || null,
        estimatedValue: lead.estimatedValue ?? null,
        followUpAt: lead.followUpAt ?? null,
        notes: lead.notes || null,
        lostReason: lead.status === "Lost" ? lead.lostReason || null : null,
        convertedAt: lead.status === "Won" ? new Date() : undefined,
      },
    });
  } catch {
    return { success: false, message: "Lead could not be updated. Please try again." };
  }

  revalidateLeadPaths(id);

  return { success: true, message: "Lead updated." };
}

export async function updateLeadStatusAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to update a lead." };
  }

  const parsed = leadStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    lostReason: optionalText(formData.get("lostReason")),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Choose a status and try again." };
  }

  try {
    await prisma.lead.update({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
      data: {
        status: parsed.data.status,
        lostReason: parsed.data.status === "Lost" ? parsed.data.lostReason || null : null,
        convertedAt: parsed.data.status === "Won" ? new Date() : undefined,
      },
    });
  } catch {
    return { success: false, message: "Lead status could not be updated." };
  }

  revalidateLeadPaths(parsed.data.id);

  return { success: true, message: `Lead marked ${parsed.data.status}.` };
}

export async function convertLeadToCustomerAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to convert a lead." };
  }

  const parsed = leadIdSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Lead is required." };
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
      select: {
        id: true,
        customerId: true,
        email: true,
        name: true,
        phone: true,
        serviceLocation: true,
        status: true,
      },
    });

    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    if (lead.customerId) {
      return {
        success: true,
        message: "Lead is already linked to a customer.",
        redirectTo: `/dashboard/customers/${lead.customerId}`,
      };
    }

    const existingCustomer = lead.email
      ? await prisma.customer.findFirst({
          where: {
            ownerId: currentUser.id,
            email: lead.email,
          },
          select: {
            id: true,
          },
        })
      : null;

    const customer =
      existingCustomer ??
      (await prisma.customer.create({
        data: {
          ownerId: currentUser.id,
          name: lead.name,
          email: lead.email,
          billingStatus: "No Balance",
          addresses: lead.serviceLocation
            ? {
                create: {
                  label: "Service Location",
                  line1: lead.serviceLocation,
                },
              }
            : undefined,
          phoneNumbers: lead.phone
            ? {
                create: {
                  label: "Primary",
                  value: lead.phone,
                },
              }
            : undefined,
        },
        select: {
          id: true,
        },
      }));

    await prisma.lead.update({
      where: {
        id_ownerId: {
          id: lead.id,
          ownerId: currentUser.id,
        },
      },
      data: {
        customerId: customer.id,
        convertedAt: new Date(),
        status: lead.status === "New" || lead.status === "Contacted" ? "Estimate Needed" : lead.status,
      },
    });

    revalidateLeadPaths(lead.id);
    revalidatePath("/dashboard/customers");

    return {
      success: true,
      message: existingCustomer ? "Lead linked to existing customer." : "Lead converted to customer.",
      redirectTo: `/dashboard/customers/${customer.id}`,
    };
  } catch {
    return { success: false, message: "Lead could not be converted. Please try again." };
  }
}

export async function deleteLeadAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { success: false, message: "You must be signed in to delete a lead." };
  }

  const parsed = leadIdSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Lead is required." };
  }

  try {
    await prisma.lead.delete({
      where: {
        id_ownerId: {
          id: parsed.data.id,
          ownerId: currentUser.id,
        },
      },
    });
  } catch {
    return { success: false, message: "Lead could not be deleted." };
  }

  revalidateLeadPaths();

  return {
    success: true,
    message: "Lead deleted.",
    redirectTo: "/dashboard/leads",
  };
}

export async function sendLeadEmailAction(_previousState: EmailLeadState, formData: FormData): Promise<EmailLeadState> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return createEmailLeadState(false, "You must be signed in to email a lead.");
  }

  const parsed = emailLeadSchema.safeParse({
    leadId: formData.get("leadId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return createEmailLeadState(false, parsed.error.issues[0]?.message ?? "Check the email details and try again.");
  }

  const [lead, googleMailAccount] = await Promise.all([
    prisma.lead.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.leadId,
          ownerId: currentUser.id,
        },
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        userId: currentUser.id,
      },
    }),
  ]);

  if (!lead) {
    return createEmailLeadState(false, "Lead could not be found.");
  }

  const emailRecordBase = {
    ownerId: currentUser.id,
    documentType: "lead" as const,
    documentId: lead.id,
    documentNumber: "Lead",
    documentTotal: lead.estimatedValue,
    recipientName: lead.name,
    recipientEmail: lead.email,
    senderEmail: googleMailAccount?.email,
    subject: parsed.data.subject,
  };

  if (!lead.email) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Add an email address to this lead before sending an email.",
    });

    return createEmailLeadState(false, "Add an email address to this lead before sending an email.");
  }

  if (!googleMailAccount) {
    await logEmailRecord({
      ...emailRecordBase,
      status: "error",
      errorMessage: "Connect Gmail before emailing leads.",
    });

    return createEmailLeadState(false, "Connect Gmail before emailing leads.", true);
  }

  try {
    const refreshToken = decryptGoogleToken(googleMailAccount.refreshTokenCipher);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const html = plainTextToEmailHtml(parsed.data.message);

    await sendGmailMessage(accessToken, {
      from: googleMailAccount.email,
      html,
      subject: parsed.data.subject,
      text: parsed.data.message,
      to: lead.email,
    });

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "success",
    });

    if (lead.status === "New") {
      await prisma.lead.update({
        where: {
          id_ownerId: {
            id: lead.id,
            ownerId: currentUser.id,
          },
        },
        data: {
          status: "Contacted",
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired ? `${message} Please reconnect to continue.` : message;

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          userId: currentUser.id,
        },
      });
    }

    await logEmailRecord({
      ...emailRecordBase,
      senderEmail: googleMailAccount.email,
      status: "error",
      errorMessage: message,
    });

    return createEmailLeadState(false, responseMessage, reconnectRequired);
  }

  revalidateLeadPaths(lead.id);
  revalidatePath("/dashboard/email-history");

  return createEmailLeadState(true, `Email sent to ${lead.email}.`);
}
