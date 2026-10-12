/**
 * Anthropic usage client.
 *
 * Spend data comes from the Usage & Cost Admin API, which is raw HTTP only and
 * requires an Admin API key (`sk-ant-admin...`). A standard key cannot read
 * organisation usage, so we detect the key type up front and tell the user
 * exactly which key unlocks live telemetry.
 *
 * Docs: https://platform.claude.com/docs/en/manage-claude/usage-cost-api
 */

import type { DailySpend, ModelSpend } from "@/lib/audit-report";

const ANTHROPIC_API = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const USER_AGENT = "SpendSync/1.0 (token spend monitor)";

export const DEMO_ANTHROPIC_KEY = "sk-ant-test-mock";

export type AnthropicKeyKind = "ADMIN" | "STANDARD" | "DEMO";

export type AnthropicKeyCheck =
  | { ok: true; kind: AnthropicKeyKind; note: string | null }
  | { ok: false; reason: string };

/** First-party list prices, USD per million tokens. Kept for estimates when the cost report is unavailable. */
export const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

function pricingFor(model: string) {
  const key = Object.keys(MODEL_PRICING).find((k) => model.startsWith(k));
  if (key) return MODEL_PRICING[key];
  const m = model.toLowerCase();
  if (m.includes("fable") || m.includes("mythos")) return MODEL_PRICING["claude-fable-5-1"];
  if (m.includes("opus")) return MODEL_PRICING["claude-opus-5-5"];
  if (m.includes("haiku")) return MODEL_PRICING["claude-haiku-5-5"];
  return MODEL_PRICING["claude-sonnet-5-5"];
}

export function estimateCostUsd(u: {
  model: string;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
}): number {
  const p = pricingFor(u.model);
  const perM = 1_000_000;
  return (
    (u.uncachedInputTokens / perM) * p.input +
    (u.cacheReadTokens / perM) * p.cacheRead +
    (u.cacheCreationTokens / perM) * p.cacheWrite +
    (u.outputTokens / perM) * p.output
  );
}

export function prettyModelName(model: string): string {
  const base = model.replace(/-\d{8}$/, "");
  const parts = base.replace(/^claude-/, "").split("-");
  if (parts.length === 0) return model;
  const family = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const version = parts.slice(1).join(".");
  return version ? `Claude ${family} ${version}` : `Claude ${family}`;
}

function headers(apiKey: string): HeadersInit {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
    "User-Agent": USER_AGENT,
  };
}

export function isDemoAnthropicKey(key: string): boolean {
  return key === DEMO_ANTHROPIC_KEY;
}

export function looksLikeAdminKey(key: string): boolean {
  return key.startsWith("sk-ant-admin");
}

/**
 * Verifies the key against the API without spending tokens.
 * Admin keys are probed on the cost report; standard keys on the models list.
 */
export async function validateAnthropicKey(apiKey: string): Promise<AnthropicKeyCheck> {
  if (isDemoAnthropicKey(apiKey)) {
    return { ok: true, kind: "DEMO", note: "Demo key accepted. Telemetry will be simulated." };
  }
  if (!apiKey.startsWith("sk-ant-")) {
    return { ok: false, reason: "Anthropic keys start with sk-ant-." };
  }
  try {
    if (looksLikeAdminKey(apiKey)) {
      const probe = new URL(`${ANTHROPIC_API}/v1/organizations/cost_report`);
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      probe.searchParams.set("starting_at", start.toISOString());
      probe.searchParams.set("ending_at", end.toISOString());
      probe.searchParams.set("limit", "1");
      const res = await fetch(probe, { headers: headers(apiKey), cache: "no-store" });
      if (res.ok) return { ok: true, kind: "ADMIN", note: null };
      if (res.status === 401) return { ok: false, reason: "Anthropic rejected this Admin API key (401)." };
      if (res.status === 403) return { ok: false, reason: "This key is not permitted to read organization usage (403)." };
      return { ok: false, reason: `Anthropic API returned ${res.status} while verifying the key.` };
    }
    const res = await fetch(`${ANTHROPIC_API}/v1/models?limit=1`, { headers: headers(apiKey), cache: "no-store" });
    if (res.ok) {
      return {
        ok: true,
        kind: "STANDARD",
        note: "Key verified. Live organization spend needs an Admin API key (sk-ant-admin...), so telemetry will be simulated until one is provided.",
      };
    }
    if (res.status === 401) return { ok: false, reason: "Anthropic rejected this API key (401). Check it was copied correctly." };
    return { ok: false, reason: `Anthropic API returned ${res.status} while verifying the key.` };
  } catch {
    return { ok: false, reason: "Could not reach the Anthropic API to verify the key." };
  }
}

interface UsageBucket {
  starting_at: string;
  ending_at: string;
  results: Array<{
    model: string | null;
    uncached_input_tokens: number;
    cache_read_input_tokens: number;
    cache_creation: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number };
    output_tokens: number;
  }>;
}

interface CostBucket {
  starting_at: string;
  ending_at: string;
  results: Array<{
    amount: string; // cents as decimal string
    currency: string;
    model: string | null;
    cost_type: string | null;
    description: string | null;
  }>;
}

async function fetchAllBuckets<T>(url: URL, apiKey: string): Promise<T[]> {
  const buckets: T[] = [];
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const u = new URL(url);
    if (page) u.searchParams.set("page", page);
    const res = await fetch(u, { headers: headers(apiKey), cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Anthropic Admin API returned ${res.status} on ${u.pathname}`);
    }
    const body = (await res.json()) as { data: T[]; has_more: boolean; next_page: string | null };
    buckets.push(...body.data);
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return buckets;
}

export interface LiveAnthropicSpend {
  byModel: ModelSpend[];
  daily: DailySpend[];
  totalCostUsd: number;
}

/**
 * Pulls month-to-date spend. Costs come from the cost report (authoritative
 * USD); token counts from the usage report grouped by model.
 */
export async function fetchAnthropicSpend(adminKey: string, start: Date, end: Date): Promise<LiveAnthropicSpend> {
  const usageUrl = new URL(`${ANTHROPIC_API}/v1/organizations/usage_report/messages`);
  usageUrl.searchParams.set("starting_at", start.toISOString());
  usageUrl.searchParams.set("ending_at", end.toISOString());
  usageUrl.searchParams.set("bucket_width", "1d");
  usageUrl.searchParams.set("limit", "31");
  usageUrl.searchParams.append("group_by[]", "model");

  const costUrl = new URL(`${ANTHROPIC_API}/v1/organizations/cost_report`);
  costUrl.searchParams.set("starting_at", start.toISOString());
  costUrl.searchParams.set("ending_at", end.toISOString());
  costUrl.searchParams.set("limit", "31");
  costUrl.searchParams.append("group_by[]", "description");

  const [usage, cost] = await Promise.all([
    fetchAllBuckets<UsageBucket>(usageUrl, adminKey),
    fetchAllBuckets<CostBucket>(costUrl, adminKey),
  ]);

  const byModel = new Map<string, ModelSpend>();
  for (const bucket of usage) {
    for (const r of bucket.results) {
      const model = r.model ?? "unknown";
      const row = byModel.get(model) ?? {
        model,
        uncachedInputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        outputTokens: 0,
        costUsd: 0,
      };
      row.uncachedInputTokens += r.uncached_input_tokens ?? 0;
      row.cacheReadTokens += r.cache_read_input_tokens ?? 0;
      row.cacheCreationTokens +=
        (r.cache_creation?.ephemeral_1h_input_tokens ?? 0) + (r.cache_creation?.ephemeral_5m_input_tokens ?? 0);
      row.outputTokens += r.output_tokens ?? 0;
      byModel.set(model, row);
    }
  }

  const daily: DailySpend[] = [];
  let total = 0;
  for (const bucket of cost) {
    let dayTotal = 0;
    for (const r of bucket.results) {
      const usd = parseFloat(r.amount) / 100;
      if (!isFinite(usd)) continue;
      dayTotal += usd;
      if (r.model) {
        const row = byModel.get(r.model);
        if (row) row.costUsd += usd;
        else byModel.set(r.model, { model: r.model, uncachedInputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, outputTokens: 0, costUsd: usd });
      }
    }
    daily.push({ date: bucket.starting_at.slice(0, 10), costUsd: round2(dayTotal) });
    total += dayTotal;
  }

  // Fill any model rows the cost report did not attribute (e.g. non-token costs) with an estimate.
  for (const row of byModel.values()) {
    if (row.costUsd === 0) row.costUsd = round2(estimateCostUsd(row));
    else row.costUsd = round2(row.costUsd);
  }

  return {
    byModel: Array.from(byModel.values()).sort((a, b) => b.costUsd - a.costUsd),
    daily,
    totalCostUsd: round2(total),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
