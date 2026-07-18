import React from "react";
import { EmailLogTable } from "@/components/dashboard/EmailLogTable";
import { getEmailLogs } from "@/app/actions/emails";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  try {
    const logs = await getEmailLogs();

    // Compute stats
    const totalCount = logs.length;
    const receiptsCount = logs.filter((log) => log.wasReceipt).length;
    const pdfCount = logs.filter((log) => log.source === "PDF").length;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Invoices &amp; Email Log
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-subtle">
            Audit trail of all processed inbound emails, receipts, and invoices.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-lg border border-[#e1e5e8] bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3 border border-hairline text-[#00684a]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" />
                  <polyline points="22 7 12 13 2 7" />
                  <circle cx="18" cy="18" r="3" />
                  <path d="m21 21-2.1-2.1" />
                </svg>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider block">Inbound Volume</span>
                <span className="text-2xl font-extrabold text-ink tabular-nums">{totalCount}</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[#e1e5e8] bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3 border border-hairline text-semantic-success">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider block">Receipts Extracted</span>
                <span className="text-2xl font-extrabold text-ink tabular-nums">{receiptsCount}</span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-[#e1e5e8] bg-white p-5 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-3 border border-hairline text-[#00684a]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-ink-subtle uppercase tracking-wider block">PDFs Parsed</span>
                <span className="text-2xl font-extrabold text-[#001e2b] tabular-nums">{pdfCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Email Log Table */}
        <EmailLogTable logs={logs} />
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

    console.error("❌ Failed to load invoices page data:", error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 mb-4 font-bold">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Unable to load invoices
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          There was an error communicating with the database. Please try reloading the page.
        </p>
      </div>
    );
  }
}
