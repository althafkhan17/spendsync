"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { runSeatAudit } from "@/lib/engines/seat-audit";
import { runAnthropicSync } from "@/lib/engines/anthropic-sync";
import { evaluateLeaks } from "@/lib/engines/leak-evaluation";

export type IntegrationRow = {
  id: string;
  provider: string;
  isActive: boolean;
  lastAuditAt: string | null;
  createdAt: string;
  wastedSeats: number | null;
  wastedAmount: number | null;
  billedSeats: number | null;
  activeSeats: number | null;
  /** JSON audit report (see src/lib/audit-report.ts). */
  tokenUsageReport: string | null;
  /** Provider-specific public setting: org slug for GitHub, USD threshold for Anthropic. */
  refreshToken: string | null;
};

/**
 * Fetch all integrations for the current user's workspace.
 * Never returns access tokens.
 */
export async function getIntegrations(): Promise<IntegrationRow[]> {
  const { workspaceId } = await ensureUserAndWorkspace();

  const integrations = await prisma.integration.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      provider: true,
      isActive: true,
      lastAuditAt: true,
      createdAt: true,
      wastedSeats: true,
      wastedAmount: true,
      billedSeats: true,
      activeSeats: true,
      tokenUsageReport: true,
      refreshToken: true,
    },
  });

  return integrations.map((i) => ({
    id: i.id,
    provider: i.provider,
    isActive: i.isActive,
    lastAuditAt: i.lastAuditAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    wastedSeats: i.wastedSeats,
    wastedAmount: i.wastedAmount ? Number(i.wastedAmount) : null,
    billedSeats: i.billedSeats,
    activeSeats: i.activeSeats,
    tokenUsageReport: i.tokenUsageReport,
    // Figma stores a real OAuth refresh token here; never expose it.
    refreshToken: i.provider === "FIGMA" ? null : i.refreshToken,
  }));
}

export type AuditTriggerResult = {
  success: boolean;
  error?: string;
  dataSource?: "LIVE" | "SIMULATED";
  summary?: string;
};

/**
 * Run the relevant engine for one integration right now.
 * Calls the engine in-process so it works locally, in preview deployments,
 * and behind Vercel deployment protection without any extra tokens.
 */
export async function triggerAudit(integrationId: string): Promise<AuditTriggerResult> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    const integration = await prisma.integration.findFirst({ where: { id: integrationId, workspaceId } });
    if (!integration) {
      return { success: false, error: "Integration not found or access denied" };
    }

    if (integration.provider === "ANTHROPIC") {
      const [result] = await runAnthropicSync({ integrationId });
      revalidatePath("/dashboard/integrations");
      revalidatePath("/dashboard");
      if (!result || !result.success) {
        return { success: false, error: result?.error ?? "Sync failed" };
      }
      return {
        success: true,
        dataSource: result.dataSource,
        summary: `Month-to-date spend $${(result.totalCostUsd ?? 0).toFixed(2)} of $${(result.thresholdUsd ?? 0).toFixed(2)} budget`,
      };
    }

    const [result] = await runSeatAudit({ integrationId });
    if (!result || result.status !== "SUCCESS") {
      revalidatePath("/dashboard/integrations");
      return { success: false, error: result?.error ?? "Audit failed" };
    }

    // Immediately evaluate whether this leak needs a renewal warning.
    try {
      await evaluateLeaks({ workspaceId });
    } catch (err) {
      console.error("[Action] Leak evaluation after audit failed:", err);
    }

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    return {
      success: true,
      dataSource: result.dataSource,
      summary: `${result.wastedSeats ?? 0} idle of ${result.billedSeats ?? 0} billed seats`,
    };
  } catch (error) {
    console.error("❌ Failed to trigger audit:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to trigger audit" };
  }
}

/**
 * Disconnect (hard-delete) an integration by ID within the user's workspace.
 */
export async function disconnectIntegration(integrationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();
    const integration = await prisma.integration.findFirst({ where: { id: integrationId, workspaceId } });
    if (!integration) {
      return { success: false, error: "Integration not found or access denied" };
    }
    await prisma.integration.delete({ where: { id: integrationId } });
    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to disconnect integration:", error);
    return { success: false, error: "Failed to disconnect integration" };
  }
}
