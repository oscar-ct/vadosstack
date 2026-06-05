import { type NextRequest, NextResponse } from "next/server";

import { cleanupAuthRecords } from "@/lib/auth-cleanup";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const deleted = await cleanupAuthRecords();

  return NextResponse.json({
    deleted,
    success: true,
  });
}
