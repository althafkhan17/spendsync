"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Route-group error boundary for every dashboard page.
 * Next.js renders this instead of the page when a server component throws
 * (for example when the database is unreachable).
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("❌ Dashboard render failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-hairline bg-white p-8 text-center shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-ink">Something went wrong loading this page</h3>
      <p className="mt-1 max-w-md text-sm text-ink-subtle">
        We could not load your workspace data. This is usually a temporary database or network hiccup.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-tertiary">ref {error.digest}</p>}
      <button
        onClick={reset}
        className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#00ed64] px-5 text-[13px] font-semibold text-[#001e2b] shadow-sm transition-all hover:bg-[#00b545] active:scale-[0.98]"
      >
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
