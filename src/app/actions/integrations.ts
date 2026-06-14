"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

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
  tokenUsageReport?: string | null;
};

/**
 * Fetch all integrations for the current user's workspace.
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
  }));
}

/**
 * Manually trigger the seat optimizer cron endpoint for this workspace.
 */
export async function triggerAudit(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    // IDOR guard: verify integration belongs to this workspace
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        workspaceId,
      },
    });

    if (!integration) {
      return { success: false, error: "Integration not found or access denied" };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    // Construct request with cron secret if configured
    const url = new URL("/api/cron/optimize-seats", appUrl);
    if (process.env.CRON_SECRET) {
      url.searchParams.set("secret", process.env.CRON_SECRET);
    }

    console.log(`[Action] Triggering seat optimizer audit manually via API: ${url.pathname}`);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Action] Audit API returned error ${res.status}:`, errorText);
      return { success: false, error: `Audit server returned status ${res.status}` };
    }

    const data = await res.json();
    console.log(`[Action] Audit completed successfully:`, data);

    // After a successful manual audit, trigger evaluate-leaks to send warning email if applicable
    try {
      const evaluateUrl = new URL("/api/cron/evaluate-leaks", appUrl);
      if (process.env.CRON_SECRET) {
        evaluateUrl.searchParams.set("secret", process.env.CRON_SECRET);
      }
      console.log(`[Action] Triggering seat evaluation manually after audit: ${evaluateUrl.pathname}`);
      const evalRes = await fetch(evaluateUrl.toString());
      if (evalRes.ok) {
        const evalData = await evalRes.json();
        console.log(`[Action] Seat evaluation triggered successfully:`, evalData);
      } else {
        console.error(`[Action] Seat evaluation failed with status ${evalRes.status}`);
      }
    } catch (evalErr) {
      console.error("[Action] Failed to trigger evaluate-leaks after manual audit:", evalErr);
    }

    revalidatePath("/dashboard/integrations");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to trigger audit manually:", error);
    return { success: false, error: error.message || "Failed to trigger audit" };
  }
}

/**
 * Disconnect (hard-delete) an integration by ID.
 * Enforces IDOR guard — only allows deletion within the user's own workspace.
 */
export async function disconnectIntegration(
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    // IDOR guard: verify integration belongs to this workspace
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        workspaceId,
      },
    });

    if (!integration) {
      return { success: false, error: "Integration not found or access denied" };
    }

    await prisma.integration.delete({
      where: { id: integrationId },
    });

    revalidatePath("/dashboard/integrations");
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to disconnect integration:", error);
    return { success: false, error: "Failed to disconnect integration" };
  }
}
