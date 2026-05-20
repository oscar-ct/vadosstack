"use server";

import { redirect } from "next/navigation";

import { z } from "zod";

import {
  clearCurrentSession,
  createUserSession,
  getCurrentUser,
  getDisplayName,
  refreshCurrentSession,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

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
    email: z.string().trim().email("Enter a valid email address."),
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

  const user = await prisma.user.findUnique({
    where: {
      email: parsed.data.email,
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

  const existingUser = await prisma.user.findUnique({
    where: {
      email: parsed.data.email,
    },
  });

  if (existingUser) {
    return {
      success: false,
      message: "An account with that email already exists.",
    };
  }

  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name?.trim() || getDisplayName(parsed.data),
      companyName: parsed.data.companyName,
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
    },
  });

  await createUserSession(createdUser.id, true);
  redirect("/dashboard/overview");
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
