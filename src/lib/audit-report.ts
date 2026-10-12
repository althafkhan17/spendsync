/**
 * Typed shape of the JSON stored in `Integration.tokenUsageReport`.
 *
 * Every report declares its `dataSource` so the UI can label numbers that came
 * from a live vendor API differently from numbers SpendSync had to simulate
 * (for example when a token lacks the required scope). Nothing in the product
 * should present simulated data as real.
 */

export type DataSource = "LIVE" | "SIMULATED";

export type SeatStatus = "ACTIVE" | "IDLE" | "NEVER_ACTIVE" | "PENDING_CANCELLATION";

export interface SeatRecord {
  username: string;
  status: SeatStatus;
  lastActivityAt: string | null;
  lastActivityEditor: string | null;
  createdAt: string | null;
  planType: string | null;
  pendingCancellationDate: string | null;
}

export interface SeatAuditReport {
  kind: "SEATS";
  version: 2;
  provider: "FIGMA" | "GITHUB_COPILOT";
  dataSource: DataSource;
  simulationReason: string | null;
  generatedAt: string;
  currency: string;
  seatUnitPrice: number;
  billedSeats: number;
  /** Where the billed-seat figure came from. */
  billedSeatsSource: "INVOICE" | "VENDOR_API" | "DEFAULT";
  activeSeats: number;
  idleSeats: number;
  idleThresholdDays: number;
  planType: string | null;
  settings: Record<string, string | null>;
  seats: SeatRecord[];
}

export interface ModelSpend {
  model: string;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DailySpend {
  date: string; // YYYY-MM-DD
  costUsd: number;
}

export interface TokenSpendReport {
  kind: "TOKENS";
  version: 2;
  provider: "ANTHROPIC";
  dataSource: DataSource;
  simulationReason: string | null;
  generatedAt: string;
  keyKind: "ADMIN" | "STANDARD" | "DEMO";
  period: { start: string; end: string };
  totalCostUsd: number;
  thresholdUsd: number;
  byModel: ModelSpend[];
  daily: DailySpend[];
}

export type AuditReport = SeatAuditReport | TokenSpendReport;

/**
 * Parses the stored JSON. Returns null for empty, unparsable, or legacy
 * (pre-version-2) payloads so callers can fall back to a neutral display
 * instead of rendering fabricated fields.
 */
export function parseAuditReport(raw: string | null | undefined): AuditReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (parsed.version !== 2) return null;
    if (parsed.kind === "SEATS" || parsed.kind === "TOKENS") return parsed as AuditReport;
    return null;
  } catch {
    return null;
  }
}

export function isSeatReport(r: AuditReport | null): r is SeatAuditReport {
  return !!r && r.kind === "SEATS";
}

export function isTokenReport(r: AuditReport | null): r is TokenSpendReport {
  return !!r && r.kind === "TOKENS";
}
