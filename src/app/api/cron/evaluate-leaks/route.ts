import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/env";
import { evaluateLeaks } from "@/lib/engines/leak-evaluation";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/evaluate-leaks
 *
 * Emails workspace owners about seat leaks whose renewal is within 7 days.
 */
async function handle(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (!isAuthorizedCronRequest(request.headers)) {
    console.error("❌ Unauthorized evaluate-leaks request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await evaluateLeaks({ workspaceId: searchParams.get("workspaceId") ?? undefined });
    return NextResponse.json({
      success: true,
      processedCount: summary.processedCount,
      flaggedCount: summary.flagged.length,
      flagged: summary.flagged,
      skipped: summary.skipped,
    });
  } catch (error) {
    console.error("❌ Leak evaluation failed:", error);
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
