import Link from "next/link";

import { Mail, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { EmailTemplatesDashboard } from "./_components/email-templates-dashboard";
import { getEmailTemplates } from "./_lib/template-data";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view email templates"
        description="Reusable email templates are private to each signed-in account."
      />
    );
  }

  const templates = await getEmailTemplates(currentUser.id);

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-2">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-normal">
                <Mail className="size-4" />
                Email library
              </div>
              <CardTitle className="text-xl">Email templates</CardTitle>
              <CardDescription>
                Build reusable estimate and invoice messages with variables that render inside document composers.
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link prefetch={false} href="/dashboard/email-templates/create">
                <Plus />
                Create template
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <EmailTemplatesDashboard templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
