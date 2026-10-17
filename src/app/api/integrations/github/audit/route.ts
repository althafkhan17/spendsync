import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { runSeatAudit } from "@/lib/engines/seat-audit";
import { parseAuditReport } from "@/lib/audit-report";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/integrations/github/audit
 *
 * Runs the seat audit for the signed-in workspace's GitHub Copilot
 * integration and returns the stored report.
 */
async function handle() {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "GITHUB_COPILOT" } },
    });
    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: "GitHub Copilot is not connected for this workspace." }, { status: 404 });
    }
    const [result] = await runSeatAudit({ integrationId: integration.id });
    const refreshed = await prisma.integration.findUnique({ where: { id: integration.id } });
    return NextResponse.json({
      success: result?.status === "SUCCESS",
      result,
      report: parseAuditReport(refreshed?.tokenUsageReport),
    });
  } catch (error) {
    console.error("❌ GitHub audit failed:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return handle();
}

export async function POST() {
  return handle();
}
