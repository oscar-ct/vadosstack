import { format, subDays } from "date-fns";
import { Building2, KeyRound, MailCheck, ShieldCheck, Users } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { formatPhoneNumber } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return format(value, "MMM d, yyyy");
}

function formatOptional(value?: string | null) {
  return value?.trim() || "Not set";
}

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view admin users"
        description="User administration is private to signed-in administrators."
      />
    );
  }

  if (!currentUser.admin) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Administrator access required</EmptyTitle>
          <EmptyDescription>This page is read-only and only available to administrator accounts.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const users = await prisma.user.findMany({
    select: {
      _count: {
        select: {
          customers: true,
          estimates: true,
          invoices: true,
          jobs: true,
        },
      },
      admin: true,
      authProviders: true,
      companyEmail: true,
      companyName: true,
      companyPhone: true,
      createdAt: true,
      email: true,
      estimateValidDays: true,
      googleMailAccount: {
        select: {
          email: true,
        },
      },
      id: true,
      invoiceDueDays: true,
      name: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const thirtyDaysAgo = subDays(new Date(), 30);
  const adminCount = users.filter((user) => user.admin).length;
  const gmailConnectedCount = users.filter((user) => user.googleMailAccount).length;
  const googleSignInCount = users.filter((user) => user.authProviders.includes("google")).length;
  const recentCount = users.filter((user) => user.createdAt >= thirtyDaysAgo).length;

  return (
    <div className="@container/main grid gap-4 md:gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShieldCheck className="size-4" />
            Administrator
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Users</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">
            Read-only account overview for users created in the app.
          </p>
        </div>
        <Badge variant="outline">{users.length.toLocaleString()} total users</Badge>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Total users
            </CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{users.length.toLocaleString()}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{adminCount.toLocaleString()}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-muted-foreground" />
              Gmail sending
            </CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{gmailConnectedCount.toLocaleString()}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              Google sign-in
            </CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{googleSignInCount.toLocaleString()}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              New in 30 days
            </CardTitle>
          </CardHeader>
          <CardContent className="font-semibold text-2xl">{recentCount.toLocaleString()}</CardContent>
        </Card>
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="grid gap-1">
            <h2 className="font-medium">Account directory</h2>
            <p className="text-muted-foreground text-sm">Basic account, company, and activity details.</p>
          </div>
        </div>
        <Separator />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Sign-in</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Document days</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatOptional(user.name)}</span>
                      {user.admin ? <Badge variant="secondary">Admin</Badge> : null}
                    </div>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium">{user.companyName}</span>
                    <span className="text-muted-foreground text-xs">{formatOptional(user.companyEmail)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.authProviders.includes("google") ? <Badge variant="secondary">Google</Badge> : null}
                    {user.authProviders.includes("email") ? <Badge variant="outline">Email</Badge> : null}
                    {user.authProviders.length === 0 ? <Badge variant="outline">Unknown</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span>{user.companyPhone ? formatPhoneNumber(user.companyPhone) : "No phone"}</span>
                    <span className="text-muted-foreground text-xs">
                      Gmail sending: {user.googleMailAccount?.email ?? "Not connected"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1 text-sm">
                    <span>Estimate: {user.estimateValidDays} days</span>
                    <span>Invoice: {user.invoiceDueDays} days</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1 text-sm">
                    <span>{user._count.customers.toLocaleString()} customers</span>
                    <span>
                      {user._count.jobs.toLocaleString()} jobs, {user._count.estimates.toLocaleString()} estimates,{" "}
                      {user._count.invoices.toLocaleString()} invoices
                    </span>
                  </div>
                </TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
                <TableCell>{formatDate(user.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
