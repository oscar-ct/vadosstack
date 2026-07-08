import Link from "next/link";

import { PackageCheck, Plus } from "lucide-react";

import { AuthRequiredState } from "@/components/auth-required-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

import { OrdersTable } from "./_components/orders-table";
import { getOrderTableItems } from "./_lib/order-data";

export default async function Page() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return (
      <AuthRequiredState
        title="Sign in to view orders"
        description="Order records are private to each signed-in account."
      />
    );
  }

  const orders = await getOrderTableItems(currentUser.id);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 leading-none">
          <span className="text-lg">Orders</span>
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <PackageCheck className="size-4 text-muted-foreground" />
          </div>
        </CardTitle>
        <CardDescription>A simple index of orders.</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/orders/create">
              <Plus />
              Create Order
            </Link>
          </Button>
          <div id="orders-export-action" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <OrdersTable exportSlotId="orders-export-action" orders={orders} />
      </CardContent>
    </Card>
  );
}
