"use client";

import React from "react";
import { Radio, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataSource } from "@/lib/audit-report";

/**
 * Tells the viewer whether an audit's numbers came from the vendor API or
 * were simulated. Hover (or the optional inline note) explains why.
 */
export function DataSourceBadge({
  dataSource,
  reason,
  className,
  size = "sm",
}: {
  dataSource: DataSource;
  reason?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const live = dataSource === "LIVE";
  return (
    <span
      title={reason ?? (live ? "Figures fetched live from the vendor API." : "Figures are simulated.")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wider whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-[10.5px]",
        live
          ? "bg-[#e3fcef] text-[#00684a] border-[#00ed64]/30"
          : "bg-amber-50 text-amber-700 border-amber-200",
        className
      )}
    >
      {live ? <Radio className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
      {live ? "Live data" : "Simulated"}
    </span>
  );
}

export function DataSourceNote({ dataSource, reason }: { dataSource: DataSource; reason?: string | null }) {
  if (dataSource === "LIVE") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[#00ed64]/25 bg-[#e3fcef] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#00684a]">
        <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Numbers below were fetched live from the vendor API during the last audit.</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold">Simulated telemetry.</span> {reason ?? "The vendor API could not be queried for this audit."}
      </span>
    </div>
  );
}
