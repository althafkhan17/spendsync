// ─────────────────────────────────────────────────────────
// Verifier Agent
//
// Adversarial critic that cross-references InvoiceContext and
// TelemetryContext to produce a verified, safe recommendation.
// Enforces four hard rules before any seat cut is approved:
//   1. Math integrity
//   2. Protected entity shielding
//   3. Contract minimum bounds
//   4. Ambiguity flagging
// ─────────────────────────────────────────────────────────

import type {
  InvoiceContext,
  TelemetryContext,
  VerificationIssue,
  AgentActionTrace,
} from "./types";

export interface VerifierAgentOutput {
  verifiedCuts: number;
  verifiedSavings: number;
  issuesFound: VerificationIssue[];
  trace: AgentActionTrace;
}

/**
 * Runs the VerifierAgent: takes the raw InvoiceContext and TelemetryContext
 * outputs from the upstream agents and applies adversarial verification
 * rules before emitting a safe, bounded recommendation.
 */
export async function runVerifierAgent(
  invoice: InvoiceContext,
  telemetry: TelemetryContext
): Promise<VerifierAgentOutput> {
  const startTime = Date.now();
  const issues: VerificationIssue[] = [];

  // ───────────────────────────────────────────────
  // Step 1: Collect candidate dormant seats
  // ───────────────────────────────────────────────

  const dormantNonProtected = telemetry.users.filter(
    (u) => u.isDormant && !u.isProtected
  );

  let candidateCuts = dormantNonProtected.length;

  // ───────────────────────────────────────────────
  // Rule 2: Protected Entity Shielding
  // ───────────────────────────────────────────────
  // Any dormant user that is flagged as protected must be
  // removed from the cut list and reported as a warning.

  const dormantProtected = telemetry.users.filter(
    (u) => u.isDormant && u.isProtected
  );

  for (const user of dormantProtected) {
    issues.push({
      type: "PROTECTED_ACCOUNT",
      severity: "HIGH",
      description:
        `Account "${user.name}" (${user.email}) appears dormant ` +
        `(${user.daysSinceActive ?? "unknown"} days inactive) but is ` +
        `flagged as a protected/service account: ${user.protectedReason}. ` +
        `Deprovisioning rejected.`,
      affectedItem: user.email,
    });
  }

  // ───────────────────────────────────────────────
  // Rule 4: Ambiguity Flagging
  // ───────────────────────────────────────────────
  // Users in the borderline zone are NOT included in the
  // cut count; they're flagged for human review instead.

  const borderlineUsers = telemetry.users.filter((u) => u.isBorderline);

  for (const user of borderlineUsers) {
    issues.push({
      type: "AMBIGUOUS_ACTIVITY",
      severity: "MEDIUM",
      description:
        `Account "${user.name}" (${user.email}) has borderline activity ` +
        `(${user.daysSinceActive ?? "unknown"} days since last active, ` +
        `threshold: ${telemetry.inactivityThresholdDays} days). ` +
        `Marked as REQUIRES_HUMAN_REVIEW — not auto-included in cuts.`,
      affectedItem: user.email,
    });
  }

  // ───────────────────────────────────────────────
  // Rule 3: Contract Minimum Bounds
  // ───────────────────────────────────────────────
  // Ensure we never recommend cutting below the contractual minimum.

  const contractMin = invoice.contractMinimumSeats ?? 0;
  const billedSeats = invoice.billedSeats;

  if (contractMin > 0 && billedSeats > 0) {
    const maxAllowableCuts = billedSeats - contractMin;

    if (maxAllowableCuts <= 0) {
      // Already at or below the contractual minimum — no cuts allowed
      issues.push({
        type: "CONTRACT_MINIMUM_VIOLATION",
        severity: "HIGH",
        description:
          `Current billed seats (${billedSeats}) are at or below the ` +
          `contractual minimum (${contractMin}). No seat reductions are ` +
          `permissible without renegotiating the contract.`,
        affectedItem: `Contract minimum: ${contractMin} seats`,
      });
      candidateCuts = 0;
    } else if (candidateCuts > maxAllowableCuts) {
      issues.push({
        type: "CONTRACT_MINIMUM_VIOLATION",
        severity: "MEDIUM",
        description:
          `Proposed cuts (${candidateCuts}) would reduce seats below the ` +
          `contractual minimum (${contractMin}). Clamped from ` +
          `${candidateCuts} to ${maxAllowableCuts} cuts.`,
        affectedItem: `Contract minimum: ${contractMin} seats`,
      });
      candidateCuts = maxAllowableCuts;
    }
  }

  // Also clamp to never exceed the total billed seats
  if (billedSeats > 0 && candidateCuts > billedSeats) {
    candidateCuts = billedSeats;
  }

  // ───────────────────────────────────────────────
  // Rule 1: Math Integrity
  // ───────────────────────────────────────────────
  // Verify that verifiedCuts × seatUnitPrice === verifiedSavings.

  const unitPrice = invoice.seatUnitPrice;
  let verifiedSavings = candidateCuts * unitPrice;

  // Round to 2 decimal places to avoid floating-point drift
  verifiedSavings = Math.round(verifiedSavings * 100) / 100;

  // Sanity check: savings must not exceed total invoice amount
  if (verifiedSavings > invoice.totalAmount && invoice.totalAmount > 0) {
    issues.push({
      type: "MATH_MISMATCH",
      severity: "HIGH",
      description:
        `Calculated savings (${invoice.currency} ${verifiedSavings}) exceed ` +
        `the total invoice amount (${invoice.currency} ${invoice.totalAmount}). ` +
        `This likely indicates a unit-price extraction error. ` +
        `Clamping savings to total invoice amount.`,
      affectedItem: `${candidateCuts} cuts × ${invoice.currency} ${unitPrice}/seat`,
    });
    verifiedSavings = invoice.totalAmount;
    // Recalculate cuts from clamped savings
    candidateCuts = unitPrice > 0 ? Math.floor(verifiedSavings / unitPrice) : 0;
  }

  // Final math verification
  const expectedSavings = Math.round(candidateCuts * unitPrice * 100) / 100;
  if (Math.abs(expectedSavings - verifiedSavings) > 0.01) {
    issues.push({
      type: "MATH_MISMATCH",
      severity: "LOW",
      description:
        `Minor floating-point discrepancy: ${candidateCuts} × ` +
        `${unitPrice} = ${expectedSavings}, but computed savings = ` +
        `${verifiedSavings}. Reconciled to ${expectedSavings}.`,
      affectedItem: "Savings calculation",
    });
    verifiedSavings = expectedSavings;
  }

  // ───────────────────────────────────────────────
  // Build the trace
  // ───────────────────────────────────────────────

  const durationMs = Date.now() - startTime;

  const highIssues = issues.filter((i) => i.severity === "HIGH").length;
  const medIssues = issues.filter((i) => i.severity === "MEDIUM").length;

  const trace: AgentActionTrace = {
    stepName: "Verify & Validate Recommendations",
    agentName: "VerifierAgent",
    inputSummary:
      `Invoice: ${invoice.vendorName} (${invoice.billedSeats} seats). ` +
      `Telemetry: ${telemetry.totalUsers} users (${telemetry.dormantUsers} dormant).`,
    findings:
      `Verified ${candidateCuts} safe cuts → ` +
      `${invoice.currency} ${verifiedSavings}/mo savings. ` +
      `${issues.length} issue(s) found (${highIssues} HIGH, ${medIssues} MEDIUM). ` +
      `Protected accounts shielded: ${dormantProtected.length}. ` +
      `Borderline users deferred: ${borderlineUsers.length}.`,
    status: highIssues > 0 ? "WARNING" : "SUCCESS",
    timestamp: new Date().toISOString(),
    durationMs,
  };

  return {
    verifiedCuts: candidateCuts,
    verifiedSavings,
    issuesFound: issues,
    trace,
  };
}
