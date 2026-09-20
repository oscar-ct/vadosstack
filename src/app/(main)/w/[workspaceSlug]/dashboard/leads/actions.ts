"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import { getPermittedDashboardAuthorization } from "@/lib/authorization";
import { recordAuthorizationAuditEvent } from "@/lib/authorization/audit";
import { plainTextToEmailHtml, sanitizeEmailHtml } from "@/lib/email-content";
import { logEmailRecord } from "@/lib/email-records";
import {
  decryptGoogleToken,
  GMAIL_REFRESH_ERROR_MESSAGE,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/google-mail";
import { isValidOptionalPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { formatServiceAddress, getServiceAddressPayload } from "@/lib/service-address";
import { getWorkspaceDashboardPath } from "@/lib/workspace-path";
import { revalidateWorkspacePath } from "@/lib/workspace-revalidation";

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
  serviceAddressLine1: z.string().trim().optional(),
  serviceAddressLine2: z.string().trim().optional(),
  serviceCity: z.string().trim().optional(),
  serviceState: z.string().trim().optional(),
  servicePostalCode: z.string().trim().optional(),
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
  html: z.string().trim().optional(),
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
  const serviceAddress = getServiceAddressPayload(formData);

  return {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    source: optionalText(formData.get("source")),
    serviceType: optionalText(formData.get("serviceType")),
    ...serviceAddress,
    status: formData.get("status"),
    priority: formData.get("priority"),
    followUpAt: optionalText(formData.get("followUpAt")),
    notes: optionalText(formData.get("notes")),
    lostReason: optionalText(formData.get("lostReason")),
  };
}

function revalidateLeadPaths(workspaceSlug: string, leadId?: string) {
  revalidateWorkspacePath(workspaceSlug, "/dashboard/leads");
  revalidateWorkspacePath(workspaceSlug, "/dashboard/overview");
  revalidateWorkspacePath(workspaceSlug, "/dashboard/command-center");
  if (leadId) {
    revalidateWorkspacePath(workspaceSlug, `/dashboard/leads/${leadId}`);
  }
}

export async function createLeadAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const authorization = await getPermittedDashboardAuthorization("leads.create");

  if (!authorization) {
    return { success: false, message: "You do not have permission to create leads." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = leadDetailsSchema.safeParse(getLeadPayload(formData));

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the lead details and try again." };
  }

  try {
    const lead = await prisma.$transaction(async (transaction) => {
      const createdLead = await transaction.lead.create({
        data: {
          ...parsed.data,
          ownerId: workspaceId,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
          source: parsed.data.source || null,
          serviceType: parsed.data.serviceType || null,
          serviceLocation: parsed.data.serviceLocation || null,
          serviceAddressLine1: parsed.data.serviceAddressLine1 || null,
          serviceAddressLine2: parsed.data.serviceAddressLine2 || null,
          serviceCity: parsed.data.serviceCity || null,
          serviceState: parsed.data.serviceState || null,
          servicePostalCode: parsed.data.servicePostalCode || null,
          followUpAt: parsed.data.followUpAt ?? null,
          notes: parsed.data.notes || null,
          lostReason: parsed.data.status === "Lost" ? parsed.data.lostReason || null : null,
        },
        select: { id: true },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "lead.create",
          targetType: "Lead",
          targetId: createdLead.id,
        },
        transaction,
      );
      return createdLead;
    });

    revalidateLeadPaths(authorization.membership.workspaceSlug, lead.id);

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
  const authorization = await getPermittedDashboardAuthorization("leads.update");

  if (!authorization) {
    return { success: false, message: "You do not have permission to update leads." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = updateLeadSchema.safeParse({
    id: formData.get("id"),
    ...getLeadPayload(formData),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check the lead details and try again." };
  }

  const { id, ...lead } = parsed.data;

  try {
    const existingLead = await prisma.lead.findUnique({
      where: {
        id_ownerId: {
          id,
          ownerId: workspaceId,
        },
      },
      select: {
        convertedAt: true,
      },
    });

    if (!existingLead) {
      return { success: false, message: "Lead not found." };
    }

    const status = lead.status;

    await prisma.$transaction(async (transaction) => {
      await transaction.lead.update({
        where: {
          id_ownerId: {
            id,
            ownerId: workspaceId,
          },
        },
        data: {
          ...lead,
          status,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          source: lead.source || null,
          serviceType: lead.serviceType || null,
          serviceLocation: lead.serviceLocation || null,
          serviceAddressLine1: lead.serviceAddressLine1 || null,
          serviceAddressLine2: lead.serviceAddressLine2 || null,
          serviceCity: lead.serviceCity || null,
          serviceState: lead.serviceState || null,
          servicePostalCode: lead.servicePostalCode || null,
          followUpAt: lead.followUpAt ?? null,
          notes: lead.notes || null,
          lostReason: status === "Lost" ? lead.lostReason || null : null,
          convertedAt: status === "Won" ? (existingLead.convertedAt ?? new Date()) : null,
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "lead.update",
          targetType: "Lead",
          targetId: id,
        },
        transaction,
      );
    });
  } catch {
    return { success: false, message: "Lead could not be updated. Please try again." };
  }

  revalidateLeadPaths(authorization.membership.workspaceSlug, id);

  return { success: true, message: "Lead updated." };
}

export async function updateLeadStatusAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const authorization = await getPermittedDashboardAuthorization("leads.update");

  if (!authorization) {
    return { success: false, message: "You do not have permission to update leads." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = leadStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    lostReason: optionalText(formData.get("lostReason")),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Choose a status and try again." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.lead.update({
        where: {
          id_ownerId: {
            id: parsed.data.id,
            ownerId: workspaceId,
          },
        },
        data: {
          status: parsed.data.status,
          lostReason: parsed.data.status === "Lost" ? parsed.data.lostReason || null : null,
          convertedAt: parsed.data.status === "Won" ? new Date() : null,
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "lead.status.update",
          targetType: "Lead",
          targetId: parsed.data.id,
          metadata: { status: parsed.data.status },
        },
        transaction,
      );
    });
  } catch {
    return { success: false, message: "Lead status could not be updated." };
  }

  revalidateLeadPaths(authorization.membership.workspaceSlug, parsed.data.id);

  return { success: true, message: `Lead marked ${parsed.data.status}.` };
}

export async function convertLeadToCustomerAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const authorization = await getPermittedDashboardAuthorization("leads.update");
  const customerAuthorization = await getPermittedDashboardAuthorization("customers.create");

  if (!authorization || !customerAuthorization) {
    return { success: false, message: "You do not have permission to convert leads into customers." };
  }
  const workspaceId = authorization.workspaceId;

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
          ownerId: workspaceId,
        },
      },
      select: {
        id: true,
        customerId: true,
        email: true,
        name: true,
        phone: true,
        serviceAddressLine1: true,
        serviceAddressLine2: true,
        serviceCity: true,
        serviceLocation: true,
        servicePostalCode: true,
        serviceState: true,
      },
    });

    if (!lead) {
      return { success: false, message: "Lead not found." };
    }

    if (lead.customerId) {
      return {
        success: true,
        message: "Lead is already linked to a customer.",
      };
    }

    const existingCustomer = lead.email
      ? await prisma.customer.findFirst({
          where: {
            ownerId: workspaceId,
            email: lead.email,
          },
          select: {
            id: true,
          },
        })
      : null;

    const serviceLocation = formatServiceAddress(lead);

    await prisma.$transaction(async (transaction) => {
      const customer =
        existingCustomer ??
        (await transaction.customer.create({
          data: {
            ownerId: workspaceId,
            name: lead.name,
            email: lead.email,
            billingStatus: "No Balance",
            addresses: serviceLocation
              ? {
                  create: {
                    label: "Service Location",
                    line1: lead.serviceAddressLine1 || serviceLocation,
                    line2: lead.serviceAddressLine2 || null,
                    city: lead.serviceCity || null,
                    state: lead.serviceState || null,
                    postalCode: lead.servicePostalCode || null,
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
          select: { id: true },
        }));

      await transaction.lead.update({
        where: {
          id_ownerId: {
            id: lead.id,
            ownerId: workspaceId,
          },
        },
        data: {
          customerId: customer.id,
          convertedAt: new Date(),
        },
      });
      await recordAuthorizationAuditEvent(
        {
          workspaceId,
          actorUserId: authorization.principal.user.id,
          membershipId: authorization.membership.id,
          action: "lead.convert_to_customer",
          targetType: "Lead",
          targetId: lead.id,
          metadata: { customerId: customer.id, existingCustomer: Boolean(existingCustomer) },
        },
        transaction,
      );
    });

    revalidateLeadPaths(authorization.membership.workspaceSlug, lead.id);
    revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/customers");

    return {
      success: true,
      message: existingCustomer ? "Lead linked to existing customer." : "Lead converted to customer.",
    };
  } catch {
    return { success: false, message: "Lead could not be converted. Please try again." };
  }
}

export async function deleteLeadAction(
  _previousState: LeadMutationState,
  formData: FormData,
): Promise<LeadMutationState> {
  const authorization = await getPermittedDashboardAuthorization("leads.delete");

  if (!authorization) {
    return { success: false, message: "You do not have permission to delete leads." };
  }
  const workspaceId = authorization.workspaceId;

  const parsed = leadIdSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Lead is required." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.lead.delete({
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
          action: "lead.delete",
          targetType: "Lead",
          targetId: parsed.data.id,
        },
        transaction,
      );
    });
  } catch {
    return { success: false, message: "Lead could not be deleted." };
  }

  revalidateLeadPaths(authorization.membership.workspaceSlug);

  redirect(getWorkspaceDashboardPath(authorization.membership.workspaceSlug, "/dashboard/leads"));
}

export async function sendLeadEmailAction(_previousState: EmailLeadState, formData: FormData): Promise<EmailLeadState> {
  const authorization = await getPermittedDashboardAuthorization("email.send");
  const leadAuthorization = await getPermittedDashboardAuthorization("leads.view");

  if (!authorization || !leadAuthorization) {
    return createEmailLeadState(false, "You do not have permission to email leads.");
  }
  const workspaceId = authorization.workspaceId;

  const parsed = emailLeadSchema.safeParse({
    leadId: formData.get("leadId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    html: formData.get("html"),
  });

  if (!parsed.success) {
    return createEmailLeadState(false, parsed.error.issues[0]?.message ?? "Check the email details and try again.");
  }

  const [lead, googleMailAccount] = await Promise.all([
    prisma.lead.findUnique({
      where: {
        id_ownerId: {
          id: parsed.data.leadId,
          ownerId: workspaceId,
        },
      },
    }),
    prisma.googleMailAccount.findUnique({
      where: {
        workspaceId,
      },
    }),
  ]);

  if (!lead) {
    return createEmailLeadState(false, "Lead could not be found.");
  }

  const emailRecordBase = {
    ownerId: workspaceId,
    documentType: "lead" as const,
    documentId: lead.id,
    documentNumber: "Lead",
    recipientName: lead.name,
    recipientEmail: lead.email,
    senderEmail: googleMailAccount?.email,
    sentByUserId: authorization.principal.user.id,
    sentByName: authorization.principal.user.name,
    sentByEmail: authorization.principal.user.email,
    subject: parsed.data.subject,
    bodyText: parsed.data.message,
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
    const html = sanitizeEmailHtml(parsed.data.html) ?? plainTextToEmailHtml(parsed.data.message);

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead email could not be sent. Please try again.";
    const reconnectRequired = message === GMAIL_REFRESH_ERROR_MESSAGE;
    const responseMessage = reconnectRequired ? `${message} Please reconnect to continue.` : message;

    if (reconnectRequired) {
      await prisma.googleMailAccount.deleteMany({
        where: {
          workspaceId,
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

  await recordAuthorizationAuditEvent({
    workspaceId,
    actorUserId: authorization.principal.user.id,
    membershipId: authorization.membership.id,
    action: "email.send",
    targetType: "Lead",
    targetId: lead.id,
    metadata: { documentType: "lead" },
  }).catch((error) => console.error("Lead email authorization audit could not be saved.", error));

  revalidateLeadPaths(authorization.membership.workspaceSlug, lead.id);
  revalidateWorkspacePath(authorization.membership.workspaceSlug, "/dashboard/email-history");

  return createEmailLeadState(true, `Email sent to ${lead.email}.`);
}
