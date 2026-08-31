// ─────────────────────────────────────────────────────────
// Multi-Agent Investigation Pipeline — Shared Type System
// ─────────────────────────────────────────────────────────

/**
 * Structured invoice data extracted by the InvoiceAgent.
 * Goes beyond simple vendor/amount to capture contract terms
 * that constrain what the VerifierAgent can recommend.
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isPrimary: boolean;
}

export interface InvoiceContext {
  vendorName: string;
  invoiceDate: string | null;
  renewalDate: string | null;
  billedSeats: number;
  seatUnitPrice: number;
  totalAmount: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  contractMinimumSeats: number | null;
  renewalPenaltyTerms: string | null;
  tieredPricing: Array<{ tierName: string; minSeats: number; maxSeats: number | null; pricePerSeat: number }>;
  evidence: string[];
}

/**
 * Structured user-activity telemetry evaluated by the TelemetryAgent.
 * Each user entry carries enrichment flags the VerifierAgent
 * uses to decide if an account is safe to deprovision.
 */
export interface TelemetryUser {
  id: string;
  email: string;
  name: string;
  role: string;
  lastActiveAt: Date | null;
  daysSinceActive: number | null;
  activityCount: number;
  isDormant: boolean;
  isProtected: boolean;
  protectedReason: string | null;
  isBorderline: boolean;
}

export interface TelemetryContext {
  totalUsers: number;
  activeUsers: number;
  dormantUsers: number;
  protectedUsers: number;
  borderlineUsers: number;
  inactivityThresholdDays: number;
  users: TelemetryUser[];
}

/**
 * An individual action trace entry produced by each agent.
 * The orchestrator collects these into InvestigationResult.fullTrace
 * to provide complete audit transparency.
 */
export type AgentName = "InvoiceAgent" | "TelemetryAgent" | "VerifierAgent" | "BaselineAgent" | "Orchestrator";
export type TraceStatus = "SUCCESS" | "WARNING" | "BLOCKED" | "ERROR";

export interface AgentActionTrace {
  stepName: string;
  agentName: AgentName;
  inputSummary: string;
  findings: string;
  status: TraceStatus;
  timestamp: string;
  durationMs: number;
}

/**
 * A single issue surfaced by the VerifierAgent's adversarial checks.
 * Each issue may block, downgrade, or flag a recommendation.
 */
export type IssueType =
  | "MATH_MISMATCH"
  | "PROTECTED_ACCOUNT"
  | "CONTRACT_MINIMUM_VIOLATION"
  | "AMBIGUOUS_ACTIVITY";

export type IssueSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface VerificationIssue {
  type: IssueType;
  severity: IssueSeverity;
  description: string;
  affectedItem: string;
}

export interface CandidateUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActiveAt: string | null;
  daysSinceActive: number | null;
  unitPrice: number;
}

/**
 * The final output of the full multi-agent investigation pipeline.
 * Contains the verified recommendation, all issues found, a
 * human-readable action plan, and the complete execution trace.
 */
export interface InvestigationResult {
  rawFindings: {
    invoiceSummary: string;
    telemetrySummary: string;
  };
  verifiedRecommendations: {
    seatsToReview: number;
    potentialMonthlySavings: number;
    confidenceScore: number;
  };
  verificationIssues: VerificationIssue[];
  actionPlan: string[];
  fullTrace: AgentActionTrace[];
  candidateUsers?: CandidateUser[];
  unitPrice?: number;
  currency?: string;
}
