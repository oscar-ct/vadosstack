import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { hashAccountConfirmationToken } from "@/lib/account-confirmation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import vadosstackLogoSmall from "../../../../../media/vadosstack-logo-transparent-small.png";

type ConfirmAccountPageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

type ConfirmationState = {
  description: string;
  title: string;
};

async function confirmAccount(token: string): Promise<ConfirmationState> {
  const tokenHash = hashAccountConfirmationToken(token);
  const pendingAccount = await prisma.pendingAccountConfirmation.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!pendingAccount) {
    return {
      description: "This confirmation link is invalid. Please register again to receive a new confirmation email.",
      title: "Invalid confirmation link",
    };
  }

  if (pendingAccount.expiresAt <= new Date()) {
    await prisma.pendingAccountConfirmation.deleteMany({
      where: {
        id: pendingAccount.id,
      },
    });

    return {
      description: "This confirmation link has expired. Please register again to receive a new confirmation email.",
      title: "Confirmation link expired",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        email: pendingAccount.email,
      },
      select: {
        id: true,
      },
    });

    await tx.pendingAccountConfirmation.deleteMany({
      where: {
        id: pendingAccount.id,
      },
    });

    if (existingUser) {
      return "exists";
    }

    await tx.user.create({
      data: {
        authProviders: ["email"],
        companyEmail: pendingAccount.email,
        companyName: pendingAccount.companyName,
        email: pendingAccount.email,
        name: pendingAccount.name,
        passwordHash: pendingAccount.passwordHash,
      },
    });

    return "success";
  });

  redirect(`/login?confirm=${result}`);
}

export default async function ConfirmAccountPage({ searchParams }: ConfirmAccountPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard/overview");
  }

  const params = await searchParams;
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token;
  const confirmationState = token
    ? await confirmAccount(token)
    : {
        description: "This confirmation link is missing a token. Please register again to receive a new email.",
        title: "Invalid confirmation link",
      };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <Image src={vadosstackLogoSmall} alt="VadosStack" className="mx-auto h-16 w-auto" priority />
        <div className="space-y-3">
          <h1 className="font-semibold text-2xl tracking-tight">{confirmationState.title}</h1>
          <p className="text-muted-foreground">{confirmationState.description}</p>
        </div>
        <Button asChild className="w-full">
          <Link prefetch={false} href="/register">
            Register again
          </Link>
        </Button>
      </div>
    </div>
  );
}
