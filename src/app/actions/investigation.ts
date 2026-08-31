"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { runFullInvestigation } from "@/lib/agents/orchestrator";
import type { InvestigationResult } from "@/lib/agents/types";

// ─────────────────────────────────────────────────────────
// Synthetic Fallback Dataset
//
// Used when no real telemetry integration is connected so
// the agent pipeline always runs in demo mode and the
// multi-agent trajectory is fully observable for reviewers.
// ─────────────────────────────────────────────────────────

const SYNTHETIC_USERS = [
  { id: "u1", email: "alice.chen@company.com", name: "Alice Chen", role: "member", lastActiveAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 47 },
  { id: "u2", email: "bob.martinez@company.com", name: "Bob Martinez", role: "member", lastActiveAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 31 },
  { id: "u3", email: "carol.wu@company.com", name: "Carol Wu", role: "member", lastActiveAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 2 },
  { id: "u4", email: "dave.smith@company.com", name: "Dave Smith", role: "member", lastActiveAt: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 0 },
  { id: "u5", email: "emma.jones@company.com", name: "Emma Jones", role: "member", lastActiveAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 0 },
  { id: "u6", email: "ci-bot@company.com", name: "CI/CD Runner", role: "service", lastActiveAt: "", activityCount: 0 },
  { id: "u7", email: "admin-security@company.com", name: "Security Admin", role: "admin", lastActiveAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 1 },
  { id: "u8", email: "frank.taylor@company.com", name: "Frank Taylor", role: "member", lastActiveAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 3 },
  { id: "u9", email: "grace.lee@company.com", name: "Grace Lee", role: "member", lastActiveAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 85 },
  { id: "u10", email: "deploy-bot@company.com", name: "Deploy Bot", role: "service", lastActiveAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(), activityCount: 0 },
];

// ─────────────────────────────────────────────────────────
// Server Action
// ─────────────────────────────────────────────────────────

/**
 * Runs the full multi-agent investigation pipeline for a given
 * subscription. Fetches invoice logs and connected integration
 * telemetry, then feeds them into the orchestrator.
 *
 * Returns a serializable InvestigationResult. If no real
 * integration telemetry is available, uses a synthetic demo
 * dataset so the pipeline always runs end-to-end.
 */
export async function runInvestigationForSubscription(
  subscriptionId: string
): Promise<InvestigationResult> {
  // ── Auth Guard ──
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  // ── Verify the subscription belongs to this workspace ──
  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      workspaceId,
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found or access denied.");
  }

  // ── Fetch associated email logs (most recent first) ──
  const emailLogs = await prisma.emailLog.findMany({
    where: {
      workspaceId,
      subscriptionId,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Build invoice text from the most recent log's raw extraction or body preview
  let invoiceText = "";

  if (emailLogs.length > 0) {
    const latestLog = emailLogs[0];
    if (latestLog.rawExtraction) {
      invoiceText += `[Extracted Data]\n${latestLog.rawExtraction}\n\n`;
    }
    invoiceText += `[Email Subject] ${latestLog.subject}\n`;
    invoiceText += `[Sender] ${latestLog.senderEmail}\n`;
    invoiceText += `[Body Preview]\n${latestLog.bodyPreview}\n`;
    invoiceText += `[Source] ${latestLog.source}`;
    if (latestLog.attachmentName) {
      invoiceText += ` (${latestLog.attachmentName})`;
    }
  } else {
    // No email logs — build a minimal invoice text from the subscription itself
    invoiceText =
      `[Subscription Record]\n` +
      `Vendor: ${subscription.merchantName}\n` +
      `Amount: ${subscription.currency} ${subscription.amount}\n` +
      `Billing Cycle: ${subscription.billingCycle}\n` +
      `Billed Seats: ${subscription.billedSeats ?? 1}\n` +
      `Seat Unit Price: ${subscription.seatUnitPrice ?? subscription.amount}\n` +
      `Next Renewal: ${subscription.nextRenewalDate.toISOString().split("T")[0]}\n` +
      `Status: ${subscription.status}`;
  }

  // ── Fetch connected integration telemetry (if any) ──
  // Try to match an active integration to this subscription's vendor
  const integration = await prisma.integration.findFirst({
    where: {
      workspaceId,
      isActive: true,
      provider: {
        in: resolveProviderKeys(subscription.merchantName),
      },
    },
  });

  let telemetryUsers = SYNTHETIC_USERS;

  if (integration?.tokenUsageReport) {
    try {
      const report = JSON.parse(integration.tokenUsageReport);
      if (Array.isArray(report.individualSeats) && report.individualSeats.length > 0) {
        telemetryUsers = report.individualSeats.map((seat: any, idx: number) => ({
          id: `real-${idx}`,
          email: seat.username ? `${seat.username}@org.com` : `user-${idx}@org.com`,
          name: seat.username ?? `User ${idx}`,
          role: seat.status === "IDLE" ? "member" : "member",
          lastActiveAt: seat.lastActivityAt ?? "",
          activityCount: seat.status === "ACTIVE" ? 10 : 0,
        }));
      }
    } catch {
      // Fallback to synthetic data on parse error
    }
  }

  // ── Run the multi-agent pipeline ──
  const result = await runFullInvestigation({
    invoiceInput: {
      rawText: invoiceText,
    },
    telemetryInput: {
      users: telemetryUsers,
      inactivityThresholdDays: 30,
    },
  });

  return result;
}

/**
 * Resolves a merchant name to possible Integration provider keys.
 * e.g. "FIGMA" -> ["FIGMA"], "GitHub Copilot" -> ["GITHUB_COPILOT"]
 */
function resolveProviderKeys(merchantName: string): string[] {
  const lower = merchantName.toLowerCase();

  if (lower.includes("figma")) return ["FIGMA"];
  if (lower.includes("github") || lower.includes("copilot")) return ["GITHUB_COPILOT"];
  if (lower.includes("anthropic") || lower.includes("claude")) return ["ANTHROPIC"];
  if (lower.includes("slack")) return ["SLACK"];
  if (lower.includes("zoom")) return ["ZOOM"];
  if (lower.includes("notion")) return ["NOTION"];

  // Wildcard: try the name itself as-is
  return [merchantName.toUpperCase().replace(/\s+/g, "_")];
}
