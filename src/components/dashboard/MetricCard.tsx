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
      className="group relative overflow-hidden border-0 bg-white shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 hover:shadow-md hover:ring-slate-300/80"
    >
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <p className="text-[13px] font-medium tracking-wide text-slate-500 uppercase">
              {title}
            </p>
            <div>
              <p className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {value}
              </p>
              {subtitle && (
                <p className="mt-1 text-[13px] text-slate-400">{subtitle}</p>
              )}
            </div>
            {trend && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    trend.positive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  )}
                >
                  {trend.positive ? "↑" : "↓"} {trend.value}
                </span>
                <span className="text-xs text-slate-400">vs last month</span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm transition-transform duration-200 group-hover:scale-105",
              accentColor
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
