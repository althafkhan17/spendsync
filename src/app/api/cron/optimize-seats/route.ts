import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/env";
import { runSeatAudit } from "@/lib/engines/seat-audit";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/optimize-seats
 *
 * Daily seat optimizer. Compares billed seats (from invoices) with active
 * seats (from the vendor API) for every connected seat-based integration.
 * Optional `?workspaceId=` or `?integrationId=` narrows the run.
 */
async function handle(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (!isAuthorizedCronRequest(request.headers)) {
    console.error("❌ Unauthorized optimize-seats request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runSeatAudit({
      workspaceId: searchParams.get("workspaceId") ?? undefined,
      integrationId: searchParams.get("integrationId") ?? undefined,
    });
    return NextResponse.json({ success: true, processedCount: results.length, results });
  } catch (error) {
    console.error("❌ Seat optimizer failed:", error);
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
