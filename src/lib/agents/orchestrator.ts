// ─────────────────────────────────────────────────────────
// Orchestrator
//
// Sequential pipeline runner that executes the three
// specialized agents in order and compiles the final
// InvestigationResult with a complete audit trace and
// human-readable action plan.
//
//   InvoiceAgent → TelemetryAgent → VerifierAgent
// ─────────────────────────────────────────────────────────

import type {
  InvestigationResult,
  AgentActionTrace,
} from "./types";
import { runInvoiceAgent, type InvoiceAgentInput } from "./invoice-agent";
import { runTelemetryAgent, type TelemetryAgentInput } from "./telemetry-agent";
import { runVerifierAgent } from "./verifier-agent";

export interface InvestigationInput {
  invoiceInput: InvoiceAgentInput;
  telemetryInput: TelemetryAgentInput;
}

/**
 * Runs the full multi-agent investigation pipeline:
 *   1. InvoiceAgent   — extract invoice data with contract terms
 *   2. TelemetryAgent — classify user activity and dormancy
 *   3. VerifierAgent  — adversarial verification and safe recommendations
 *
 * Returns a complete InvestigationResult with verified recommendations,
 * all verification issues, a human-readable action plan, and the full
 * step-by-step execution trace.
 */
export async function runFullInvestigation(
  input: InvestigationInput
): Promise<InvestigationResult> {
  const pipelineStart = Date.now();
  const fullTrace: AgentActionTrace[] = [];

  // ───────────────────────────────────────────────
  // Stage 1: Invoice Agent
  // ───────────────────────────────────────────────

  console.log("═══════════════════════════════════════════");
  console.log("🤖 MULTI-AGENT INVESTIGATION PIPELINE");
  console.log("═══════════════════════════════════════════");
  console.log("  Stage 1/3: InvoiceAgent — Extracting invoice data...");

  const invoiceResult = await runInvoiceAgent(input.invoiceInput);
  fullTrace.push(invoiceResult.trace);

  console.log(`  ✅ InvoiceAgent complete (${invoiceResult.trace.durationMs}ms)`);
  console.log(`     → ${invoiceResult.vendorName}: ${invoiceResult.billedSeats} seats × ${invoiceResult.currency} ${invoiceResult.seatUnitPrice}`);

  // ───────────────────────────────────────────────
  // Stage 2: Telemetry Agent
  // ───────────────────────────────────────────────

  console.log("  Stage 2/3: TelemetryAgent — Classifying user activity...");

  const telemetryResult = await runTelemetryAgent(input.telemetryInput);
  fullTrace.push(telemetryResult.trace);

  console.log(`  ✅ TelemetryAgent complete (${telemetryResult.trace.durationMs}ms)`);
  console.log(`     → ${telemetryResult.dormantSeats.length} dormant (non-protected), ${telemetryResult.borderlineUsers} borderline`);

  // ───────────────────────────────────────────────
  // Stage 3: Verifier Agent
  // ───────────────────────────────────────────────

  console.log("  Stage 3/3: VerifierAgent — Adversarial verification...");

  // Extract the InvoiceContext (without the trace) for the verifier
  const { trace: _invoiceTrace, ...invoiceContext } = invoiceResult;
  const { trace: _telemetryTrace, dormantSeats: _dormant, ...telemetryContext } = telemetryResult;

  const verifierResult = await runVerifierAgent(invoiceContext, telemetryContext);
  fullTrace.push(verifierResult.trace);

  console.log(`  ✅ VerifierAgent complete (${verifierResult.trace.durationMs}ms)`);
  console.log(`     → ${verifierResult.verifiedCuts} verified cuts, ${invoiceContext.currency} ${verifierResult.verifiedSavings}/mo savings`);
  console.log(`     → ${verifierResult.issuesFound.length} issue(s) flagged`);

  // ───────────────────────────────────────────────
  // Compile the final result
  // ───────────────────────────────────────────────

  const pipelineDurationMs = Date.now() - pipelineStart;

  // Calculate confidence score:
  //   Start at 1.0. Degrade for each issue by severity weight.
  const highIssues = verifierResult.issuesFound.filter((i) => i.severity === "HIGH").length;
  const medIssues = verifierResult.issuesFound.filter((i) => i.severity === "MEDIUM").length;
  const lowIssues = verifierResult.issuesFound.filter((i) => i.severity === "LOW").length;

  let confidenceScore = 1.0;
  confidenceScore -= highIssues * 0.15;
  confidenceScore -= medIssues * 0.08;
  confidenceScore -= lowIssues * 0.03;

  // Degrade if invoice extraction returned with errors
  if (invoiceResult.trace.status === "ERROR") {
    confidenceScore -= 0.30;
  }
  // Degrade if there are borderline users requiring manual review
  if (telemetryResult.borderlineUsers > 0) {
    confidenceScore -= 0.05;
  }

  confidenceScore = Math.max(0, Math.round(confidenceScore * 100) / 100);

  // Build a human-readable action plan
  const actionPlan = buildActionPlan(
    invoiceContext,
    telemetryResult,
    verifierResult,
    pipelineDurationMs
  );

  // Add a final orchestrator trace entry
  fullTrace.push({
    stepName: "Pipeline Complete",
    agentName: "Orchestrator",
    inputSummary: `3-stage pipeline for ${invoiceContext.vendorName}`,
    findings:
      `Pipeline completed in ${pipelineDurationMs}ms. ` +
      `Final recommendation: ${verifierResult.verifiedCuts} seat cuts → ` +
      `${invoiceContext.currency} ${verifierResult.verifiedSavings}/mo savings ` +
      `(confidence: ${confidenceScore}). ` +
      `${verifierResult.issuesFound.length} total issues.`,
    status: highIssues > 0 ? "WARNING" : "SUCCESS",
    timestamp: new Date().toISOString(),
    durationMs: pipelineDurationMs,
  });

  console.log("═══════════════════════════════════════════");
  console.log(`  🏁 Pipeline complete in ${pipelineDurationMs}ms`);
  console.log(`     Confidence: ${confidenceScore}`);
  console.log("═══════════════════════════════════════════");

  const candidateUsers = telemetryResult.dormantSeats
    .filter((u: any) => !u.isProtected)
    .slice(0, verifierResult.verifiedCuts)
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
      daysSinceActive: u.daysSinceActive,
      unitPrice: invoiceContext.seatUnitPrice,
    }));

  return {
    rawFindings: {
      invoiceSummary: invoiceResult.trace.findings,
      telemetrySummary: telemetryResult.trace.findings,
    },
    verifiedRecommendations: {
      seatsToReview: verifierResult.verifiedCuts,
      potentialMonthlySavings: verifierResult.verifiedSavings,
      confidenceScore,
    },
    verificationIssues: verifierResult.issuesFound,
    actionPlan,
    fullTrace,
    candidateUsers,
    unitPrice: invoiceContext.seatUnitPrice,
    currency: invoiceContext.currency,
  };
}

/**
 * Generates a step-by-step, human-readable action plan
 * based on the verified investigation results.
 */
function buildActionPlan(
  invoice: { vendorName: string; currency: string; billedSeats: number; seatUnitPrice: number; contractMinimumSeats: number | null },
  telemetry: { dormantSeats: any[]; borderlineUsers: number; users: any[] },
  verifier: { verifiedCuts: number; verifiedSavings: number; issuesFound: any[] },
  durationMs: number
): string[] {
  const plan: string[] = [];

  plan.push(
    `Investigation completed for ${invoice.vendorName} in ${(durationMs / 1000).toFixed(1)}s.`
  );

  if (verifier.verifiedCuts === 0) {
    plan.push(
      "No seat reductions are recommended at this time. " +
      "All billed seats are either actively used, protected, or constrained by contract minimums."
    );

    if (telemetry.borderlineUsers > 0) {
      plan.push(
        `${telemetry.borderlineUsers} user(s) have borderline activity near the inactivity threshold. ` +
        "Re-evaluate these accounts in 7-14 days."
      );
    }

    return plan;
  }

  plan.push(
    `Recommendation: Review ${verifier.verifiedCuts} seat(s) for potential deprovisioning ` +
    `to save ${invoice.currency} ${verifier.verifiedSavings}/month.`
  );

  // List the specific dormant users
  const dormantList = telemetry.dormantSeats
    .filter((u: any) => !u.isProtected)
    .slice(0, verifier.verifiedCuts);

  if (dormantList.length > 0) {
    plan.push("Dormant accounts identified for review:");
    for (const user of dormantList) {
      const days = user.daysSinceActive !== null
        ? `${user.daysSinceActive} days inactive`
        : "no recorded activity";
      plan.push(`  • ${user.name} (${user.email}) — ${days}`);
    }
  }

  if (invoice.contractMinimumSeats) {
    plan.push(
      `⚠️ Contract minimum: ${invoice.contractMinimumSeats} seats. ` +
      `Do not reduce below this threshold without renegotiation.`
    );
  }

  if (telemetry.borderlineUsers > 0) {
    plan.push(
      `${telemetry.borderlineUsers} additional user(s) have borderline activity. ` +
      "These require manual review before any action."
    );
  }

  const highIssues = verifier.issuesFound.filter((i: any) => i.severity === "HIGH");
  if (highIssues.length > 0) {
    plan.push(
      `⚠️ ${highIssues.length} HIGH-severity issue(s) were flagged during verification. ` +
      "Review the issues list before proceeding."
    );
  }

  plan.push(
    "Next steps: Log into the vendor's admin portal and deactivate or downgrade the flagged accounts. " +
    "Confirm changes before the next billing cycle renewal date."
  );

  return plan;
}
