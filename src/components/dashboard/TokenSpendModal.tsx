"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Gauge, Coins, Layers, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TokenSpendReport } from "@/lib/audit-report";
import { DataSourceNote } from "@/components/dashboard/DataSourceBadge";
import { formatMoney, formatTokens, formatDate, relativeTime } from "@/lib/format";
import { prettyModelName } from "@/lib/providers/anthropic";

export function budgetTone(pct: number) {
  if (pct >= 100) return { text: "text-rose-600", bar: "bg-rose-500", soft: "bg-rose-50 border-rose-200 text-rose-700" };
  if (pct >= 75) return { text: "text-amber-600", bar: "bg-amber-500", soft: "bg-amber-50 border-amber-200 text-amber-700" };
  return { text: "text-[#00684a]", bar: "bg-[#00a35c]", soft: "bg-[#e3fcef] border-[#00ed64]/30 text-[#00684a]" };
}

export function TokenSpendModal({
  open,
  onClose,
  report,
  icon,
  iconBg,
}: {
  open: boolean;
  onClose: () => void;
  report: TokenSpendReport;
  icon: React.ReactNode;
  iconBg: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!open || typeof document === "undefined") return null;

  const pct = Math.round((report.totalCostUsd / Math.max(report.thresholdUsd, 0.01)) * 100);
  const tone = budgetTone(pct);
  const totalTokens = report.byModel.reduce(
    (s, m) => s + m.uncachedInputTokens + m.cacheReadTokens + m.cacheCreationTokens + m.outputTokens,
    0
  );
  const cacheReads = report.byModel.reduce((s, m) => s + m.cacheReadTokens, 0);
  const cacheHitPct = totalTokens > 0 ? Math.round((cacheReads / totalTokens) * 100) : 0;
  const maxDay = Math.max(0.01, ...report.daily.map((d) => d.costUsd));
  const hoveredDay = hovered !== null ? report.daily[hovered] : null;
  const dayMs = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.max(1, Math.ceil((new Date(report.period.end).getTime() - new Date(report.period.start).getTime()) / dayMs));
  const daysInMonth = new Date(new Date(report.period.start).getUTCFullYear(), new Date(report.period.start).getUTCMonth() + 1, 0).getDate();
  const projected = (report.totalCostUsd / daysElapsed) * daysInMonth;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white p-6 text-ink shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex shrink-0 items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-sm", iconBg)}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-ink">Anthropic Claude usage</h3>
            <p className="text-xs font-medium text-ink-subtle">
              {formatDate(report.period.start)} to {formatDate(report.period.end)} · synced {relativeTime(report.generatedAt)}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1.5">
          <DataSourceNote dataSource={report.dataSource} reason={report.simulationReason} />

          {/* Budget gauge */}
          <div className="rounded-xl border border-hairline bg-surface-3/60 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-subtle">
                  <Gauge className="h-3 w-3" /> Month-to-date spend
                </div>
                <div className={cn("text-2xl font-extrabold tabular-nums leading-none", tone.text)}>{formatMoney(report.totalCostUsd, "USD")}</div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-ink-subtle">Safety budget</div>
                <div className="text-sm font-bold tabular-nums text-ink">{formatMoney(report.thresholdUsd, "USD")}</div>
                <div className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.soft)}>{pct}% used</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-subtle">
              <span>
                Projected month end: <span className="font-semibold text-ink">{formatMoney(projected, "USD")}</span>
              </span>
              <span>
                Day {daysElapsed} of {daysInMonth}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Coins} label="Tokens processed" value={formatTokens(totalTokens)} />
            <Stat icon={Layers} label="Cache hit rate" value={`${cacheHitPct}%`} hint="share of tokens read from cache" />
            <Stat icon={CalendarRange} label="Models in use" value={String(report.byModel.length)} />
          </div>

          {/* Daily spend bars */}
          {report.daily.length > 0 && (
            <div className="rounded-xl border border-hairline bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Daily spend</h4>
                <span className="text-[11px] tabular-nums text-ink-muted">
                  {hoveredDay ? `${formatDate(hoveredDay.date)} · ${formatMoney(hoveredDay.costUsd, "USD")}` : `peak ${formatMoney(maxDay, "USD")}`}
                </span>
              </div>
              <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Daily Anthropic spend this month">
                {report.daily.map((d, i) => {
                  const h = Math.max(2, (d.costUsd / maxDay) * 100);
                  return (
                    <div
                      key={d.date}
                      className="group relative flex h-full flex-1 items-end"
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      title={`${formatDate(d.date)}: ${formatMoney(d.costUsd, "USD")}`}
                    >
                      <div
                        className={cn(
                          "w-full rounded-t-[4px] transition-colors",
                          hovered === i ? "bg-[#00684a]" : "bg-[#00a35c]/80 group-hover:bg-[#00a35c]"
                        )}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-ink-tertiary">
                <span>{formatDate(report.daily[0].date)}</span>
                <span>{formatDate(report.daily[report.daily.length - 1].date)}</span>
              </div>
            </div>
          )}

          {/* By model table */}
          <div className="overflow-hidden rounded-xl border border-hairline">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-3 text-[10px] uppercase tracking-wider text-ink-subtle">
                <tr>
                  <th className="px-3 py-2 font-bold">Model</th>
                  <th className="px-3 py-2 text-right font-bold">Input</th>
                  <th className="px-3 py-2 text-right font-bold">Cache read</th>
                  <th className="px-3 py-2 text-right font-bold">Output</th>
                  <th className="px-3 py-2 text-right font-bold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline/70">
                {report.byModel.map((m) => {
                  const share = report.totalCostUsd > 0 ? Math.round((m.costUsd / report.totalCostUsd) * 100) : 0;
                  return (
                    <tr key={m.model} className="hover:bg-surface-3/50">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-ink">{prettyModelName(m.model)}</div>
                        <div className="font-mono text-[10px] text-ink-tertiary">{m.model}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatTokens(m.uncachedInputTokens + m.cacheCreationTokens)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatTokens(m.cacheReadTokens)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{formatTokens(m.outputTokens)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="font-bold tabular-nums text-ink">{formatMoney(m.costUsd, "USD")}</div>
                        <div className="text-[10px] text-ink-tertiary">{share}%</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-3/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-lg font-extrabold tabular-nums leading-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}
