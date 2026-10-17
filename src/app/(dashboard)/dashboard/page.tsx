import type { Metadata } from "next";
import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Flame, CreditCard, CalendarClock, ShieldAlert } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SubscriptionTable } from "@/components/dashboard/SubscriptionTable";
import { AddSubscriptionModal } from "@/components/dashboard/AddSubscriptionModal";
import { RenewalRadar } from "@/components/dashboard/RenewalRadar";
import { LeakWatch } from "@/components/dashboard/LeakWatch";
import { getSubscriptions } from "@/app/actions/subscriptions";
import { getIntegrations } from "@/app/actions/integrations";
import { calculateDashboardMetrics } from "@/lib/analytics";
import { parseAuditReport, isSeatReport } from "@/lib/audit-report";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard", description: "Overview of your SaaS spend, renewals and detected seat leaks." };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName || "there";

  const [subscriptions, integrations] = await Promise.all([getSubscriptions(), getIntegrations()]);
  const metrics = calculateDashboardMetrics(subscriptions);

  // Seat leaks across connected integrations, grouped by currency.
  const leakByCurrency: Record<string, number> = {};
  let leakIntegrations = 0;
  for (const i of integrations) {
    if (!i.isActive) continue;
    const report = parseAuditReport(i.tokenUsageReport);
    if (isSeatReport(report)) {
      const leak = report.idleSeats * report.seatUnitPrice;
      if (leak > 0) {
        leakByCurrency[report.currency] = (leakByCurrency[report.currency] ?? 0) + leak;
        leakIntegrations++;
      }
    } else if (i.provider !== "ANTHROPIC" && i.wastedAmount && i.wastedAmount > 0) {
      leakByCurrency.USD = (leakByCurrency.USD ?? 0) + i.wastedAmount;
      leakIntegrations++;
    }
  }
  const leakEntries = Object.entries(leakByCurrency).sort((a, b) => b[1] - a[1]);
  const leakValue = leakEntries.length ? formatMoney(leakEntries[0][1], leakEntries[0][0]) : formatMoney(0, metrics.primaryCurrency);
  const leakSubtitle =
    leakEntries.length === 0
      ? integrations.some((i) => i.isActive)
        ? "No idle seats detected"
        : "Connect an integration to detect leaks"
      : leakEntries.length > 1
        ? `+ ${leakEntries.slice(1).map(([c, v]) => formatMoney(v, c)).join(", ")} · ${leakIntegrations} integration${leakIntegrations === 1 ? "" : "s"}`
        : `Idle seats across ${leakIntegrations} integration${leakIntegrations === 1 ? "" : "s"}`;

  const otherBurn = Object.entries(metrics.burnByCurrency).filter(([c]) => c !== metrics.primaryCurrency);
  const burnSubtitle =
    otherBurn.length > 0
      ? `+ ${otherBurn.map(([c, v]) => formatMoney(v, c)).join(", ")} in other currencies`
      : "Across all active plans";

  return (
    <>
      <div id="dashboard-header" className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Welcome back, <span className="text-ink">{firstName}</span>
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-subtle">Here&apos;s an overview of your SaaS spend this month.</p>
        </div>
        <AddSubscriptionModal />
      </div>

      <div id="kpi-metrics" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          id="metric-monthly-burn"
          title="Total Monthly Burn"
          value={formatMoney(metrics.totalMonthlyBurn, metrics.primaryCurrency)}
          subtitle={burnSubtitle}
          icon={Flame}
        />
        <MetricCard
          id="metric-active-subscriptions"
          title="Active Subscriptions"
          value={String(metrics.activeCount)}
          subtitle={
            metrics.activeCount === 0
              ? "Add your first subscription"
              : metrics.needsReviewCount > 0
                ? `${metrics.needsReviewCount} need${metrics.needsReviewCount === 1 ? "s" : ""} review`
                : `${metrics.activeCount} tracked service${metrics.activeCount !== 1 ? "s" : ""}`
          }
          icon={CreditCard}
        />
        <MetricCard
          id="metric-upcoming-renewals"
          title="Upcoming Renewals"
          value={String(metrics.upcomingRenewalsCount)}
          subtitle="Within the next 30 days"
          icon={CalendarClock}
        />
        <MetricCard id="metric-detected-leaks" title="Detected Leaks" value={leakValue} subtitle={leakSubtitle} icon={ShieldAlert} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <RenewalRadar subscriptions={subscriptions} />
        <LeakWatch integrations={integrations} />
      </div>

      <SubscriptionTable subscriptions={subscriptions} />
    </>
  );
}
