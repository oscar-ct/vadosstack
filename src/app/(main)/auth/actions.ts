"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import {
  createAccountConfirmationToken,
  createAccountConfirmationUrl,
  hashAccountConfirmationToken,
} from "@/lib/account-confirmation";
import {
  clearCurrentSession,
  createUserSession,
  getCurrentUser,
  getDisplayName,
  refreshCurrentSession,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createPasswordResetToken, createPasswordResetUrl, hashPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { AUTH_RATE_LIMIT_MESSAGE, consumeRateLimit, getRateLimitIp } from "@/lib/rate-limit";
import { resend } from "@/lib/resend";

const PASSWORD_RESET_SUCCESS_MESSAGE =
  "If a password account exists for that email, we sent a reset link with instructions.";
const ACCOUNT_CONFIRMATION_SUCCESS_MESSAGE =
  "Check your email to confirm your account. The link will expire in 30 minutes.";
const PASSWORD_RESET_EXPIRES_IN_MS = 10 * 60 * 1000;
const ACCOUNT_CONFIRMATION_EXPIRES_IN_MS = 30 * 60 * 1000;

export type AuthFormState = {
  success: boolean;
  message: string;
};

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  remember: z.coerce.boolean().optional(),
});

const registerSchema = z
  .object({
    name: z.string().trim().max(120, "Name is too long.").optional(),
    companyName: z.string().trim().min(1, "Company name is required.").max(120, "Company name is too long."),
    companyAddress: z.string().trim().max(300, "Company address is too long.").optional(),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

const requestPasswordResetSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is missing or invalid."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function loginAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Enter your email and password to continue.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getRateLimitIp();
  const allowed = await consumeRateLimit("login", [ip, email]);

  if (!allowed) {
    return {
      success: false,
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return {
      success: false,
      message: "Email or password is incorrect.",
    };
  }

  await createUserSession(user.id, parsed.data.remember);
  redirect("/dashboard/overview");
}

export async function registerAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    companyName: formData.get("companyName"),
    companyAddress: formData.get("companyAddress"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your details and try again.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getRateLimitIp();
  const allowed = await consumeRateLimit("register", [ip, email]);

  if (!allowed) {
    return {
      success: false,
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser) {
    return {
      success: false,
      message: "An account with that email already exists.",
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const templateId = process.env.RESEND_CONFIRM_ACCOUNT_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    console.error("Account confirmation email is not configured.");
    return {
      success: false,
      message: "Account confirmation email is not configured. Please try again later.",
    };
  }

  const token = createAccountConfirmationToken();
  const tokenHash = hashAccountConfirmationToken(token);
  const confirmUrl = createAccountConfirmationUrl(token);
  const expiresAt = new Date(Date.now() + ACCOUNT_CONFIRMATION_EXPIRES_IN_MS);
  const name = parsed.data.name?.trim() || getDisplayName({ email });

  await prisma.pendingAccountConfirmation.upsert({
    where: {
      email,
    },
    create: {
      companyName: parsed.data.companyName,
      companyAddress: parsed.data.companyAddress || null,
      email,
      expiresAt,
      name,
      passwordHash: hashPassword(parsed.data.password),
      tokenHash,
    },
    update: {
      companyName: parsed.data.companyName,
      companyAddress: parsed.data.companyAddress || null,
      expiresAt,
      name,
      passwordHash: hashPassword(parsed.data.password),
      tokenHash,
    },
  });

  const result = await resend.emails.send({
    from: "VadosStack <support@vadosstack.com>",
    tags: [
      {
        name: "category",
        value: "account-confirmation",
      },
    ],
    template: {
      id: templateId,
      variables: {
        CONFIRM_URL: confirmUrl,
      },
    },
    to: email,
  });

  if (result.error) {
    console.error("Account confirmation email failed:", result.error.message);
    await prisma.pendingAccountConfirmation.deleteMany({
      where: {
        tokenHash,
      },
    });

    return {
      success: false,
      message: "We could not send the confirmation email. Please try again.",
    };
  }

  return {
    success: true,
    message: ACCOUNT_CONFIRMATION_SUCCESS_MESSAGE,
  };
}

export async function requestPasswordResetAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getRateLimitIp();
  const allowed = await consumeRateLimit("password-reset", [ip, email]);

  if (!allowed) {
    return {
      success: false,
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      authProviders: true,
      id: true,
    },
  });

  if (!user?.authProviders.includes("email")) {
    return {
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const templateId = process.env.RESEND_RESET_PASSWORD_TEMPLATE_ID;

  if (!apiKey || !templateId) {
    console.error("Password reset email is not configured.");
    return {
      success: true,
      message: PASSWORD_RESET_SUCCESS_MESSAGE,
    };
  }

  const token = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(token);
  const resetUrl = createPasswordResetUrl(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_IN_MS);

  await prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      expiresAt,
      tokenHash,
      userId: user.id,
    },
  });

  const result = await resend.emails.send({
    from: "VadosStack <support@vadosstack.com>",
    tags: [
      {
        name: "category",
        value: "password-reset",
      },
    ],
    template: {
      id: templateId,
      variables: {
        RESET_URL: resetUrl,
      },
    },
    to: email,
  });

  if (result.error) {
    console.error("Password reset email failed:", result.error.message);
    await prisma.passwordResetToken.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  return {
    success: true,
    message: PASSWORD_RESET_SUCCESS_MESSAGE,
  };
}

export async function resetPasswordAction(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your new password and try again.",
    };
  }

  const ip = await getRateLimitIp();
  const allowed = await consumeRateLimit("reset-password", [ip]);

  if (!allowed) {
    return {
      success: false,
      message: AUTH_RATE_LIMIT_MESSAGE,
    };
  }

  const tokenHash = hashPasswordResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        select: {
          authProviders: true,
          id: true,
        },
      },
    },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= new Date() ||
    !resetToken.user.authProviders.includes("email")
  ) {
    return {
      success: false,
      message: "This reset link is invalid or has expired. Please request a new one.",
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash: hashPassword(parsed.data.password),
      },
    }),
    prisma.passwordResetToken.update({
      where: {
        id: resetToken.id,
      },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        id: {
          not: resetToken.id,
        },
      },
    }),
    prisma.session.deleteMany({
      where: {
        userId: resetToken.userId,
      },
    }),
  ]);

  redirect("/login?reset=success");
}

export async function logoutAction() {
  await clearCurrentSession();
  redirect("/login");
}

export async function getSignedInUser() {
  return getCurrentUser();
}

export async function refreshSessionAction() {
  return refreshCurrentSession();
}
