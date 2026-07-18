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
import { Mail } from "lucide-react";
import type { EmailLogRow } from "@/app/actions/emails";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

function parseSender(sender: string) {
  const match = sender.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  // Remove quotes if present
  const cleaned = sender.replace(/^["']|["']$/g, "").trim();
  return { name: cleaned, email: "" };
}

interface EmailLogTableProps {
  logs: EmailLogRow[];
}

export function EmailLogTable({ logs }: EmailLogTableProps) {
  if (logs.length === 0) {
    return (
      <Card
        id="email-log-table"
        className="border border-hairline bg-white shadow-sm rounded-lg"
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 border border-hairline mb-4">
            <Mail className="h-6 w-6 text-ink-subtle" />
          </div>
          <p className="text-sm font-medium text-ink">
            No emails processed yet
          </p>
          <p className="mt-1 text-sm text-ink-tertiary">
            Forwarded receipts will appear here once they&apos;re processed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      id="email-log-table"
      className="border border-hairline bg-white shadow-sm rounded-lg"
    >
      <CardHeader className="border-b border-hairline px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-ink">
            Processed Emails
          </CardTitle>
          <span className="text-xs font-medium text-ink-subtle">
            {logs.length} email{logs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-hairline hover:bg-transparent">
              <TableHead className="h-11 pl-6 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Sender
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Subject
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Source
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Result
              </TableHead>
              <TableHead className="h-11 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Confidence
              </TableHead>
              <TableHead className="h-11 pr-6 text-right text-xs font-medium tracking-wide text-ink-subtle uppercase">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log, index) => {
              const parsed = parseSender(log.senderEmail);
              const score = log.confidenceScore != null ? Math.round(Number(log.confidenceScore) * 100) : null;
              
              return (
                <TableRow
                  key={log.id}
                  className={cn(
                    "group border-b border-hairline/60 transition-colors hover:bg-slate-50/60",
                    index === logs.length - 1 && "border-b-0"
                  )}
                >
                  {/* SENDER */}
                  <TableCell className="py-4 pl-6">
                    <div className="flex flex-col max-w-[200px]">
                      <span className="font-semibold text-ink text-[13px] leading-tight truncate" title={parsed.name}>
                        {parsed.name}
                      </span>
                      {parsed.email && (
                        <span className="text-[11px] text-ink-subtle mt-0.5 truncate font-mono" title={parsed.email}>
                          {parsed.email}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* SUBJECT */}
                  <TableCell className="py-4">
                    <span className="text-ink-muted text-[13px] leading-relaxed block max-w-[250px] truncate" title={log.subject}>
                      {log.subject}
                    </span>
                  </TableCell>

                  {/* SOURCE */}
                  <TableCell className="py-4">
                    <Badge
                      variant="outline"
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide flex items-center w-fit gap-1 bg-slate-100 text-slate-700 border-slate-200"
                    >
                      {log.source === "PDF" ? (
                        <svg className="h-2.5 w-2.5 text-[#00684a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      ) : (
                        <svg className="h-2.5 w-2.5 text-[#00684a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      )}
                      {log.source}
                    </Badge>
                  </TableCell>

                  {/* RESULT */}
                  <TableCell className="py-4">
                    {log.wasReceipt ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[13px] font-bold text-ink leading-tight">
                          {log.merchantName}
                        </span>
                        <span className="text-xs font-semibold text-semantic-success tabular-nums">
                          {log.amount != null ? currencyFormatter.format(Number(log.amount)) : ""}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-ink-tertiary">
                        Not a receipt
                      </span>
                    )}
                  </TableCell>

                  {/* CONFIDENCE */}
                  <TableCell className="py-4">
                    {score !== null ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold flex items-center w-fit gap-1",
                          score >= 90
                            ? "bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/20"
                            : score >= 75
                            ? "bg-slate-100 text-slate-700 border-slate-200"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        )}
                      >
                        {score >= 90 && (
                          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {score}%
                      </Badge>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </TableCell>

                  {/* DATE */}
                  <TableCell className="py-4 pr-6 text-right">
                    <span className="text-[12px] font-medium text-ink-subtle tabular-nums">
                      {formatDate(log.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
