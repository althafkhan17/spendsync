import type { Metadata } from "next";
import React from "react";
import { SubscriptionTable } from "@/components/dashboard/SubscriptionTable";
import { DisabledAction } from "@/components/demo/DisabledAction";
import { getDemoSubscriptions } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Subscriptions" };
export const dynamic = "force-dynamic";

export default function DemoSubscriptionsPage() {
  const subscriptions = getDemoSubscriptions();
  const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
  const cancelledCount = subscriptions.filter((s) => s.status === "CANCELLED").length;
  const needsReviewCount = subscriptions.filter((s) => s.status === "NEEDS_REVIEW").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Subscriptions</h1>
          <p className="mt-1.5 text-[15px] text-ink-subtle">Manage and track all your SaaS subscriptions in one place.</p>
        </div>
        <DisabledAction label="Add Subscription" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#5c6c7a]">
        <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#00a35c]" />
          <span>Active:</span>
          <span className="font-semibold text-ink">{activeCount}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span>Cancelled:</span>
          <span className="font-semibold text-ink">{cancelledCount}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>Needs Review:</span>
          <span className="font-semibold text-ink">{needsReviewCount}</span>
        </div>
      </div>

      {/* Row actions (edit, cancel, delete) are server actions, so the demo renders the read-only table. */}
      <SubscriptionTable subscriptions={subscriptions} showActions={false} />
    </div>
  );
}
