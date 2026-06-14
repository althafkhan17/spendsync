import type { Subscription } from "@prisma/client";

export interface SubscriptionLike {
  amount: any; // Handles Prisma Decimal or standard number
  billingCycle: "MONTHLY" | "ANNUAL";
  status: "ACTIVE" | "CANCELLED" | "NEEDS_REVIEW";
  nextRenewalDate: Date;
}

export interface DashboardMetrics {
  totalMonthlyBurn: number;
  activeCount: number;
  upcomingRenewalsCount: number;
}

/**
 * Calculates financial metrics from workspace subscriptions.
 * Loops through active plans and aggregates monthly burn and active count.
 * Determines active subscriptions renewing in the next 30 days.
 */
export function calculateDashboardMetrics(
  subscriptions: SubscriptionLike[]
): DashboardMetrics {
  const activeSubscriptions = subscriptions.filter((s) => s.status === "ACTIVE");

  // Total Monthly Burn: monthly as-is, annual divided by 12
  const totalMonthlyBurn = activeSubscriptions.reduce((sum, s) => {
    const amount = Number(s.amount);
    if (isNaN(amount)) return sum;
    return sum + (s.billingCycle === "ANNUAL" ? amount / 12 : amount);
  }, 0);

  // Upcoming renewals within the next 30 days
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingRenewalsCount = activeSubscriptions.filter((s) => {
    const renewalTime = new Date(s.nextRenewalDate).getTime();
    return renewalTime >= now.getTime() && renewalTime <= thirtyDaysFromNow.getTime();
  }).length;

  return {
    totalMonthlyBurn: Math.round(totalMonthlyBurn * 100) / 100, // Round to 2 decimal places
    activeCount: activeSubscriptions.length,
    upcomingRenewalsCount,
  };
}
