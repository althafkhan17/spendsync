"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { validateAnthropicKey } from "@/lib/providers/anthropic";
import { runAnthropicSync } from "@/lib/engines/anthropic-sync";
import type { ConnectResult } from "@/app/actions/integrations/connect-github";

/**
 * Verifies an Anthropic key live, stores the integration and runs the first
 * sync immediately. Stores the key in `accessToken` and the USD safety
 * threshold in `refreshToken`.
 */
export async function connectAnthropic(apiKey: string, threshold: string): Promise<ConnectResult> {
  try {
    const key = apiKey.trim();
    if (!key) return { success: false, error: "Anthropic API key is required." };

    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
      return { success: false, error: "Safety threshold must be a positive number." };
    }

    const check = await validateAnthropicKey(key);
    if (!check.ok) return { success: false, error: check.reason };

    const { workspaceId } = await ensureUserAndWorkspace();

    const integration = await prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: "ANTHROPIC" } },
      create: {
        workspaceId,
        provider: "ANTHROPIC",
        accessToken: key,
        refreshToken: numericThreshold.toFixed(2),
        isActive: true,
      },
      update: {
        accessToken: key,
        refreshToken: numericThreshold.toFixed(2),
        isActive: true,
        wastedSeats: null,
        wastedAmount: null,
        billedSeats: null,
        activeSeats: null,
        lastAuditAt: null,
        tokenUsageReport: null,
      },
    });

    const [result] = await runAnthropicSync({ integrationId: integration.id });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    return { success: true, warning: check.note ?? undefined, dataSource: result?.dataSource };
  } catch (error) {
    console.error("❌ Failed to connect Anthropic Claude:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect Anthropic Claude. Please try again.",
    };
  }
}

/** Update only the monthly safety threshold for an existing Anthropic integration. */
export async function updateAnthropicThreshold(threshold: string): Promise<ConnectResult> {
  try {
    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
      return { success: false, error: "Safety threshold must be a positive number." };
    }
    const { workspaceId } = await ensureUserAndWorkspace();
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "ANTHROPIC" } },
    });
    if (!integration) return { success: false, error: "Anthropic is not connected." };
    await prisma.integration.update({
      where: { id: integration.id },
      data: { refreshToken: numericThreshold.toFixed(2) },
    });
    const [result] = await runAnthropicSync({ integrationId: integration.id });
    revalidatePath("/dashboard/integrations");
    return { success: true, dataSource: result?.dataSource };
  } catch (error) {
    console.error("❌ Failed to update threshold:", error);
    return { success: false, error: "Failed to update threshold." };
  }
}
