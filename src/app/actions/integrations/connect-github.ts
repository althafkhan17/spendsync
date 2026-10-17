"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { isMockGithubToken, validateGithubAccess } from "@/lib/providers/github-copilot";
import { runSeatAudit } from "@/lib/engines/seat-audit";
import { encryptSecret } from "@/lib/crypto";

export type ConnectResult = {
  success: boolean;
  error?: string;
  /** Non-fatal note shown after connecting (e.g. token lacks Copilot billing scope). */
  warning?: string;
  dataSource?: "LIVE" | "SIMULATED";
};

/**
 * Verifies a GitHub organisation + token live, stores the integration and
 * runs the first audit immediately so the card is populated on return.
 * Stores the PAT in `accessToken` and the org slug in `refreshToken`.
 */
export async function connectGithubCopilot(orgSlug: string, githubToken: string): Promise<ConnectResult> {
  try {
    const slug = orgSlug.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    const token = githubToken.trim();
    if (!slug) return { success: false, error: "Organization slug is required." };
    if (!token) return { success: false, error: "GitHub token is required." };

    let warning: string | undefined;
    if (!isMockGithubToken(token)) {
      const access = await validateGithubAccess(slug, token);
      if (!access.ok) return { success: false, error: access.reason };
      if (!access.copilotAccess) {
        warning = `Connected to ${access.orgName}, but ${access.reason} Seat activity will be simulated until the token can read Copilot billing.`;
      }
    } else {
      warning = "Demo token accepted. Seat activity will be simulated.";
    }

    const { workspaceId } = await ensureUserAndWorkspace();
    const storedToken = encryptSecret(token);

    const integration = await prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: "GITHUB_COPILOT" } },
      create: {
        workspaceId,
        provider: "GITHUB_COPILOT",
        accessToken: storedToken,
        refreshToken: slug,
        isActive: true,
      },
      update: {
        accessToken: storedToken,
        refreshToken: slug,
        isActive: true,
        wastedSeats: null,
        wastedAmount: null,
        billedSeats: null,
        activeSeats: null,
        lastAuditAt: null,
        tokenUsageReport: null,
      },
    });

    const [result] = await runSeatAudit({ integrationId: integration.id });

    revalidatePath("/dashboard/integrations");
    revalidatePath("/dashboard");
    return { success: true, warning, dataSource: result?.dataSource };
  } catch (error) {
    console.error("❌ Failed to connect GitHub Copilot:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect GitHub Copilot. Please try again.",
    };
  }
}
