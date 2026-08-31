"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  Shield,
  Sparkles,
  TrendingDown,
  Clock,
  Bot,
  CircleDot,
  ListChecks,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { runInvestigationForSubscription } from "@/app/actions/investigation";
import { HumanApprovalPanel } from "@/components/dashboard/HumanApprovalPanel";
import type { InvestigationResult, AgentActionTrace, VerificationIssue } from "@/lib/agents/types";

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let color: string;
  let label: string;

  if (pct >= 80) {
    color = "bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/30";
    label = "High Confidence";
  } else if (pct >= 50) {
    color = "bg-amber-50 text-amber-700 border-amber-200";
    label = "Medium Confidence";
  } else {
    color = "bg-red-50 text-red-600 border-red-200";
    label = "Low Confidence";
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", color)}>
      <span className="tabular-nums">{pct}%</span>
      <span className="hidden sm:inline">— {label}</span>
    </span>
  );
}

function SeverityBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  const styles = {
    HIGH: "bg-red-50 text-red-600 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-600 border-amber-200",
    LOW: "bg-sky-50 text-sky-600 border-sky-200",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider", styles[severity])}>
      {severity}
    </span>
  );
}

function StatusIndicator({ status }: { status: AgentActionTrace["status"] }) {
  const map = {
    SUCCESS: { icon: CheckCircle2, color: "text-[#00a35c]", label: "Success" },
    WARNING: { icon: AlertTriangle, color: "text-amber-500", label: "Warning" },
    BLOCKED: { icon: XCircle, color: "text-red-500", label: "Blocked" },
    ERROR: { icon: XCircle, color: "text-red-500", label: "Error" },
  };
  const { icon: Icon, color, label } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────
// Collapsible Trace Step
// ─────────────────────────────────────────────────────────

function TraceStep({
  trace,
  stepNumber,
  icon: Icon,
  accentColor,
  defaultOpen = false,
}: {
  trace: AgentActionTrace;
  stepNumber: number;
  icon: React.ElementType;
  accentColor: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="group rounded-lg border border-hairline bg-white transition-all hover:shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {/* Step Number Chip */}
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", accentColor)}>
          {stepNumber}
        </div>

        {/* Agent Icon & Name */}
        <Icon className="h-4 w-4 shrink-0 text-ink-subtle" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{trace.agentName}</span>
            <span className="text-[11px] text-ink-tertiary">— {trace.stepName}</span>
          </div>
        </div>

        {/* Duration & Status */}
        <span className="shrink-0 text-[11px] tabular-nums text-ink-tertiary">{trace.durationMs}ms</span>
        <StatusIndicator status={trace.status} />

        {/* Chevron */}
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-subtle" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
        )}
      </button>

      {open && (
        <div className="border-t border-hairline/60 px-4 py-3 space-y-2">
          <div className="text-xs text-ink-subtle">
            <span className="font-semibold text-ink-muted">Input:</span>{" "}
            {trace.inputSummary}
          </div>
          <div className="text-xs text-ink leading-relaxed whitespace-pre-wrap bg-surface-3/50 rounded-md p-3 border border-hairline/50">
            {trace.findings}
          </div>
          <div className="text-[10px] text-ink-tertiary tabular-nums">
            {new Date(trace.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Issue Card
// ─────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: VerificationIssue }) {
  const typeIcons: Record<string, React.ElementType> = {
    MATH_MISMATCH: TrendingDown,
    PROTECTED_ACCOUNT: Shield,
    CONTRACT_MINIMUM_VIOLATION: AlertTriangle,
    AMBIGUOUS_ACTIVITY: Clock,
  };
  const TypeIcon = typeIcons[issue.type] || AlertTriangle;

  const typeLabels: Record<string, string> = {
    MATH_MISMATCH: "Math Integrity",
    PROTECTED_ACCOUNT: "Protected Account",
    CONTRACT_MINIMUM_VIOLATION: "Contract Bound",
    AMBIGUOUS_ACTIVITY: "Borderline Activity",
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border border-hairline bg-white p-3 transition-all hover:shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 border border-hairline">
        <TypeIcon className="h-4 w-4 text-ink-subtle" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-ink">{typeLabels[issue.type] ?? issue.type}</span>
          <SeverityBadge severity={issue.severity} />
        </div>
        <p className="text-xs text-ink-muted leading-relaxed">{issue.description}</p>
        <p className="text-[11px] text-ink-tertiary">
          Affected: <code className="rounded bg-surface-3 px-1 py-0.5 text-[10px] font-mono">{issue.affectedItem}</code>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────

function InvestigationSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-white p-4">
            <div className="h-3 w-16 rounded bg-surface-3 mb-2" />
            <div className="h-6 w-20 rounded bg-surface-3" />
          </div>
        ))}
      </div>

      {/* Agent steps skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-hairline bg-white px-4 py-3">
            <div className="h-7 w-7 rounded-full bg-surface-3" />
            <div className="h-4 w-4 rounded bg-surface-3" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-32 rounded bg-surface-3" />
              <div className="h-2 w-48 rounded bg-surface-3" />
            </div>
            <div className="h-3 w-10 rounded bg-surface-3" />
          </div>
        ))}
      </div>

      {/* Running indicator */}
      <div className="flex items-center justify-center gap-2 py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
        <span className="text-sm font-medium text-ink-subtle">Running multi-agent pipeline…</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

interface AgentInvestigationTraceProps {
  subscriptionId: string;
  merchantName: string;
  onClose?: () => void;
}

export function AgentInvestigationTrace({
  subscriptionId,
  merchantName,
  onClose,
}: AgentInvestigationTraceProps) {
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasRun, setHasRun] = useState(false);

  function handleRun() {
    setError(null);
    setResult(null);
    setHasRun(true);

    startTransition(async () => {
      try {
        const data = await runInvestigationForSubscription(subscriptionId);
        setResult(data);
      } catch (err: any) {
        setError(err.message ?? "An unknown error occurred.");
      }
    });
  }

  // ── Pre-run state ──
  if (!hasRun) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001e2b] text-[#00ed64] mb-4 shadow-lg shadow-[#001e2b]/20">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-ink mb-1">
            Multi-Agent Investigation
          </h3>
          <p className="text-sm text-ink-subtle max-w-xs mb-5">
            Launch a 3-stage AI pipeline to analyze <strong>{merchantName}</strong> for
            dormant seats, contract violations, and optimization opportunities.
          </p>
          <Button
            onClick={handleRun}
            className="gap-2 bg-[#001e2b] text-white hover:bg-[#003d4f] h-9 px-4 rounded-full text-sm font-semibold shadow-md shadow-[#001e2b]/15 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            Run Investigation
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (isPending) {
    return <InvestigationSkeleton />;
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center text-center py-8 space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500">
          <XCircle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-ink">Investigation Failed</h3>
        <p className="text-sm text-ink-subtle max-w-xs">{error}</p>
        <Button
          onClick={handleRun}
          variant="outline"
          className="gap-2 h-8 rounded-full text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── No result (shouldn't happen, but safety net) ──
  if (!result) return null;

  const { verifiedRecommendations, verificationIssues, actionPlan, fullTrace } = result;
  const highCount = verificationIssues.filter((i) => i.severity === "HIGH").length;
  const medCount = verificationIssues.filter((i) => i.severity === "MEDIUM").length;

  // ── Results ──
  return (
    <div className="space-y-5">
      {/* ─── Header KPI Summary ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Confidence Score */}
        <div className="rounded-lg border border-hairline bg-white p-3.5 space-y-1.5">
          <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">
            Confidence
          </span>
          <ConfidenceBadge score={verifiedRecommendations.confidenceScore} />
        </div>

        {/* Verified Cuts */}
        <div className="rounded-lg border border-hairline bg-white p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">
            Seats to Review
          </span>
          <span className="text-xl font-extrabold text-ink tabular-nums">
            {verifiedRecommendations.seatsToReview}
          </span>
        </div>

        {/* Verified Savings */}
        <div className="rounded-lg border border-hairline bg-white p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">
            Potential Savings
          </span>
          <span className="text-xl font-extrabold text-[#00684a] tabular-nums">
            ${verifiedRecommendations.potentialMonthlySavings.toFixed(2)}
            <span className="text-xs font-medium text-ink-subtle">/mo</span>
          </span>
        </div>

        {/* Issues */}
        <div className="rounded-lg border border-hairline bg-white p-3.5 space-y-1">
          <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider block">
            Issues Found
          </span>
          <span className="text-xl font-extrabold tabular-nums text-ink">
            {verificationIssues.length}
          </span>
          {highCount > 0 && (
            <span className="text-[10px] text-red-500 font-semibold block">{highCount} high severity</span>
          )}
        </div>
      </div>

      {/* ─── Observable Step-by-Step Trajectory ─── */}
      <Card className="border border-hairline bg-surface-3/30 shadow-sm rounded-lg">
        <CardHeader className="border-b border-hairline px-4 py-3">
          <CardTitle className="text-sm font-semibold text-ink flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-[#00a35c]" />
            Agent Execution Trace
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {fullTrace.map((trace, idx) => {
            // Map agent names to icons and colors
            const agentConfig: Record<string, { icon: React.ElementType; color: string }> = {
              InvoiceAgent: { icon: FileText, color: "bg-[#001e2b]" },
              TelemetryAgent: { icon: Users, color: "bg-[#00684a]" },
              VerifierAgent: { icon: ShieldCheck, color: "bg-[#003d4f]" },
              Orchestrator: { icon: Sparkles, color: "bg-[#00a35c]" },
            };
            const cfg = agentConfig[trace.agentName] ?? { icon: Bot, color: "bg-slate-600" };

            return (
              <TraceStep
                key={idx}
                trace={trace}
                stepNumber={idx + 1}
                icon={cfg.icon}
                accentColor={cfg.color}
                defaultOpen={idx < 3}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Verification Issues ─── */}
      {verificationIssues.length > 0 && (
        <Card className="border border-hairline bg-white shadow-sm rounded-lg">
          <CardHeader className="border-b border-hairline px-4 py-3">
            <CardTitle className="text-sm font-semibold text-ink flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Verification Issues
              <Badge
                variant="outline"
                className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold border-hairline"
              >
                {verificationIssues.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {verificationIssues.map((issue, idx) => (
              <IssueCard key={idx} issue={issue} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ─── Action Plan Checklist ─── */}
      {actionPlan.length > 0 && (
        <Card className="border border-hairline bg-white shadow-sm rounded-lg">
          <CardHeader className="border-b border-hairline px-4 py-3">
            <CardTitle className="text-sm font-semibold text-ink flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[#00684a]" />
              Recommended Action Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {actionPlan.map((step, idx) => {
              const isWarning = step.startsWith("⚠️");
              const isBullet = step.startsWith("  •");

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2.5 text-sm leading-relaxed",
                    isBullet ? "ml-5" : "",
                    isWarning ? "text-amber-700" : "text-ink-muted"
                  )}
                >
                  {!isBullet && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 border border-hairline text-[10px] font-bold text-ink-subtle mt-0.5">
                      {idx + 1}
                    </span>
                  )}
                  {isBullet && (
                    <span className="shrink-0 text-ink-tertiary mt-0.5">•</span>
                  )}
                  <span className={cn(isBullet ? "text-xs text-ink-muted font-mono" : "")}>
                    {isBullet ? step.trim().replace(/^•\s*/, "") : step}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ─── Human-in-the-Loop Governance & Sandbox Simulation ─── */}
      <HumanApprovalPanel
        subscriptionId={subscriptionId}
        merchantName={merchantName}
        candidateUsers={result.candidateUsers ?? []}
        unitPrice={result.unitPrice ?? 0}
        currency={result.currency ?? "USD"}
        onDismiss={onClose}
      />

      {/* ─── Re-run Button ─── */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-ink-tertiary">
          Pipeline executed at {new Date(fullTrace[fullTrace.length - 1]?.timestamp ?? "").toLocaleString()}
        </span>
        <Button
          onClick={handleRun}
          variant="outline"
          className="gap-1.5 h-7 rounded-full text-[11px] font-semibold"
        >
          <Sparkles className="h-3 w-3" />
          Re-run
        </Button>
      </div>
    </div>
  );
}
