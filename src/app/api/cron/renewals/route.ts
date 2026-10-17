import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/env";
import { runRenewalAlerts } from "@/lib/engines/renewal-alerts";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/renewals
 *
 * Emails owners about subscriptions renewing in exactly 7 days
 * (override with `?days=`).
 */
async function handle(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (!isAuthorizedCronRequest(request.headers)) {
    console.error("❌ Unauthorized renewals request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const days = Math.max(1, Math.min(60, parseInt(searchParams.get("days") ?? "7", 10) || 7));
    const summary = await runRenewalAlerts(days);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error("❌ Renewal alerts failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
