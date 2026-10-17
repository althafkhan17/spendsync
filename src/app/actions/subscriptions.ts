"use server";

import { revalidatePath } from "next/cache";
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

type ActionResult = { success: boolean; error?: string };

const BILLING_CYCLES: readonly BillingCycle[] = ["MONTHLY", "ANNUAL"];
const STATUSES: readonly SubscriptionStatus[] = ["ACTIVE", "CANCELLED", "NEEDS_REVIEW"];

type ParsedForm = {
  merchantName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: Date;
  status: SubscriptionStatus;
};

/** Validates the shared add/edit form. Returns an error message or the parsed values. */
function parseSubscriptionForm(formData: FormData, fallbackStatus: SubscriptionStatus): { error: string } | { data: ParsedForm } {
  const merchantName = String(formData.get("merchantName") ?? "").trim();
  if (!merchantName) return { error: "Merchant name is required" };

  const amount = parseFloat(String(formData.get("amount") ?? ""));
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number" };

  const currency = String(formData.get("currency") ?? "USD").trim().toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Currency must be a 3-letter ISO code" };

  const billingCycle = String(formData.get("billingCycle") ?? "") as BillingCycle;
  if (!BILLING_CYCLES.includes(billingCycle)) return { error: "Invalid billing cycle" };

  const nextRenewalDateStr = String(formData.get("nextRenewalDate") ?? "");
  const nextRenewalDate = new Date(nextRenewalDateStr);
  if (!nextRenewalDateStr || isNaN(nextRenewalDate.getTime())) return { error: "Next renewal date is required" };

  const status = (String(formData.get("status") ?? "") || fallbackStatus) as SubscriptionStatus;
  if (!STATUSES.includes(status)) return { error: "Invalid subscription status" };

  return { data: { merchantName, amount, currency, billingCycle, nextRenewalDate, status } };
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/subscriptions");
}

/** Loads a subscription only if it belongs to the caller's workspace. */
async function findOwnedSubscription(id: string, workspaceId: string) {
  const existing = await prisma.subscription.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!existing) throw new Error("Unauthorized access");
  return existing;
}

function handleError(label: string, error: unknown): ActionResult {
  console.error(`Failed to ${label}:`, error);
  if (error instanceof Error && error.message === "Unauthorized access") {
    throw error;
  }
  return { success: false, error: "An unexpected error occurred" };
}

// ─────────────────────────────────────────────────────────
// Fetch subscriptions for the current user's workspace
// ─────────────────────────────────────────────────────────

export async function getSubscriptions(): Promise<SubscriptionRow[]> {
  const { workspaceId } = await ensureUserAndWorkspace();

  return prisma.subscription.findMany({
    where: { workspaceId },
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
}

// ─────────────────────────────────────────────────────────
// Add a new subscription
// ─────────────────────────────────────────────────────────

export async function addSubscription(formData: FormData): Promise<ActionResult> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    const parsed = parseSubscriptionForm(formData, "ACTIVE");
    if ("error" in parsed) return { success: false, error: parsed.error };

    await prisma.subscription.create({ data: { workspaceId, ...parsed.data } });

    revalidate();
    return { success: true };
  } catch (error) {
    return handleError("add subscription", error);
  }
}

// ─────────────────────────────────────────────────────────
// Update an existing subscription
// ─────────────────────────────────────────────────────────

export async function updateSubscription(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();
    await findOwnedSubscription(id, workspaceId);

    const parsed = parseSubscriptionForm(formData, "ACTIVE");
    if ("error" in parsed) return { success: false, error: parsed.error };

    await prisma.subscription.update({ where: { id }, data: parsed.data });

    revalidate();
    return { success: true };
  } catch (error) {
    return handleError("update subscription", error);
  }
}

// ─────────────────────────────────────────────────────────
// Delete a subscription (hard delete)
// ─────────────────────────────────────────────────────────

export async function deleteSubscription(id: string): Promise<ActionResult> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();
    await findOwnedSubscription(id, workspaceId);

    await prisma.subscription.delete({ where: { id } });

    revalidate();
    return { success: true };
  } catch (error) {
    return handleError("delete subscription", error);
  }
}

// ─────────────────────────────────────────────────────────
// Status changes
// ─────────────────────────────────────────────────────────

async function setStatus(id: string, status: SubscriptionStatus, label: string): Promise<ActionResult> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();
    await findOwnedSubscription(id, workspaceId);

    await prisma.subscription.update({ where: { id }, data: { status } });

    revalidate();
    return { success: true };
  } catch (error) {
    return handleError(label, error);
  }
}

export async function cancelSubscription(id: string): Promise<ActionResult> {
  return setStatus(id, "CANCELLED", "cancel subscription");
}

export async function reactivateSubscription(id: string): Promise<ActionResult> {
  return setStatus(id, "ACTIVE", "reactivate subscription");
}
