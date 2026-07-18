import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import { SubscriptionActions } from "./SubscriptionActions";
import type { SubscriptionRow } from "@/app/actions/subscriptions";

type StatusKey = "ACTIVE" | "CANCELLED" | "NEEDS_REVIEW";

function getStatusStyles(status: StatusKey) {
  switch (status) {
    case "ACTIVE":
      return "bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/20";
    case "CANCELLED":
      return "bg-slate-100 text-slate-500 border-slate-200";
    case "NEEDS_REVIEW":
      return "bg-amber-50 text-amber-600 border-amber-200";
  }
}

function getStatusDot(status: StatusKey) {
  switch (status) {
    case "ACTIVE":
      return "bg-[#00a35c]";
    case "CANCELLED":
      return "bg-slate-400";
    case "NEEDS_REVIEW":
      return "bg-amber-500";
  }
}

function getStatusLabel(status: StatusKey) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "CANCELLED":
      return "Cancelled";
    case "NEEDS_REVIEW":
      return "Needs Review";
  }
}

function getCycleLabel(cycle: "MONTHLY" | "ANNUAL") {
  return cycle === "MONTHLY" ? "Monthly" : "Annual";
}

/** First letter of merchant name for the logo fallback */
function getMerchantInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode || "USD",
    }).format(amount);
  } catch (error) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }
}

interface SubscriptionTableProps {
  subscriptions: SubscriptionRow[];
  showActions?: boolean;
}

export function SubscriptionTable({ subscriptions, showActions = false }: SubscriptionTableProps) {
  if (subscriptions.length === 0) {
    return (
      <Card
        id="subscriptions-table"
        className="border border-hairline bg-white shadow-sm rounded-lg"
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 border border-hairline mb-4">
            <Inbox className="h-6 w-6 text-ink-subtle" />
          </div>
          <p className="text-sm font-medium text-ink">
            No subscriptions yet
          </p>
          <p className="mt-1 text-sm text-ink-tertiary">
            Click &quot;Add Subscription&quot; above to start tracking your SaaS
            spend.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      id="subscriptions-table"
      className="border border-hairline bg-white shadow-sm rounded-lg"
    >
      <CardHeader className="border-b border-hairline px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-ink">
            Recent Activity &amp; Subscriptions
          </CardTitle>
          <span className="text-xs font-medium text-ink-subtle">
            {subscriptions.length} service{subscriptions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-hairline hover:bg-transparent">
              <TableHead className="h-11 pl-6 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Merchant
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Amount
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Cycle
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Status
              </TableHead>
              <TableHead className={cn("h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase", showActions ? "" : "pr-6 text-right")}>
                Next Renewal
              </TableHead>
              {showActions && (
                <TableHead className="h-11 pr-6 text-right text-xs font-medium tracking-wide text-ink-subtle uppercase">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub, index) => (
              <TableRow
                key={sub.id}
                id={`row-${sub.id}`}
                className={cn(
                  "group border-b border-hairline/60 transition-colors hover:bg-slate-50/60",
                  index === subscriptions.length - 1 && "border-b-0"
                )}
              >
                <TableCell className="py-4 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 border border-hairline text-sm font-medium text-ink transition-colors group-hover:bg-slate-100">
                      {getMerchantInitial(sub.merchantName)}
                    </div>
                    <span className="text-sm font-medium text-ink">
                      {sub.merchantName}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {formatCurrency(Number(sub.amount), sub.currency)}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <span className="text-sm text-ink-muted">
                    {getCycleLabel(sub.billingCycle)}
                  </span>
                </TableCell>
                <TableCell className="py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
                      getStatusStyles(sub.status)
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        getStatusDot(sub.status)
                      )}
                    />
                    {getStatusLabel(sub.status)}
                  </Badge>
                </TableCell>
                <TableCell className={cn("py-4", showActions ? "" : "pr-6 text-right")}>
                  <span className="text-sm tabular-nums text-ink-muted">
                    {sub.status === "CANCELLED"
                      ? "—"
                      : formatDate(sub.nextRenewalDate)}
                  </span>
                </TableCell>
                {showActions && (
                  <TableCell className="py-4 pr-6 text-right">
                    <div className="flex justify-end">
                      <SubscriptionActions subscription={sub} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
