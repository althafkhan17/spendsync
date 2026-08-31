// ─────────────────────────────────────────────────────────
// Telemetry Agent
//
// Evaluates user-level activity data against an inactivity
// threshold and produces enriched TelemetryContext with
// per-user dormancy classification, protected-account
// detection, and borderline-activity flagging.
// ─────────────────────────────────────────────────────────

import type { TelemetryContext, TelemetryUser, AgentActionTrace } from "./types";

/** Default inactivity threshold in days. */
const DEFAULT_THRESHOLD_DAYS = 30;

/**
 * Patterns in email or name that indicate a protected account
 * that should never be auto-deprovisioned regardless of activity.
 */
const PROTECTED_PATTERNS = [
  "bot",
  "service",
  "admin",
  "ci-cd",
  "ci/cd",
  "cicd",
  "runner",
  "deploy",
  "automation",
  "noreply",
  "no-reply",
  "system",
  "security",
  "infosec",
  "soc",
  "compliance",
  "ops",
  "sre",
  "devops",
  "jenkins",
  "github-actions",
  "buildkite",
  "circleci",
  "terraform",
];

/**
 * How many days of "fuzz" to apply around the threshold before
 * marking an account as borderline rather than definitively dormant.
 * e.g. if threshold is 30 and buffer is 3, users inactive for
 * 28-33 days are flagged as borderline.
 */
const BORDERLINE_BUFFER_DAYS = 3;

export interface TelemetryAgentInput {
  users: Array<{
    id: string;
    email: string;
    name: string;
    role?: string;
    lastActiveAt: string | Date;
    activityCount: number;
  }>;
  inactivityThresholdDays?: number;
}

export interface TelemetryAgentOutput extends TelemetryContext {
  dormantSeats: TelemetryUser[];
  trace: AgentActionTrace;
}

/**
 * Checks if the given email or name matches any protected account pattern.
 */
function detectProtectedAccount(
  email: string,
  name: string,
  role?: string
): { isProtected: boolean; reason: string | null } {
  const searchText = `${email} ${name} ${role ?? ""}`.toLowerCase();

  for (const pattern of PROTECTED_PATTERNS) {
    if (searchText.includes(pattern)) {
      return {
        isProtected: true,
        reason: `Matched protected-account pattern "${pattern}" in "${searchText.trim()}"`,
      };
    }
  }

  return { isProtected: false, reason: null };
}

/**
 * Runs the TelemetryAgent: classifies each user as active, dormant,
 * protected, or borderline based on their last-activity timestamp
 * relative to the configured inactivity threshold.
 *
 * This is a deterministic, rule-based agent (no LLM call required)
 * since the logic is well-defined and doesn't benefit from generative
 * interpretation. This makes it fast, cheap, and fully auditable.
 */
export async function runTelemetryAgent(
  input: TelemetryAgentInput
): Promise<TelemetryAgentOutput> {
  const startTime = Date.now();
  const thresholdDays = input.inactivityThresholdDays ?? DEFAULT_THRESHOLD_DAYS;
  const now = Date.now();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const borderlineMs = BORDERLINE_BUFFER_DAYS * 24 * 60 * 60 * 1000;

  const classifiedUsers: TelemetryUser[] = [];

  for (const user of input.users) {
    // Parse the last-active timestamp
    const lastActiveDate = user.lastActiveAt
      ? new Date(user.lastActiveAt)
      : null;

    const lastActiveTime = lastActiveDate?.getTime() ?? null;
    const isValidDate =
      lastActiveTime !== null && !isNaN(lastActiveTime);

    const daysSinceActive = isValidDate
      ? Math.floor((now - lastActiveTime!) / (24 * 60 * 60 * 1000))
      : null;

    // Protected account detection
    const protection = detectProtectedAccount(
      user.email,
      user.name,
      user.role
    );

    // Dormancy classification
    let isDormant = false;
    let isBorderline = false;

    if (!isValidDate || daysSinceActive === null) {
      // No activity timestamp at all — treat as dormant unless protected
      isDormant = !protection.isProtected;
    } else {
      const timeSinceActive = now - lastActiveTime!;

      if (timeSinceActive > thresholdMs + borderlineMs) {
        // Clearly dormant (well past threshold + buffer)
        isDormant = true;
      } else if (timeSinceActive > thresholdMs - borderlineMs) {
        // Borderline zone: within ±buffer of the threshold
        isBorderline = true;
      }
      // Otherwise: clearly active
    }

    classifiedUsers.push({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role ?? "member",
      lastActiveAt: isValidDate ? lastActiveDate : null,
      daysSinceActive,
      activityCount: user.activityCount,
      isDormant,
      isProtected: protection.isProtected,
      protectedReason: protection.reason,
      isBorderline,
    });
  }

  // Aggregate counts
  const activeUsers = classifiedUsers.filter(
    (u) => !u.isDormant && !u.isBorderline
  ).length;
  const dormantUsers = classifiedUsers.filter((u) => u.isDormant).length;
  const protectedUsers = classifiedUsers.filter((u) => u.isProtected).length;
  const borderlineUsers = classifiedUsers.filter((u) => u.isBorderline).length;

  const dormantSeats = classifiedUsers.filter(
    (u) => u.isDormant && !u.isProtected
  );

  const durationMs = Date.now() - startTime;

  const context: TelemetryContext = {
    totalUsers: classifiedUsers.length,
    activeUsers,
    dormantUsers,
    protectedUsers,
    borderlineUsers,
    inactivityThresholdDays: thresholdDays,
    users: classifiedUsers,
  };

  const trace: AgentActionTrace = {
    stepName: "Evaluate User Telemetry",
    agentName: "TelemetryAgent",
    inputSummary: `${input.users.length} user(s), ${thresholdDays}-day threshold`,
    findings:
      `Classified ${classifiedUsers.length} users: ` +
      `${activeUsers} active, ${dormantUsers} dormant, ` +
      `${protectedUsers} protected, ${borderlineUsers} borderline. ` +
      `${dormantSeats.length} non-protected dormant seat(s) eligible for review.`,
    status:
      dormantSeats.length > 0
        ? "SUCCESS"
        : borderlineUsers > 0
          ? "WARNING"
          : "SUCCESS",
    timestamp: new Date().toISOString(),
    durationMs,
  };

  return { ...context, dormantSeats, trace };
}
