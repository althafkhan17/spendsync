"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

/**
 * Server action to securely verify and connect Anthropic Claude.
 * Stores the API Key in `accessToken` and safety limit threshold in `refreshToken`.
 */
export async function connectAnthropic(
  apiKey: string,
  threshold: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiKey || !apiKey.trim()) {
      return { success: false, error: "Anthropic API key is required." };
    }
    if (!apiKey.trim().startsWith("sk-ant-")) {
      return { success: false, error: "Invalid API key format. Must start with 'sk-ant-'." };
    }

    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
      return { success: false, error: "Safety threshold must be a positive number." };
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Upsert ANTHROPIC integration row for the workspace
    await prisma.integration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: "ANTHROPIC",
        },
      },
      create: {
        workspaceId,
        provider: "ANTHROPIC",
        accessToken: apiKey.trim(),
        refreshToken: threshold.trim(),
        isActive: true,
      },
      update: {
        accessToken: apiKey.trim(),
        refreshToken: threshold.trim(),
        isActive: true,
        // Reset metrics on reconnect/update
        wastedSeats: null,
        wastedAmount: null,
        billedSeats: null,
        activeSeats: null,
        lastAuditAt: null,
      },
    });

    revalidatePath("/dashboard/integrations");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Failed to connect Anthropic Claude:", error);
    return {
      success: false,
      error: error.message || "Failed to connect Anthropic Claude. Please try again.",
    };
  }
}
