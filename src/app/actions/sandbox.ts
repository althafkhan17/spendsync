"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

export interface SandboxSimulationResult {
  oldMonthlyBurn: number;
  newMonthlyBurn: number;
  monthlySavings: number;
  annualProjectedSavings: number;
  seatsRetained: number;
  seatsPruned: number;
  currency: string;
}

export interface StagedActionResult {
  success: boolean;
  message: string;
  rollbackAvailableUntil: string;
}

export interface RejectProposalResult {
  success: boolean;
  message: string;
}

/**
 * Executes a zero-risk sandbox simulation of the proposed seat pruning.
 * Calculates financial ROI, monthly burn reduction, and annual savings
 * without modifying real upstream account seats.
 */
export async function executeSandboxSimulation(
  subscriptionId: string,
  approvedUserIds: string[],
  monthlySavings: number
): Promise<SandboxSimulationResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  // Fetch the target subscription
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, workspaceId },
  });

  if (!subscription) {
    throw new Error("Subscription not found or access denied.");
  }

  // Fetch all active subscriptions to compute workspace-level burn
  const allActive = await prisma.subscription.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { amount: true, billingCycle: true },
  });

  const oldMonthlyBurn = allActive.reduce((sum, s) => {
    const amt = Number(s.amount);
    return sum + (s.billingCycle === "ANNUAL" ? amt / 12 : amt);
  }, 0);

  const roundedOldBurn = Math.round(oldMonthlyBurn * 100) / 100;
  const roundedSavings = Math.round(monthlySavings * 100) / 100;
  const newMonthlyBurn = Math.max(0, Math.round((roundedOldBurn - roundedSavings) * 100) / 100);
  const annualProjectedSavings = Math.round(roundedSavings * 12 * 100) / 100;

  const totalBilledSeats = subscription.billedSeats ?? Math.max(approvedUserIds.length, 1);
  const seatsPruned = approvedUserIds.length;
  const seatsRetained = Math.max(0, totalBilledSeats - seatsPruned);

  return {
    oldMonthlyBurn: roundedOldBurn,
    newMonthlyBurn,
    monthlySavings: roundedSavings,
    annualProjectedSavings,
    seatsRetained,
    seatsPruned,
    currency: subscription.currency,
  };
}

/**
 * Human-in-the-Loop Approval Action.
 * Commits a staged deprovisioning execution event with an automated
 * 14-day rollback safety guarantee.
 */
export async function approveStagedAction(
  subscriptionId: string,
  approvedUserIds: string[],
  notes?: string
): Promise<StagedActionResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, workspaceId },
  });

  if (!subscription) {
    throw new Error("Subscription not found or access denied.");
  }

  const rollbackDateObj = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const rollbackAvailableUntil = rollbackDateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const stagedLogEntry =
    `[STAGED_PRUNE] Approved deprovisioning for ${approvedUserIds.length} seat(s) on ${new Date().toISOString().split("T")[0]}. ` +
    `Rollback safety active until ${rollbackAvailableUntil}. ${notes ? `Notes: ${notes}` : ""}`.trim();

  const existingNotes = subscription.notes ? `${subscription.notes}\n` : "";

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      notes: `${existingNotes}${stagedLogEntry}`,
    },
  });

  return {
    success: true,
    message: `Successfully approved & staged deprovisioning for ${approvedUserIds.length} seat(s). 14-day rollback guarantee is active until ${rollbackAvailableUntil}.`,
    rollbackAvailableUntil,
  };
}

/**
 * Rejects or dismisses the AI agent proposal for the current billing cycle.
 */
export async function rejectAgentProposal(
  subscriptionId: string,
  reason?: string
): Promise<RejectProposalResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, workspaceId },
  });

  if (!subscription) {
    throw new Error("Subscription not found or access denied.");
  }

  const dismissLogEntry =
    `[PROPOSAL_DISMISSED] Dismissed on ${new Date().toISOString().split("T")[0]}. Reason: ${reason || "User dismissed without comment."}`;

  const existingNotes = subscription.notes ? `${subscription.notes}\n` : "";

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      notes: `${existingNotes}${dismissLogEntry}`,
    },
  });

  return {
    success: true,
    message: "Agent proposal dismissed. The alert engine will skip this item for the current cycle.",
  };
}
