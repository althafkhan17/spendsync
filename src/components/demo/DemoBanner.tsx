import React from "react";
import Link from "next/link";
import { FlaskConical, ArrowRight } from "lucide-react";

/** Sticky notice shown on every /demo page. Server component. */
export function DemoBanner() {
  return (
    <div
      id="demo-banner"
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div className="text-[13px] leading-relaxed text-amber-900">
          <span className="font-bold">Demo mode: sample data.</span> You are looking at a fictional workspace. Nothing here is
          real, nothing is saved, and editing is turned off.
        </div>
      </div>
      <Link
        href="/sign-up"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#00ed64] px-4 text-[13px] font-semibold text-[#001e2b] shadow-sm transition-colors hover:bg-[#00b545]"
      >
        Create your own workspace <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
