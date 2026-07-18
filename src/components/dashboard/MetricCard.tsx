import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accentColor?: string;
}

export function MetricCard({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = "from-slate-900 to-slate-700",
}: MetricCardProps) {
  return (
    <Card
      id={id}
      className="group relative overflow-hidden border border-hairline bg-white shadow-sm transition-all duration-200 hover:shadow-md"
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-eyebrow text-ink-subtle">
              {title}
            </p>
            <div>
              <p className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {value}
              </p>
              {subtitle && (
                <p className="mt-1 text-[13px] text-ink-tertiary">{subtitle}</p>
              )}
            </div>
            {trend && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border",
                    trend.positive
                      ? "bg-[#e3fcef] text-semantic-success border-[#00ed64]/20"
                      : "bg-red-50 text-red-600 border-red-200"
                  )}
                >
                  {trend.positive ? "↑" : "↓"} {trend.value}
                </span>
                <span className="text-xs text-ink-tertiary">vs last month</span>
              </div>
            )}
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 border border-hairline transition-transform duration-200 group-hover:scale-105"
          >
            <Icon className="h-5 w-5 text-[#00684a]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
