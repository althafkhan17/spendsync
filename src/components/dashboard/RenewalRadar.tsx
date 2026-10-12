import React from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { daysUntil, formatDate, formatMoney, initials } from "@/lib/format";
import type { SubscriptionRow } from "@/app/actions/subscriptions";

function urgency(days: number) {
  if (days <= 7) return { pill: "bg-rose-50 text-rose-700 border-rose-200", bar: "bg-rose-500" };
  if (days <= 14) return { pill: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" };
  return { pill: "bg-[#e3fcef] text-[#00684a] border-[#00ed64]/30", bar: "bg-[#00a35c]" };
}

/** Next renewals, soonest first. Server component. */
export function RenewalRadar({ subscriptions, limit = 6 }: { subscriptions: SubscriptionRow[]; limit?: number }) {
  const upcoming = subscriptions
    .filter((s) => s.status === "ACTIVE" && daysUntil(s.nextRenewalDate) >= 0)
    .sort((a, b) => new Date(a.nextRenewalDate).getTime() - new Date(b.nextRenewalDate).getTime())
    .slice(0, limit);

  return (
    <Card id="renewal-radar" className="border border-hairline bg-white shadow-sm rounded-lg h-full">
      <CardHeader className="border-b border-hairline px-5 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <CalendarClock className="h-4 w-4 text-[#00684a]" />
            Renewal radar
          </CardTitle>
          <span className="text-xs font-medium text-ink-subtle">next {upcoming.length}</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {upcoming.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-tertiary">No upcoming renewals.</p>
        ) : (
          <ul className="divide-y divide-hairline/70">
            {upcoming.map((s) => {
              const days = daysUntil(s.nextRenewalDate);
              const tone = urgency(days);
              const pct = Math.max(6, Math.min(100, 100 - (days / 45) * 100));
              return (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-[11px] font-bold text-ink">
                      {initials(s.merchantName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold text-ink">{s.merchantName}</span>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.pill)}>
                          {days === 0 ? "today" : days === 1 ? "tomorrow" : `${days} days`}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-subtle">
                        <span>{formatDate(s.nextRenewalDate)}</span>
                        <span className="font-semibold tabular-nums text-ink-muted">
                          {formatMoney(Number(s.amount), s.currency)}
                          <span className="font-normal text-ink-tertiary">/{s.billingCycle === "ANNUAL" ? "yr" : "mo"}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
