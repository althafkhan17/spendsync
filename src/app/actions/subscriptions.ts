"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import type { BillingCycle, SubscriptionStatus, Subscription } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export type SubscriptionRow = Pick<
  Subscription,
  | "id"
  | "merchantName"
  | "amount"
  | "currency"
  | "billingCycle"
  | "status"
  | "nextRenewalDate"
  | "createdAt"
>;

export type DashboardMetrics = {
  totalMonthlyBurn: number;
  activeCount: number;
  upcomingRenewals: number;
};

// ─────────────────────────────────────────────────────────
// Helper: Verify workspace membership access (IDOR Guard)
// ─────────────────────────────────────────────────────────

async function verifyWorkspaceAccess(workspaceId: string, clerkId: string): Promise<void> {
  const count = await prisma.workspace.count({
    where: {
      id: workspaceId,
      members: {
        some: {
          user: {
            clerkId,
          },
        },
      },
    },
  });
  if (count === 0) {
    throw new Error("Unauthorized access");
  }
}

// ─────────────────────────────────────────────────────────
// Fetch subscriptions for the current user's workspace
// ─────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized access");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  // Enforce ownership check
  await verifyWorkspaceAccess(workspaceId, clerkId);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      workspaceId,
      workspace: {
        members: {
          some: {
            user: {
              clerkId,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      merchantName: true,
      amount: true,
      currency: true,
      billingCycle: true,
      status: true,
      nextRenewalDate: true,
      createdAt: true,
    },
  });

  return subscriptions;
}

// ─────────────────────────────────────────────────────────
// Calculate dashboard metrics from subscriptions
// ─────────────────────────────────────────────────────────

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized access");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  // Enforce ownership check
  await verifyWorkspaceAccess(workspaceId, clerkId);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      workspaceId,
      workspace: {
        members: {
          some: {
            user: {
              clerkId,
            },
          },
        },
      },
    },
    select: {
      amount: true,
      billingCycle: true,
      status: true,
      nextRenewalDate: true,
    },
  });

  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === "ACTIVE"
  );

  // Total Monthly Burn: monthly as-is, annual ÷ 12
  const totalMonthlyBurn = activeSubscriptions.reduce((sum, s) => {
    const amount = Number(s.amount);
    return sum + (s.billingCycle === "ANNUAL" ? amount / 12 : amount);
  }, 0);

  // Upcoming renewals within the next 30 days
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRenewals = activeSubscriptions.filter(
    (s) =>
      s.nextRenewalDate >= now && s.nextRenewalDate <= thirtyDaysFromNow
  ).length;

  return {
    totalMonthlyBurn: Math.round(totalMonthlyBurn * 100) / 100,
    activeCount: activeSubscriptions.length,
    upcomingRenewals,
  };
}

// ─────────────────────────────────────────────────────────
// Add a new subscription
// ─────────────────────────────────────────────────────────

export async function addSubscription(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Enforce ownership check
    await verifyWorkspaceAccess(workspaceId, clerkId);

    const merchantName = formData.get("merchantName") as string;
    const amountStr = formData.get("amount") as string;
    const billingCycle = formData.get("billingCycle") as BillingCycle;
    const nextRenewalDateStr = formData.get("nextRenewalDate") as string;
    const status = (formData.get("status") as SubscriptionStatus) || "ACTIVE";

    // Validation
    if (!merchantName?.trim()) {
      return { success: false, error: "Merchant name is required" };
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Amount must be a positive number" };
    }
    if (!["MONTHLY", "ANNUAL"].includes(billingCycle)) {
      return { success: false, error: "Invalid billing cycle" };
    }
    if (!nextRenewalDateStr) {
      return { success: false, error: "Next renewal date is required" };
    }

    await prisma.subscription.create({
      data: {
        workspaceId,
        merchantName: merchantName.trim(),
        amount,
        billingCycle,
        status,
        nextRenewalDate: new Date(nextRenewalDateStr),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");
    return { success: true };
  } catch (error) {
    console.error("Failed to add subscription:", error);
    if (error instanceof Error && error.message === "Unauthorized access") {
      throw error;
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─────────────────────────────────────────────────────────
// Update an existing subscription
// ─────────────────────────────────────────────────────────

export async function updateSubscription(
  id: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Enforce ownership check
    await verifyWorkspaceAccess(workspaceId, clerkId);

    // Verify the subscription belongs to this workspace
    const existing = await prisma.subscription.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new Error("Unauthorized access");
    }

    const merchantName = formData.get("merchantName") as string;
    const amountStr = formData.get("amount") as string;
    const billingCycle = formData.get("billingCycle") as BillingCycle;
    const nextRenewalDateStr = formData.get("nextRenewalDate") as string;
    const status = formData.get("status") as SubscriptionStatus;

    // Validation
    if (!merchantName?.trim()) {
      return { success: false, error: "Merchant name is required" };
    }
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: "Amount must be a positive number" };
    }
    if (!["MONTHLY", "ANNUAL"].includes(billingCycle)) {
      return { success: false, error: "Invalid billing cycle" };
    }
    if (!nextRenewalDateStr) {
      return { success: false, error: "Next renewal date is required" };
    }
    if (!["ACTIVE", "CANCELLED", "NEEDS_REVIEW"].includes(status)) {
      return { success: false, error: "Invalid subscription status" };
    }

    await prisma.subscription.update({
      where: { id },
      data: {
        merchantName: merchantName.trim(),
        amount,
        billingCycle,
        status,
        nextRenewalDate: new Date(nextRenewalDateStr),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");
    return { success: true };
  } catch (error) {
    console.error("Failed to update subscription:", error);
    if (error instanceof Error && error.message === "Unauthorized access") {
      throw error;
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─────────────────────────────────────────────────────────
// Delete a subscription (hard delete)
// ─────────────────────────────────────────────────────────

export async function deleteSubscription(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Enforce ownership check
    await verifyWorkspaceAccess(workspaceId, clerkId);

    // Verify the subscription belongs to this workspace
    const existing = await prisma.subscription.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new Error("Unauthorized access");
    }

    await prisma.subscription.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete subscription:", error);
    if (error instanceof Error && error.message === "Unauthorized access") {
      throw error;
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─────────────────────────────────────────────────────────
// Cancel a subscription (set status to CANCELLED)
// ─────────────────────────────────────────────────────────

export async function cancelSubscription(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Enforce ownership check
    await verifyWorkspaceAccess(workspaceId, clerkId);

    // Verify the subscription belongs to this workspace
    const existing = await prisma.subscription.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new Error("Unauthorized access");
    }

    await prisma.subscription.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    if (error instanceof Error && error.message === "Unauthorized access") {
      throw error;
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ─────────────────────────────────────────────────────────
// Reactivate a subscription (set status to ACTIVE)
// ─────────────────────────────────────────────────────────

export async function reactivateSubscription(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    // Enforce ownership check
    await verifyWorkspaceAccess(workspaceId, clerkId);

    // Verify the subscription belongs to this workspace
    const existing = await prisma.subscription.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new Error("Unauthorized access");
    }

    await prisma.subscription.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");
    return { success: true };
  } catch (error) {
    console.error("Failed to reactivate subscription:", error);
    if (error instanceof Error && error.message === "Unauthorized access") {
      throw error;
    }
    return { success: false, error: "An unexpected error occurred" };
  }
}
