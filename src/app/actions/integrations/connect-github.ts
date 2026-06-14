"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

/**
 * Server action to securely verify and connect GitHub Copilot.
 * Stores the fine-grained PAT in `accessToken` and org slug in `refreshToken`.
 */
export async function connectGithubCopilot(
  orgSlug: string,
  githubToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!orgSlug || !orgSlug.trim()) {
      return { success: false, error: "Organization slug is required." };
    }
    if (!githubToken || !githubToken.trim()) {
      return { success: false, error: "GitHub token is required." };
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Upsert GITHUB_COPILOT integration row for the workspace
    await prisma.integration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: "GITHUB_COPILOT",
        },
      },
      create: {
        workspaceId,
        provider: "GITHUB_COPILOT",
        accessToken: githubToken.trim(),
        refreshToken: orgSlug.trim(),
        isActive: true,
      },
      update: {
        accessToken: githubToken.trim(),
        refreshToken: orgSlug.trim(),
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
    console.error("❌ Failed to connect GitHub Copilot:", error);
    return {
      success: false,
      error: error.message || "Failed to connect GitHub Copilot. Please try again.",
    };
  }
}
