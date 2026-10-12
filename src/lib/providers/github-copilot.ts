/**
 * GitHub Copilot billing client.
 *
 * Docs: https://docs.github.com/en/rest/copilot/copilot-user-management
 * Both endpoints require `manage_billing:copilot` or `read:org` and an org
 * owner token. Fine-grained PATs need the "GitHub Copilot Business" org
 * permission (read).
 */

import type { SeatRecord, SeatStatus } from "@/lib/audit-report";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2022-11-28";

export interface CopilotBilling {
  seat_breakdown: {
    total: number;
    added_this_cycle: number;
    pending_cancellation: number;
    pending_invitation: number;
    active_this_cycle: number;
    inactive_this_cycle: number;
  };
  seat_management_setting: string;
  public_code_suggestions: string;
  ide_chat?: string;
  platform_chat?: string;
  cli?: string;
  plan_type?: "business" | "enterprise";
}

export interface CopilotSeat {
  created_at: string;
  updated_at?: string;
  pending_cancellation_date: string | null;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  plan_type?: "business" | "enterprise" | "unknown";
  assignee: { login: string; id: number; avatar_url?: string } | null;
  assigning_team?: { slug: string; name: string } | null;
}

export type GithubAccess =
  | { ok: true; orgName: string; copilotAccess: true; billing: CopilotBilling }
  | { ok: true; orgName: string; copilotAccess: false; reason: string }
  | { ok: false; reason: string };

export class GithubApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
  }
}

function headers(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "SpendSync/1.0 (seat optimizer)",
  };
}

async function githubGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers(token), cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message ? `: ${body.message}` : "";
    } catch {
      /* ignore */
    }
    throw new GithubApiError(res.status, `GitHub API ${res.status} on ${path}${detail}`);
  }
  return (await res.json()) as T;
}

export function describeGithubStatus(status: number, orgSlug: string): string {
  switch (status) {
    case 401:
      return "GitHub rejected the token (401). It may be expired or revoked.";
    case 403:
      return `Token lacks the Copilot billing permission for "${orgSlug}" (403). It needs manage_billing:copilot or read:org and the user must be an org owner.`;
    case 404:
      return `GitHub returned 404 for "${orgSlug}". Either the org does not exist, the token cannot see it, or Copilot Business is not enabled.`;
    case 422:
      return `GitHub reports a billing problem on "${orgSlug}" (422). Check the org payment method.`;
    default:
      return `GitHub API returned status ${status}.`;
  }
}

/** Confirms the token can see the org, then whether it can read Copilot billing. */
export async function validateGithubAccess(orgSlug: string, token: string): Promise<GithubAccess> {
  let orgName = orgSlug;
  try {
    const org = await githubGet<{ login: string; name?: string | null }>(`/orgs/${encodeURIComponent(orgSlug)}`, token);
    orgName = org.name || org.login;
  } catch (err) {
    if (err instanceof GithubApiError) {
      if (err.status === 401) return { ok: false, reason: describeGithubStatus(401, orgSlug) };
      if (err.status === 404) return { ok: false, reason: `GitHub could not find an organization named "${orgSlug}" visible to this token.` };
      return { ok: false, reason: describeGithubStatus(err.status, orgSlug) };
    }
    return { ok: false, reason: "Could not reach the GitHub API." };
  }
  try {
    const billing = await fetchCopilotBilling(orgSlug, token);
    return { ok: true, orgName, copilotAccess: true, billing };
  } catch (err) {
    const status = err instanceof GithubApiError ? err.status : 0;
    return { ok: true, orgName, copilotAccess: false, reason: status ? describeGithubStatus(status, orgSlug) : "Could not reach the GitHub API." };
  }
}

export async function fetchCopilotBilling(orgSlug: string, token: string): Promise<CopilotBilling> {
  return githubGet<CopilotBilling>(`/orgs/${encodeURIComponent(orgSlug)}/copilot/billing`, token);
}

export async function fetchCopilotSeats(orgSlug: string, token: string): Promise<CopilotSeat[]> {
  const seats: CopilotSeat[] = [];
  let page = 1;
  // Hard cap so a misbehaving org can never loop forever.
  while (page <= 20) {
    const data = await githubGet<{ total_seats: number; seats: CopilotSeat[] }>(
      `/orgs/${encodeURIComponent(orgSlug)}/copilot/billing/seats?per_page=100&page=${page}`,
      token
    );
    seats.push(...(data.seats ?? []));
    if (!data.seats || data.seats.length < 100 || seats.length >= data.total_seats) break;
    page++;
  }
  return seats;
}

export function classifySeat(seat: CopilotSeat, idleThresholdDays: number, now = Date.now()): SeatStatus {
  if (seat.pending_cancellation_date) return "PENDING_CANCELLATION";
  if (!seat.last_activity_at) return "NEVER_ACTIVE";
  const ageMs = now - new Date(seat.last_activity_at).getTime();
  return ageMs <= idleThresholdDays * 24 * 60 * 60 * 1000 ? "ACTIVE" : "IDLE";
}

export function toSeatRecords(seats: CopilotSeat[], idleThresholdDays: number): SeatRecord[] {
  const now = Date.now();
  return seats.map((seat) => ({
    username: seat.assignee?.login ?? "unassigned",
    status: classifySeat(seat, idleThresholdDays, now),
    lastActivityAt: seat.last_activity_at,
    lastActivityEditor: seat.last_activity_editor,
    createdAt: seat.created_at ?? null,
    planType: seat.plan_type ?? null,
    pendingCancellationDate: seat.pending_cancellation_date,
  }));
}

/** Published list price per seat per month, USD. */
export function copilotListPrice(planType: string | null | undefined): number {
  return planType === "enterprise" ? 39 : 19;
}

export function isMockGithubToken(token: string): boolean {
  return token.startsWith("mock_") || token.startsWith("github_pat_11AAAABBBBCCCC");
}
