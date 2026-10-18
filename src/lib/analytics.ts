import { isSeatReport, parseAuditReport } from "@/lib/audit-report";

export interface SubscriptionLike {
  amount: unknown; // Prisma Decimal or number
  currency?: string | null;
  billingCycle: "MONTHLY" | "ANNUAL";
  status: "ACTIVE" | "CANCELLED" | "NEEDS_REVIEW";
  nextRenewalDate: Date;
}

export interface DashboardMetrics {
  /** Monthly burn in the primary currency (the currency with the largest spend). */
  totalMonthlyBurn: number;
  primaryCurrency: string;
  /** Monthly burn per currency, for workspaces that mix e.g. USD and INR. */
  burnByCurrency: Record<string, number>;
  activeCount: number;
  upcomingRenewalsCount: number;
  needsReviewCount: number;
}

function monthly(amount: number, cycle: "MONTHLY" | "ANNUAL"): number {
  return cycle === "ANNUAL" ? amount / 12 : amount;
}

/**
 * Aggregates workspace subscriptions into the dashboard KPIs. Annual plans are
 * normalised to a monthly figure; currencies are never summed together.
 */
export function calculateDashboardMetrics(subscriptions: SubscriptionLike[]): DashboardMetrics {
  const active = subscriptions.filter((s) => s.status === "ACTIVE");

  const burnByCurrency: Record<string, number> = {};
  for (const s of active) {
    const amount = Number(s.amount);
    if (!isFinite(amount)) continue;
    const currency = (s.currency || "USD").toUpperCase();
    burnByCurrency[currency] = (burnByCurrency[currency] ?? 0) + monthly(amount, s.billingCycle);
  }
  for (const k of Object.keys(burnByCurrency)) {
    burnByCurrency[k] = Math.round(burnByCurrency[k] * 100) / 100;
  }

  const primaryCurrency =
    Object.entries(burnByCurrency).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const upcomingRenewalsCount = active.filter((s) => {
    const t = new Date(s.nextRenewalDate).getTime();
    return t >= now && t <= in30Days;
  }).length;

  return {
    totalMonthlyBurn: burnByCurrency[primaryCurrency] ?? 0,
    primaryCurrency,
    burnByCurrency,
    activeCount: active.length,
    upcomingRenewalsCount,
    needsReviewCount: subscriptions.filter((s) => s.status === "NEEDS_REVIEW").length,
  };
}

export interface IntegrationLike {
  provider: string;
  isActive: boolean;
  wastedAmount: number | null;
  tokenUsageReport: string | null;
}

export interface LeakMetrics {
  /** Monthly idle-seat leak per currency, largest first. */
  entries: Array<[currency: string, amount: number]>;
  /** Number of integrations contributing a leak. */
  integrationCount: number;
  /** Whether any integration is connected at all (drives the empty-state copy). */
  hasActiveIntegration: boolean;
}

/** Sums idle-seat leaks across connected seat-based integrations, grouped by currency. */
export function calculateLeakMetrics(integrations: IntegrationLike[]): LeakMetrics {
  const byCurrency: Record<string, number> = {};
  let integrationCount = 0;
  for (const i of integrations) {
    if (!i.isActive) continue;
    const report = parseAuditReport(i.tokenUsageReport);
    if (isSeatReport(report)) {
      const leak = report.idleSeats * report.seatUnitPrice;
      if (leak > 0) {
        byCurrency[report.currency] = (byCurrency[report.currency] ?? 0) + leak;
        integrationCount++;
      }
    } else if (i.provider !== "ANTHROPIC" && i.wastedAmount && i.wastedAmount > 0) {
      byCurrency.USD = (byCurrency.USD ?? 0) + i.wastedAmount;
      integrationCount++;
    }
  }
  return {
    entries: Object.entries(byCurrency).sort((a, b) => b[1] - a[1]),
    integrationCount,
    hasActiveIntegration: integrations.some((i) => i.isActive),
  };
}
