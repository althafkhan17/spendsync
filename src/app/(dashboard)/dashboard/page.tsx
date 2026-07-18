import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Flame, CreditCard, CalendarClock } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SubscriptionTable } from "@/components/dashboard/SubscriptionTable";
import { AddSubscriptionModal } from "@/components/dashboard/AddSubscriptionModal";
import { getSubscriptions } from "@/app/actions/subscriptions";
import { calculateDashboardMetrics } from "@/lib/analytics";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  try {
    const user = await currentUser();
    const firstName = user?.firstName || "there";

    // Fetch real data from the database
    const subscriptions = await getSubscriptions();

    // Compute metrics from the active subscriptions list
    const metrics = calculateDashboardMetrics(subscriptions);

    return (
      <>
        {/* Header */}
        <div id="dashboard-header" className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Welcome back,{" "}
              <span className="text-ink">{firstName}</span>
            </h1>
            <p className="mt-1.5 text-[15px] text-ink-subtle">
              Here&apos;s an overview of your SaaS spend this month.
            </p>
          </div>
          <AddSubscriptionModal />
        </div>

        {/* KPI Metrics — driven by real data */}
        <div
          id="kpi-metrics"
          className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <MetricCard
            id="metric-monthly-burn"
            title="Total Monthly Burn"
            value={currencyFormatter.format(metrics.totalMonthlyBurn)}
            subtitle="Across all active plans"
            icon={Flame}
            accentColor="from-orange-500 to-rose-500"
          />
          <MetricCard
            id="metric-active-subscriptions"
            title="Active Subscriptions"
            value={String(metrics.activeCount)}
            subtitle={
              metrics.activeCount === 0
                ? "Add your first subscription"
                : `${metrics.activeCount} tracked service${metrics.activeCount !== 1 ? "s" : ""}`
            }
            icon={CreditCard}
            accentColor="from-violet-600 to-indigo-600"
          />
          <MetricCard
            id="metric-upcoming-renewals"
            title="Upcoming Renewals"
            value={String(metrics.upcomingRenewalsCount)}
            subtitle="Within the next 30 days"
            icon={CalendarClock}
            accentColor="from-sky-500 to-cyan-500"
          />
        </div>

        {/* Subscriptions Table — real data */}
        <SubscriptionTable subscriptions={subscriptions} />
      </>
    );
  } catch (error) {
    // Rethrow internal Next.js dynamic server rendering errors so Next.js can handle them
    if (
      error instanceof Error &&
      (error.message.includes("Dynamic server usage") ||
        (error as any).digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw error;
    }

    console.error("❌ Failed to load dashboard data:", error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 mb-4 font-bold">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Unable to load dashboard data
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          There was an error communicating with the database. Please try reloading the page.
        </p>
      </div>
    );
  }
}
