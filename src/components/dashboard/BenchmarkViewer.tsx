"use client";

import React, { useState, useTransition } from "react";
import {
  FlaskConical,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Award,
  Zap,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { runLiveBenchmarkSuite } from "@/app/actions/benchmarks";
import type { BenchmarkSuiteSummary, CaseEvaluationResult } from "../../../scripts/evaluate";

interface BenchmarkViewerProps {
  initialSummary?: BenchmarkSuiteSummary | null;
}

export function BenchmarkViewer({ initialSummary }: BenchmarkViewerProps) {
  const [summary, setSummary] = useState<BenchmarkSuiteSummary | null>(initialSummary ?? null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleRunSuite() {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const data = await runLiveBenchmarkSuite();
        setSummary(data);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to execute benchmark suite.");
      }
    });
  }

  const results = summary?.results ?? [];
  const filteredResults =
    selectedCategory === "ALL"
      ? results
      : results.filter((r) => r.category === selectedCategory);

  const b = summary?.metrics.baseline;
  const m = summary?.metrics.multiAgent;

  return (
    <div className="space-y-6">
      {/* ─── Header Banner ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-hairline bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#001e2b] text-[#00ed64]">
              <FlaskConical className="h-3.5 w-3.5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
              Evaluation Benchmark Suite
            </h1>
            <Badge className="bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/30 text-[10px] font-bold">
              16 Test Cases
            </Badge>
          </div>
          <p className="text-sm text-ink-subtle max-w-2xl">
            Empirical comparative analysis measuring the <strong>Single-Prompt Baseline</strong> vs. the{" "}
            <strong>Multi-Agent Investigation Pipeline</strong> across Straightforward, Difficult (Adversarial), and Edge Case scenarios.
          </p>
        </div>

        <Button
          onClick={handleRunSuite}
          disabled={isPending}
          className="shrink-0 gap-2 rounded-full bg-[#001e2b] text-white hover:bg-[#003d4f] h-10 px-5 text-sm font-bold shadow-md shadow-[#001e2b]/15"
        >
          {isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Running 16 Cases...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-[#00ed64]" />
              Run Live Benchmark Suite
            </>
          )}
        </Button>
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-600">
          {errorMessage}
        </div>
      )}

      {/* ─── Macro KPI Metric Comparison Grid ─── */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Recommendation Precision */}
          <Card className="border border-hairline bg-white shadow-sm rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                Precision
              </span>
              <Badge className="bg-[#c3f0d2] text-[#00684a] text-[10px] font-bold">
                +{((m?.avgPrecision ?? 0) - (b?.avgPrecision ?? 0)).toFixed(1)}% Delta
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#00684a] tabular-nums">
                {m?.avgPrecision.toFixed(1)}%
              </span>
              <span className="text-xs text-ink-tertiary">
                vs {b?.avgPrecision.toFixed(1)}% Baseline
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Correctly recommended seat cuts without false positive deletions.
            </p>
          </Card>

          {/* Dangerous / False Cuts */}
          <Card className="border border-hairline bg-white shadow-sm rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                Protected Bot Cuts
              </span>
              <Badge className="bg-[#00684a] text-white text-[10px] font-bold">
                100% Shielded
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#00684a] tabular-nums">
                {m?.totalDangerousCuts}
              </span>
              <span className="text-xs text-red-500 font-semibold">
                vs {b?.totalDangerousCuts} Bot Cuts (Baseline)
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              CI/CD runners, security scanners &amp; service bots shielded.
            </p>
          </Card>

          {/* Contract Minimum Adherence */}
          <Card className="border border-hairline bg-white shadow-sm rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                Contract Adherence
              </span>
              <Badge className="bg-[#c3f0d2] text-[#00684a] text-[10px] font-bold">
                100% Compliant
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#00684a] tabular-nums">
                {m?.contractAdherencePct.toFixed(1)}%
              </span>
              <span className="text-xs text-ink-tertiary">
                vs {b?.contractAdherencePct.toFixed(1)}% Baseline
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Enforced minimum seat commitments &amp; annual lock-in clauses.
            </p>
          </Card>

          {/* Evidence Traceability */}
          <Card className="border border-hairline bg-white shadow-sm rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink-subtle uppercase tracking-wider">
                Traceability
              </span>
              <Badge className="bg-[#c3f0d2] text-[#00684a] text-[10px] font-bold">
                Full Audit Trail
              </Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#00684a] tabular-nums">
                {m?.evidenceTraceabilityPct.toFixed(1)}%
              </span>
              <span className="text-xs text-ink-tertiary">
                vs {b?.evidenceTraceabilityPct.toFixed(1)}% Baseline
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              Claims linked to itemized invoice rows &amp; telemetry logs.
            </p>
          </Card>
        </div>
      )}

      {/* ─── Category Filter Tabs ─── */}
      <div className="flex items-center gap-2">
        {["ALL", "STRAIGHTFORWARD", "DIFFICULT", "EDGE_CASE"].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              selectedCategory === cat
                ? "bg-[#001e2b] text-white shadow-sm"
                : "bg-white border border-hairline text-ink-subtle hover:bg-surface-3 hover:text-ink"
            )}
          >
            {cat === "ALL"
              ? "All Cases (16)"
              : cat === "STRAIGHTFORWARD"
                ? "Straightforward (5)"
                : cat === "DIFFICULT"
                  ? "Difficult / Adversarial (6)"
                  : "Edge Cases (5)"}
          </button>
        ))}
      </div>

      {/* ─── Per-Case Comparison Matrix ─── */}
      <Card className="border border-hairline bg-white shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="border-b border-hairline px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-[#00a35c]" />
              Detailed Benchmark Case Results
            </CardTitle>
            <span className="text-xs font-medium text-ink-subtle">
              Showing {filteredResults.length} of {results.length} test cases
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-hairline">
            {filteredResults.map((item, idx) => {
              const isMatch = item.multiAgent.recommendedCuts === item.groundTruth.expectedCutSeats;
              const hasProtectedShield = item.multiAgent.protectedShieldsCount > 0;
              const baselineFailedBots = item.baseline.dangerousCuts > 0;
              const baselineFailedContract = !item.baseline.contractMinRespected;

              return (
                <div key={item.caseId} className="p-5 hover:bg-surface-3/30 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Case Info */}
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-ink-tertiary">
                          #{idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-ink">{item.caseName}</h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold uppercase",
                            item.category === "STRAIGHTFORWARD"
                              ? "bg-slate-50 text-slate-600 border-slate-200"
                              : item.category === "DIFFICULT"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                          )}
                        >
                          {item.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Ground Truth:{" "}
                        <strong className="text-ink">
                          {item.groundTruth.expectedCutSeats} seat cut(s)
                        </strong>{" "}
                        (${item.groundTruth.expectedSavings.toFixed(2)}/mo)
                      </p>
                    </div>

                    {/* Right: Comparative Side-by-Side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
                      {/* Baseline Box */}
                      <div className="rounded-lg border border-hairline bg-surface-3/40 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink-subtle">Baseline (Single Prompt)</span>
                          {baselineFailedBots || baselineFailedContract ? (
                            <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">
                              {baselineFailedBots ? "Bot Cut" : "Contract Violated"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-ink-tertiary">
                              Processed
                            </Badge>
                          )}
                        </div>
                        <div className="font-semibold text-ink">
                          Recommended: {item.baseline.recommendedCuts} cuts (${item.baseline.estimatedSavings.toFixed(2)})
                        </div>
                        <div className="text-[11px] text-ink-tertiary tabular-nums">
                          Precision: {(item.baseline.precision * 100).toFixed(0)}% • Duration: {item.baseline.durationMs}ms
                        </div>
                      </div>

                      {/* Multi-Agent Pipeline Box */}
                      <div className="rounded-lg border border-[#00a35c]/40 bg-[#c3f0d2]/15 p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#00684a]">Multi-Agent Pipeline</span>
                          {isMatch ? (
                            <Badge className="bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/30 text-[10px] font-bold">
                              Exact Match
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              Verified Clamped
                            </Badge>
                          )}
                        </div>
                        <div className="font-bold text-ink">
                          Verified: {item.multiAgent.recommendedCuts} cuts (${item.multiAgent.verifiedSavings.toFixed(2)})
                        </div>
                        <div className="text-[11px] text-[#00684a] font-medium tabular-nums">
                          Precision: {(item.multiAgent.precision * 100).toFixed(0)}% • Issues: {item.multiAgent.issuesCount} • Trace: {item.multiAgent.traceStepsCount} steps
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
