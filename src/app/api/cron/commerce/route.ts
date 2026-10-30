import { type NextRequest, NextResponse } from "next/server";

import { deliverInventoryStockAlerts, expireUnpaidOrderHolds } from "@/lib/commerce/maintenance";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ success: false }, { status: 401 });
  try {
    const holds = await expireUnpaidOrderHolds();
    const alerts = await deliverInventoryStockAlerts();
    return NextResponse.json({ holds, alerts, success: alerts.failed === 0 }, { status: alerts.failed ? 503 : 200 });
  } catch (error) {
    console.error("Commerce maintenance failed.", error);
    return NextResponse.json({ success: false, message: "Commerce maintenance failed." }, { status: 503 });
  }
}
