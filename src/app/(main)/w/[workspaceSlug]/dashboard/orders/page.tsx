import { PackageCheck, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { PermissionDisabledButton } from "@/components/permission-disabled-button";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceLink as Link } from "@/components/workspace-path-provider";
import { can, getPermittedDashboardAuthorization } from "@/lib/authorization";

import { OrdersTable } from "./_components/orders-table";
import { getOrderTableItems } from "./_lib/order-data";

export default async function Page() {
  const authorization = await getPermittedDashboardAuthorization("orders.view");

  if (!authorization) {
    return (
      <AuthRequiredState
        title="Sign in to view orders"
        description="Order records are private to each signed-in account."
      />
    );
  }

  const orders = await getOrderTableItems(authorization.workspaceId);
  const canCreate = can(authorization.membership, "orders.create");
  const canExport = can(authorization.membership, "reports.export");
  const canManageReturns = can(authorization.membership, "orders.returns.manage");
  const canUpdate = can(authorization.membership, "orders.update");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className="text-xl">Orders</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PackageCheck className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>A simple index of orders.</CardDescription>
        <CardAction className="flex items-center gap-2">
          {canCreate ? (
            <Button asChild size="sm">
              <Link href="/dashboard/orders/create">
                <Plus />
                Create Order
              </Link>
            </Button>
          ) : null}
          {!canCreate ? (
            <PermissionDisabledButton size="sm" reason="Your role can view orders but cannot create them.">
              <Plus />
              Create Order
            </PermissionDisabledButton>
          ) : null}
          {canExport ? <div id="orders-export-action" /> : null}
        </CardAction>
      </CardHeader>
      <CardContent>
        <OrdersTable
          canExport={canExport}
          canManageReturns={canManageReturns}
          canUpdate={canUpdate}
          exportSlotId={canExport ? "orders-export-action" : undefined}
          orders={orders}
        />
      </CardContent>
    </Card>
  );
}
