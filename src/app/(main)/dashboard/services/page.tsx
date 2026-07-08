import Link from "next/link";

import { PackageCheck, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { ServicesDashboard } from "./_components/services-dashboard";
import { getServices } from "./_lib/service-data";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view services"
        description="Reusable service templates are private to each signed-in account."
      />
    );
  }

  const services = await getServices(currentUser.id);

  return (
    <div className="@container/main mx-auto grid w-full max-w-7xl gap-4 md:gap-6">
      <Card className="overflow-hidden rounded-lg">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-2xl gap-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                Services
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <PackageCheck className="size-4" />
                </span>
              </CardTitle>
              <CardDescription>
                Keep your repeatable work scopes easy to scan, price, and reuse in jobs or estimates.
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link prefetch={false} href="/dashboard/services/create">
                <Plus />
                Create service
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-5">
          <ServicesDashboard services={services} />
        </CardContent>
      </Card>
    </div>
  );
}
