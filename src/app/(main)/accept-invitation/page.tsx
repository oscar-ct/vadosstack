import Link from "next/link";

import { KeyRound } from "lucide-react";

import { InvitationForm } from "@/app/(main)/accept-invitation/_components/invitation-form";
import {
  acceptInvitationAction,
  registerFromInvitationAction,
  switchInvitationAccountAction,
} from "@/app/(main)/accept-invitation/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashWorkspaceInvitationToken } from "@/lib/workspace-invitations";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const [currentUser, invitation] = await Promise.all([
    getCurrentUser(),
    token
      ? prisma.workspaceInvitation.findFirst({
          where: {
            tokenHash: hashWorkspaceInvitationToken(token),
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
            workspace: { status: "Active" },
          },
          select: { email: true, role: { select: { name: true } }, workspace: { select: { name: true } } },
        })
      : null,
  ]);
  const existingAccount = invitation
    ? await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } })
    : null;
  const loginHref = `/login?returnTo=${encodeURIComponent(`/accept-invitation?token=${token}`)}`;

  return (
    <main className="grid min-h-svh place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>{invitation ? `Join ${invitation.workspace.name}` : "Invitation unavailable"}</CardTitle>
          <CardDescription>
            {invitation
              ? `${invitation.email} was invited with the ${invitation.role.name} role. This does not create a separate business workplace.`
              : "This invitation link is invalid, expired, revoked, or has already been used."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {invitation ? (
            currentUser && currentUser.email.toLowerCase() !== invitation.email.toLowerCase() ? (
              <div className="grid gap-3 text-sm">
                <p>
                  You are signed in as {currentUser.email}. Sign out and use {invitation.email} to accept this
                  invitation.
                </p>
                <form action={switchInvitationAccountAction}>
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit" variant="outline" className="w-full">
                    Sign out and use invited account
                  </Button>
                </form>
              </div>
            ) : currentUser ? (
              <InvitationForm action={acceptInvitationAction} signedIn token={token} />
            ) : existingAccount ? (
              <div className="grid gap-3 text-sm">
                <p>An account already exists for this email. Sign in to accept the invitation.</p>
                <Button asChild>
                  <Link href={loginHref}>Sign in and continue</Link>
                </Button>
              </div>
            ) : (
              <InvitationForm action={registerFromInvitationAction} signedIn={false} token={token} />
            )
          ) : (
            <Button asChild>
              <Link href="/login">Go to sign in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
