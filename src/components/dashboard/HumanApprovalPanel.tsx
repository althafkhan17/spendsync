"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheck,
  CheckSquare,
  Square,
  FlaskConical,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  Info,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  executeSandboxSimulation,
  approveStagedAction,
  rejectAgentProposal,
  type SandboxSimulationResult,
  type StagedActionResult,
} from "@/app/actions/sandbox";
import type { CandidateUser } from "@/lib/agents/types";

interface HumanApprovalPanelProps {
  subscriptionId: string;
  merchantName: string;
  candidateUsers: CandidateUser[];
  unitPrice: number;
  currency?: string;
  onDismiss?: () => void;
}

export function HumanApprovalPanel({
  subscriptionId,
  merchantName,
  candidateUsers = [],
  unitPrice = 0,
  currency = "USD",
  onDismiss,
}: HumanApprovalPanelProps) {
  // Checklist State — all candidates checked by default
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(candidateUsers.map((u) => u.id))
  );

  // Simulation & Approval Action States
  const [simulationResult, setSimulationResult] = useState<SandboxSimulationResult | null>(null);
  const [approvalResult, setApprovalResult] = useState<StagedActionResult | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reviewer inputs
  const [showConfirmApprove, setShowConfirmApprove] = useState(false);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Transitions
  const [isSimulating, startSimulationTransition] = useTransition();
  const [isApproving, startApprovalTransition] = useTransition();
  const [isRejecting, startRejectionTransition] = useTransition();

  // Dynamic calculations
  const effectiveUnitPrice = unitPrice > 0 ? unitPrice : (candidateUsers[0]?.unitPrice ?? 0);
  const selectedCount = selectedIds.size;
  const dynamicallyCalculatedSavings = Math.round(selectedCount * effectiveUnitPrice * 100) / 100;
  const allSelected = candidateUsers.length > 0 && selectedCount === candidateUsers.length;

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Invalidate stale simulation result when selection changes
    setSimulationResult(null);
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidateUsers.map((u) => u.id)));
    }
    setSimulationResult(null);
  }

  // ── 1. Execute Sandbox Simulation ──
  function handleRunSimulation() {
    setErrorMessage(null);
    startSimulationTransition(async () => {
      try {
        const result = await executeSandboxSimulation(
          subscriptionId,
          Array.from(selectedIds),
          dynamicallyCalculatedSavings
        );
        setSimulationResult(result);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to execute sandbox simulation.");
      }
    });
  }

  // ── 2. Approve Staged Action (HITL) ──
  function handleApproveStaged() {
    setErrorMessage(null);
    startApprovalTransition(async () => {
      try {
        const result = await approveStagedAction(
          subscriptionId,
          Array.from(selectedIds),
          reviewerNotes
        );
        setApprovalResult(result);
        setShowConfirmApprove(false);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to commit approval action.");
      }
    });
  }

  // ── 3. Reject / Dismiss Proposal ──
  function handleRejectProposal() {
    setErrorMessage(null);
    startRejectionTransition(async () => {
      try {
        const result = await rejectAgentProposal(subscriptionId, rejectReason);
        setRejectionMessage(result.message);
        setShowRejectInput(false);
        if (onDismiss) {
          setTimeout(onDismiss, 2000);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to dismiss proposal.");
      }
    });
  }

  // ── Approved Success View ──
  if (approvalResult) {
    return (
      <Card className="border border-[#00ed64]/30 bg-[#c3f0d2]/20 shadow-sm rounded-xl p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00684a] text-white">
            <CheckCircle className="h-5 w-5 text-[#00ed64]" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-ink">Action Approved &amp; Staged</h4>
              <Badge className="bg-[#00684a] text-white rounded-full text-[10px] px-2 py-0.5 font-bold">
                14-Day Safety Rollback Active
              </Badge>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              {approvalResult.message}
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-[#00684a]">
              <Clock className="h-3.5 w-3.5" />
              <span>Rollback window active until: <strong>{approvalResult.rollbackAvailableUntil}</strong></span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // ── Rejected / Dismissed View ──
  if (rejectionMessage) {
    return (
      <Card className="border border-hairline bg-surface-3/50 rounded-xl p-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <XCircle className="h-6 w-6 text-slate-400" />
          <h4 className="text-sm font-semibold text-ink">Proposal Dismissed</h4>
          <p className="text-xs text-ink-subtle">{rejectionMessage}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-hairline bg-white shadow-md rounded-xl overflow-hidden">
      <CardHeader className="border-b border-hairline bg-surface-3/40 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#00a35c]" />
            <CardTitle className="text-sm font-bold text-ink">
              Human-in-the-Loop Governance &amp; Sandbox Execution
            </CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold border-hairline text-ink-subtle">
            Ground Rules 04 &amp; 05 Enforced
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ─── 1. Interactive Candidate Account Checklist ─── */}
        {candidateUsers.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink">
                Select accounts to stage for deprovisioning:
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] font-semibold text-[#00684a] hover:underline"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-hairline/80 p-2 bg-surface-3/20">
              {candidateUsers.map((user) => {
                const isSelected = selectedIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={cn(
                      "flex items-center justify-between rounded-md p-2 text-xs transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-white border border-[#00ed64]/40 shadow-2xs"
                        : "bg-surface-3/40 border border-hairline opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 shrink-0 text-[#00a35c]" />
                      ) : (
                        <Square className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div className="truncate">
                        <div className="font-semibold text-ink truncate">{user.name}</div>
                        <div className="text-[11px] text-ink-subtle truncate">{user.email}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="font-bold text-[#00684a] tabular-nums">
                        +${(user.unitPrice || effectiveUnitPrice).toFixed(2)}/mo
                      </span>
                      <div className="text-[10px] text-ink-tertiary">
                        {user.daysSinceActive !== null ? `${user.daysSinceActive}d inactive` : "No activity"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-hairline bg-surface-3/30 p-3 text-center text-xs text-ink-subtle">
            No candidate accounts require deprovisioning for this service.
          </div>
        )}

        {/* ─── 2. Dynamic Impact Meter ─── */}
        <div className="flex items-center justify-between rounded-lg bg-surface-3/60 border border-hairline px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00a35c]" />
            <span className="text-xs font-semibold text-ink">
              Recalculated Selected Impact:
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">
              {selectedCount} of {candidateUsers.length} seats
            </span>
            <span className="text-sm font-extrabold text-[#00684a] tabular-nums">
              ${dynamicallyCalculatedSavings.toFixed(2)}/mo savings
            </span>
          </div>
        </div>

        {/* ─── 3. Sandbox Simulation Result Card ─── */}
        {simulationResult && (
          <div className="rounded-xl border border-[#00a35c]/30 bg-surface-1 p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-[#00a35c]" />
                <span className="text-xs font-bold text-ink">Sandbox Simulation Impact</span>
              </div>
              <Badge className="bg-[#c3f0d2] text-[#00684a] border-[#00ed64]/30 text-[10px] font-bold">
                Zero-Risk Verified
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded-lg border border-hairline p-2">
                <div className="text-[10px] text-ink-tertiary uppercase font-bold">Current Burn</div>
                <div className="text-sm font-bold text-ink tabular-nums">
                  ${simulationResult.oldMonthlyBurn.toFixed(2)}/mo
                </div>
              </div>
              <div className="bg-white rounded-lg border border-hairline p-2">
                <div className="text-[10px] text-[#00684a] uppercase font-bold">Simulated Burn</div>
                <div className="text-sm font-extrabold text-[#00684a] tabular-nums">
                  ${simulationResult.newMonthlyBurn.toFixed(2)}/mo
                </div>
              </div>
              <div className="bg-white rounded-lg border border-hairline p-2">
                <div className="text-[10px] text-ink-tertiary uppercase font-bold">Annual ROI</div>
                <div className="text-sm font-bold text-[#00a35c] tabular-nums">
                  +${simulationResult.annualProjectedSavings.toFixed(2)}/yr
                </div>
              </div>
              <div className="bg-white rounded-lg border border-hairline p-2">
                <div className="text-[10px] text-ink-tertiary uppercase font-bold">Seats (Pruned/Kept)</div>
                <div className="text-sm font-bold text-ink tabular-nums">
                  {simulationResult.seatsPruned} / {simulationResult.seatsRetained}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
              <Info className="h-3.5 w-3.5 shrink-0 text-[#00a35c]" />
              <span>Simulated against entire workspace ledger. Upstream account seats remain untouched.</span>
            </div>
          </div>
        )}

        {/* ─── 4. Confirmation Staging Dialog / Inline Prompt ─── */}
        {showConfirmApprove && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h5 className="text-xs font-bold text-amber-900">
                Confirm Human Review &amp; Stage De-provisioning
              </h5>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              You are approving the staged pruning of <strong>{selectedCount} seat(s)</strong> for {merchantName}.
              A 14-day automated rollback guarantee will remain in effect.
            </p>
            <Input
              type="text"
              placeholder="Optional reviewer notes (e.g., 'Confirmed with engineering lead')"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              className="h-8 text-xs bg-white border-amber-200"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmApprove(false)}
                className="h-7 text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isApproving}
                onClick={handleApproveStaged}
                className="h-7 text-xs gap-1.5 rounded-full bg-[#001e2b] text-white hover:bg-[#003d4f] font-semibold"
              >
                {isApproving ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Staging Action...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-[#00ed64]" />
                    Confirm &amp; Stage ({selectedCount} seats)
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── 5. Dismiss / Reject Input ─── */}
        {showRejectInput && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <span className="text-xs font-semibold text-ink">Dismiss Proposal</span>
            <Input
              type="text"
              placeholder="Optional dismissal reason (e.g., 'Hiring planned next month')"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="h-8 text-xs bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectInput(false)}
                className="h-7 text-xs rounded-full"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isRejecting}
                onClick={handleRejectProposal}
                className="h-7 text-xs rounded-full"
              >
                {isRejecting ? "Dismissing..." : "Confirm Dismissal"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── 6. Action Button Row ─── */}
        {!showConfirmApprove && !showRejectInput && (
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            {/* Button 1: Run Sandbox Simulation */}
            <Button
              type="button"
              variant="outline"
              disabled={selectedCount === 0 || isSimulating}
              onClick={handleRunSimulation}
              className="w-full sm:w-auto h-9 gap-1.5 rounded-full text-xs font-semibold border-hairline text-ink hover:bg-surface-3"
            >
              {isSimulating ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
                  Simulating...
                </>
              ) : (
                <>
                  <FlaskConical className="h-3.5 w-3.5 text-[#00a35c]" />
                  Run Sandbox Simulation
                </>
              )}
            </Button>

            {/* Button 2: Approve & Stage Prune */}
            <Button
              type="button"
              disabled={selectedCount === 0 || isApproving}
              onClick={() => setShowConfirmApprove(true)}
              className="w-full sm:w-auto flex-1 h-9 gap-1.5 rounded-full bg-[#001e2b] text-white hover:bg-[#003d4f] text-xs font-bold shadow-md shadow-[#001e2b]/15"
            >
              <CheckCircle className="h-3.5 w-3.5 text-[#00ed64]" />
              Approve &amp; Stage Prune (${dynamicallyCalculatedSavings.toFixed(2)}/mo)
            </Button>

            {/* Button 3: Dismiss / Reject */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowRejectInput(true)}
              className="w-full sm:w-auto h-9 rounded-full text-xs font-medium text-ink-subtle hover:text-red-600 hover:bg-red-50"
            >
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
