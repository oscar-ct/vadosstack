import { type NextRequest, NextResponse } from "next/server";

import { reconcileRecentStripePayments } from "@/lib/payments/stripe-reconciliation";
import { processDueStripeWebhookEvents } from "@/lib/payments/stripe-webhook-processor";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const webhooks = await processDueStripeWebhookEvents(50);
  const reconciliation = await reconcileRecentStripePayments({ days: 30, limit: 100 });
  const success = webhooks.failed === 0 && reconciliation.failed === 0;
  return NextResponse.json({ reconciliation, success, webhooks }, { status: success ? 200 : 503 });
}
