import React from "react";
import { AddSubscriptionModal } from "@/components/dashboard/AddSubscriptionModal";
import { SubscriptionTable } from "@/components/dashboard/SubscriptionTable";
import { getSubscriptions } from "@/app/actions/subscriptions";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  try {
    const subscriptions = await getSubscriptions();

    // Compute status counts
    const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const cancelledCount = subscriptions.filter((s) => s.status === "CANCELLED").length;
    const needsReviewCount = subscriptions.filter((s) => s.status === "NEEDS_REVIEW").length;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Subscriptions
            </h1>
            <p className="mt-1.5 text-[15px] text-slate-500">
              Manage and track all your SaaS subscriptions in one place.
            </p>
          </div>
          <AddSubscriptionModal />
        </div>

        {/* Mini stats row */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 py-1 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Active:</span>
            <span className="font-semibold text-slate-900">{activeCount}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 py-1 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Cancelled:</span>
            <span className="font-semibold text-slate-900">{cancelledCount}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 py-1 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Needs Review:</span>
            <span className="font-semibold text-slate-900">{needsReviewCount}</span>
          </div>
        </div>

        {/* Subscription Table */}
        <SubscriptionTable subscriptions={subscriptions} showActions={true} />
      </div>
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Dynamic server usage") ||
        (error as any).digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw error;
    }

    console.error("❌ Failed to load subscriptions page data:", error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 mb-4 font-bold">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Unable to load subscriptions
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          There was an error communicating with the database. Please try reloading the page.
        </p>
      </div>
    );
  }
}
