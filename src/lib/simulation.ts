/**
 * Deterministic simulation helpers.
 *
 * When a vendor API cannot be queried (missing scope, non-admin key, demo
 * token) SpendSync still needs something coherent to show. Everything here is
 * seeded from the workspace id so the demo data is stable across refreshes
 * and never looks like random noise. Callers MUST label the output as
 * SIMULATED via the report's `dataSource`.
 */

import type { SeatRecord, SeatStatus } from "@/lib/audit-report";

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG: small, fast, deterministic. */
export function createRng(seed: string): () => number {
  let a = hashString(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HANDLES = [
  "priya.n", "marcus.dev", "sam-infra", "elena.k", "ravi.builds", "jordan.ui",
  "ayesha.m", "leo.ops", "nina.codes", "tomasz.w", "fatima.q", "diego.r",
  "hannah.s", "kenji.t", "zara.a", "omar.h", "ivy.l", "noah.b", "mei.c", "arjun.v",
  "lucas.f", "sofia.g", "ethan.j", "maya.p", "ibrahim.s",
];

const EDITORS = [
  "vscode/1.104.0",
  "jetbrains-idea/2026.2",
  "neovim/0.11",
  "vscode-insiders/1.105.0",
  "visualstudio/17.14",
];

export function simulateSeats(seed: string, billedSeats: number, idleThresholdDays = 30): SeatRecord[] {
  const rng = createRng(seed);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const count = Math.max(1, Math.min(billedSeats, 60));
  // Roughly a third of seats idle, which is realistic for an un-audited org.
  const idleTarget = Math.max(1, Math.round(count * (0.25 + rng() * 0.2)));
  const seats: SeatRecord[] = [];
  for (let i = 0; i < count; i++) {
    const suffix = i >= HANDLES.length ? `-${Math.floor(i / HANDLES.length) + 1}` : "";
    const username = HANDLES[i % HANDLES.length] + suffix;
    const createdAt = new Date(now - (60 + Math.floor(rng() * 300)) * day).toISOString();
    let status: SeatStatus;
    let lastActivityAt: string | null;
    if (i < count - idleTarget) {
      status = "ACTIVE";
      lastActivityAt = new Date(
        now - Math.floor(rng() * (idleThresholdDays - 2)) * day - Math.floor(rng() * 86_000_000)
      ).toISOString();
    } else if (rng() < 0.3) {
      status = "NEVER_ACTIVE";
      lastActivityAt = null;
    } else {
      status = "IDLE";
      lastActivityAt = new Date(now - (idleThresholdDays + 3 + Math.floor(rng() * 90)) * day).toISOString();
    }
    seats.push({
      username,
      status,
      lastActivityAt,
      lastActivityEditor: lastActivityAt ? EDITORS[Math.floor(rng() * EDITORS.length)] : null,
      createdAt,
      planType: "business",
      pendingCancellationDate: null,
    });
  }
  // Interleave so idle seats are not all clustered at the bottom.
  return seats.sort(() => rng() - 0.5);
}

export interface SimulatedTokenUsage {
  model: string;
  uncachedInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
}

/**
 * Produces month-to-date usage for a small team. `scale` nudges total spend so
 * the demo can land either comfortably under or just over a threshold.
 */
export function simulateTokenUsage(
  seed: string,
  daysElapsed: number,
  scale = 1
): { byModel: SimulatedTokenUsage[]; dailyWeights: number[] } {
  const rng = createRng(seed);
  const days = Math.max(1, daysElapsed);
  const dailyWeights: number[] = [];
  for (let d = 0; d < days; d++) {
    const isWeekend = d % 7 === 5 || d % 7 === 6;
    dailyWeights.push((isWeekend ? 0.35 : 1) * (0.6 + rng() * 0.8));
  }
  const perDay = scale * days;
  const byModel: SimulatedTokenUsage[] = [
    {
      model: "claude-opus-5-5",
      uncachedInputTokens: Math.round(perDay * 380_000),
      cacheReadTokens: Math.round(perDay * 1_900_000),
      cacheCreationTokens: Math.round(perDay * 240_000),
      outputTokens: Math.round(perDay * 95_000),
    },
    {
      model: "claude-sonnet-5-5",
      uncachedInputTokens: Math.round(perDay * 1_150_000),
      cacheReadTokens: Math.round(perDay * 4_200_000),
      cacheCreationTokens: Math.round(perDay * 520_000),
      outputTokens: Math.round(perDay * 310_000),
    },
    {
      model: "claude-haiku-5-5",
      uncachedInputTokens: Math.round(perDay * 6_800_000),
      cacheReadTokens: Math.round(perDay * 9_500_000),
      cacheCreationTokens: Math.round(perDay * 400_000),
      outputTokens: Math.round(perDay * 1_900_000),
    },
  ];
  return { byModel, dailyWeights };
}
