import React from "react";
import type { EmailLogRow } from "@/app/actions/emails";

function StatCard({ label, value, tone, children }: { label: string; value: number; tone: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[#e1e5e8] bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3 border border-hairline ${tone}`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {children}
          </svg>
        </div>
        <div>
          <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider block">{label}</span>
          <span className="text-2xl font-extrabold text-ink tabular-nums">{value}</span>
        </div>
      </div>
    </div>
  );
}

/** The three counters above the email log. Server component. */
export function InvoiceStats({ logs }: { logs: EmailLogRow[] }) {
  const totalCount = logs.length;
  const receiptsCount = logs.filter((log) => log.wasReceipt).length;
  const pdfCount = logs.filter((log) => log.source === "PDF").length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Inbound Volume" value={totalCount} tone="text-[#00684a]">
        <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" />
        <polyline points="22 7 12 13 2 7" />
        <circle cx="18" cy="18" r="3" />
        <path d="m21 21-2.1-2.1" />
      </StatCard>
      <StatCard label="Receipts Extracted" value={receiptsCount} tone="text-semantic-success">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </StatCard>
      <StatCard label="PDFs Parsed" value={pdfCount} tone="text-[#00684a]">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </StatCard>
    </div>
  );
}
