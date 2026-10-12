"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X, Users, UserCheck, UserX, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeatAuditReport, SeatRecord } from "@/lib/audit-report";
import { DataSourceNote } from "@/components/dashboard/DataSourceBadge";
import { formatMoney, formatDate, relativeTime, initials } from "@/lib/format";

const STATUS_ORDER: Record<SeatRecord["status"], number> = {
  NEVER_ACTIVE: 0,
  IDLE: 1,
  PENDING_CANCELLATION: 2,
  ACTIVE: 3,
};

function statusMeta(seat: SeatRecord, idleThresholdDays: number) {
  switch (seat.status) {
    case "ACTIVE":
      return { label: "Active", pill: "bg-[#e3fcef] text-[#00684a] border-[#00ed64]/30", dot: "bg-[#00a35c]" };
    case "IDLE":
      return { label: `Idle ${idleThresholdDays}d+`, pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };
    case "NEVER_ACTIVE":
      return { label: "Never used", pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" };
    case "PENDING_CANCELLATION":
      return { label: "Cancelling", pill: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
  }
}

function prettySetting(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.replace(/_/g, " ");
}

export function SeatAuditModal({
  open,
  onClose,
  report,
  providerName,
  icon,
  iconBg,
}: {
  open: boolean;
  onClose: () => void;
  report: SeatAuditReport;
  providerName: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  if (!open || typeof document === "undefined") return null;

  const seats = [...report.seats].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const idleWaste = report.idleSeats * report.seatUnitPrice;
  const chips: Array<[string, string]> = [];
  if (report.planType) chips.push(["Plan", prettySetting(report.planType)]);
  if (report.settings.seatManagement) chips.push(["Seat assignment", prettySetting(report.settings.seatManagement)]);
  if (report.settings.publicCodeSuggestions) chips.push(["Public code filter", prettySetting(report.settings.publicCodeSuggestions)]);
  if (report.settings.verifiedAccount) chips.push(["Verified account", report.settings.verifiedAccount]);
  chips.push([
    "Billed seats source",
    report.billedSeatsSource === "INVOICE" ? "latest invoice" : report.billedSeatsSource === "VENDOR_API" ? "vendor API" : "default estimate",
  ]);

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
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm", iconBg)}>{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-ink">{providerName} seat audit</h3>
            <p className="text-xs font-medium text-ink-subtle">
              Audited {relativeTime(report.generatedAt)} · idle threshold {report.idleThresholdDays} days
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1.5">
          <DataSourceNote dataSource={report.dataSource} reason={report.simulationReason} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Users} label="Billed seats" value={String(report.billedSeats)} />
            <Stat icon={UserCheck} label="Active" value={String(report.activeSeats)} tone="good" />
            <Stat icon={UserX} label="Idle" value={String(report.idleSeats)} tone={report.idleSeats > 0 ? "bad" : "neutral"} />
            <Stat
              icon={TrendingDown}
              label="Monthly leak"
              value={formatMoney(idleWaste, report.currency)}
              tone={idleWaste > 0 ? "bad" : "neutral"}
              hint={`${formatMoney(report.seatUnitPrice, report.currency)} / seat`}
            />
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-3 px-2.5 py-1 text-[11px] text-ink-muted">
                  <span className="font-semibold text-ink-subtle">{k}:</span>
                  <span className="font-medium capitalize text-ink">{v}</span>
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">Seat holders</h4>
              <span className="text-[11px] text-ink-tertiary">{seats.length} shown</span>
            </div>
            {seats.length === 0 ? (
              <p className="rounded-lg border border-hairline bg-surface-3 p-4 text-center text-xs text-ink-subtle">
                No seat records were returned for this audit.
              </p>
            ) : (
              seats.map((seat) => {
                const meta = statusMeta(seat, report.idleThresholdDays);
                const wasting = seat.status === "IDLE" || seat.status === "NEVER_ACTIVE";
                return (
                  <div
                    key={seat.username}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                      wasting ? "border-rose-100 bg-rose-50/40" : "border-hairline bg-white hover:bg-surface-3/60"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold",
                          wasting ? "border-rose-100 bg-rose-50 text-rose-600" : "border-hairline bg-surface-3 text-ink"
                        )}
                      >
                        {initials(seat.username)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-ink">{seat.username}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.pill)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-ink-subtle">
                          {seat.lastActivityAt ? (
                            <>
                              Last active {relativeTime(seat.lastActivityAt)}
                              <span className="text-ink-tertiary"> · {formatDate(seat.lastActivityAt)}</span>
                              {seat.lastActivityEditor && <span className="text-ink-tertiary"> · {seat.lastActivityEditor}</span>}
                            </>
                          ) : (
                            <>No activity recorded{seat.createdAt ? ` since seat was assigned ${formatDate(seat.createdAt)}` : ""}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-tertiary">
                        {wasting ? "Leak" : "Seat cost"}
                      </div>
                      <div className={cn("text-[13px] font-bold tabular-nums", wasting ? "text-rose-600" : "text-ink")}>
                        {formatMoney(report.seatUnitPrice, report.currency)}
                        <span className="text-[10px] font-normal text-ink-tertiary">/mo</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-3/60 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-subtle">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={cn(
          "text-lg font-extrabold tabular-nums leading-tight",
          tone === "good" ? "text-[#00684a]" : tone === "bad" ? "text-rose-600" : "text-ink"
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[10px] text-ink-tertiary">{hint}</div>}
    </div>
  );
}
