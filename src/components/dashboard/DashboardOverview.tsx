import React from "react";
import { Flame, CreditCard, CalendarClock, ShieldAlert } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SubscriptionTable } from "@/components/dashboard/SubscriptionTable";
import { RenewalRadar } from "@/components/dashboard/RenewalRadar";
import { LeakWatch } from "@/components/dashboard/LeakWatch";
import { calculateDashboardMetrics, calculateLeakMetrics } from "@/lib/analytics";
import { formatMoney } from "@/lib/format";
import type { SubscriptionRow } from "@/app/actions/subscriptions";
import type { IntegrationRow } from "@/app/actions/integrations";

interface DashboardOverviewProps {
  firstName: string;
  subscriptions: SubscriptionRow[];
  integrations: IntegrationRow[];
  /** Rendered top-right of the header (e.g. the Add Subscription button). */
  headerAction?: React.ReactNode;
  /** Where the Leak Watch "Integrations" link points. */
  integrationsHref?: string;
}

/**
 * The main dashboard body. Server component shared by the real dashboard and
 * the public demo so both render exactly the same screen from different data.
 */
export function DashboardOverview({
  firstName,
  subscriptions,
  integrations,
  headerAction,
  integrationsHref = "/dashboard/integrations",
}: DashboardOverviewProps) {
  const metrics = calculateDashboardMetrics(subscriptions);
  const leaks = calculateLeakMetrics(integrations);

  const leakValue = leaks.entries.length
    ? formatMoney(leaks.entries[0][1], leaks.entries[0][0])
    : formatMoney(0, metrics.primaryCurrency);
  const plural = leaks.integrationCount === 1 ? "" : "s";
  const leakSubtitle =
    leaks.entries.length === 0
      ? leaks.hasActiveIntegration
        ? "No idle seats detected"
        : "Connect an integration to detect leaks"
      : leaks.entries.length > 1
        ? `+ ${leaks.entries.slice(1).map(([c, v]) => formatMoney(v, c)).join(", ")} · ${leaks.integrationCount} integration${plural}`
        : `Idle seats across ${leaks.integrationCount} integration${plural}`;

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
        {headerAction}
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
        <LeakWatch integrations={integrations} integrationsHref={integrationsHref} />
      </div>

      <SubscriptionTable subscriptions={subscriptions} />
    </>
  );
}
