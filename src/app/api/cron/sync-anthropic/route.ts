import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/env";
import { runAnthropicSync } from "@/lib/engines/anthropic-sync";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/sync-anthropic
 *
 * Pulls month-to-date Anthropic spend for every connected workspace and
 * raises a budget alert when the safety threshold is exceeded.
 */
async function handle(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (!isAuthorizedCronRequest(request.headers, searchParams)) {
    console.error("❌ Unauthorized sync-anthropic request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runAnthropicSync({
      workspaceId: searchParams.get("workspaceId") ?? undefined,
      integrationId: searchParams.get("integrationId") ?? undefined,
    });
    return NextResponse.json({
      success: true,
      syncedCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (error) {
    console.error("❌ Anthropic sync failed:", error);
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
