import type { Metadata } from "next";
import React from "react";
import { EmailLogTable } from "@/components/dashboard/EmailLogTable";
import { InvoiceStats } from "@/components/dashboard/InvoiceStats";
import { getDemoEmailLogs } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default function DemoInvoicesPage() {
  const logs = getDemoEmailLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Invoices &amp; Email Log</h1>
        <p className="mt-1.5 text-[15px] text-ink-subtle">
          Audit trail of all processed inbound emails, receipts, and invoices.
        </p>
      </div>

      <InvoiceStats logs={logs} />

      <EmailLogTable logs={logs} />
    </div>
  );
}
