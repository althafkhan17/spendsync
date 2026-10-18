import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseAuditReport, isSeatReport, isTokenReport } from "@/lib/audit-report";
import { providerLabel } from "@/lib/providers/labels";
import { formatMoney, relativeTime } from "@/lib/format";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import { MerchantLogo } from "@/components/brand/MerchantLogo";
import type { IntegrationRow } from "@/app/actions/integrations";

/** Compact summary of every connected integration's latest finding. Server component. */
export function LeakWatch({
  integrations,
  integrationsHref = "/dashboard/integrations",
}: {
  integrations: IntegrationRow[];
  integrationsHref?: string;
}) {
  const connected = integrations.filter((i) => i.isActive);

  return (
    <Card id="leak-watch" className="border border-hairline bg-white shadow-sm rounded-lg h-full">
      <CardHeader className="border-b border-hairline px-5 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-ink">
            <ShieldAlert className="h-4 w-4 text-[#00684a]" />
            Leak watch
          </CardTitle>
          <Link href={integrationsHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#00684a] hover:underline">
            Integrations <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {connected.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">No integrations connected</p>
            <p className="mt-1 text-xs text-ink-tertiary">Connect GitHub Copilot, Figma or Anthropic to start finding idle spend.</p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline/70">
            {connected.map((i) => {
              const report = parseAuditReport(i.tokenUsageReport);
              let headline: React.ReactNode;
              let detail: string;
              let tone = "text-ink";
              if (isSeatReport(report)) {
                const leak = report.idleSeats * report.seatUnitPrice;
                headline = formatMoney(leak, report.currency) + "/mo";
                detail = `${report.idleSeats} idle of ${report.billedSeats} billed seats`;
                tone = leak > 0 ? "text-rose-600" : "text-[#00684a]";
              } else if (isTokenReport(report)) {
                const pct = Math.round((report.totalCostUsd / Math.max(report.thresholdUsd, 0.01)) * 100);
                headline = `${formatMoney(report.totalCostUsd, "USD")} MTD`;
                detail = `${pct}% of ${formatMoney(report.thresholdUsd, "USD")} monthly budget`;
                tone = pct >= 100 ? "text-rose-600" : pct >= 75 ? "text-amber-600" : "text-[#00684a]";
              } else if (i.wastedAmount !== null && i.wastedSeats !== null) {
                headline = formatMoney(i.wastedAmount, "USD") + "/mo";
                detail = `${i.wastedSeats} idle seats (older audit format)`;
                tone = i.wastedAmount > 0 ? "text-rose-600" : "text-ink";
              } else {
                headline = "Pending";
                detail = "First audit has not run yet";
                tone = "text-ink-subtle";
              }
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <MerchantLogo name={i.provider} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{providerLabel(i.provider)}</span>
                      {report && <DataSourceBadge dataSource={report.dataSource} reason={report.simulationReason} />}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-ink-subtle">
                      {detail} · audited {relativeTime(i.lastAuditAt)}
                    </div>
                  </div>
                  <div className={`shrink-0 text-right text-[13px] font-bold tabular-nums ${tone}`}>{headline}</div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
