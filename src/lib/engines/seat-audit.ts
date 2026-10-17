/**
 * Seat optimizer engine.
 *
 * Compares the seats a workspace is billed for (from the latest parsed
 * invoice) against the seats that are actually active (from the vendor API)
 * and records the difference as a monthly leak.
 *
 * Shared by the daily cron and the dashboard "Run Audit" button.
 */

import { prisma } from "@/lib/prisma";
import { decryptOptionalSecret, decryptSecret, encryptSecret } from "@/lib/crypto";
import type { SeatAuditReport, SeatRecord } from "@/lib/audit-report";
import { simulateSeats } from "@/lib/simulation";
import {
  GithubApiError,
  copilotListPrice,
  describeGithubStatus,
  fetchCopilotBilling,
  fetchCopilotSeats,
  isMockGithubToken,
  toSeatRecords,
} from "@/lib/providers/github-copilot";
import {
  FIGMA_SIMULATION_REASON,
  FigmaApiError,
  fetchFigmaMe,
  isMockFigmaToken,
  refreshFigmaToken,
} from "@/lib/providers/figma";

export const IDLE_THRESHOLD_DAYS = 30;

const DEFAULTS: Record<"FIGMA" | "GITHUB_COPILOT", { seats: number; unitPrice: number; aliases: string[] }> = {
  FIGMA: { seats: 12, unitPrice: 15, aliases: ["figma"] },
  GITHUB_COPILOT: { seats: 10, unitPrice: 19, aliases: ["github copilot", "github_copilot", "copilot", "github"] },
};

export interface SeatAuditResult {
  integrationId: string;
  workspaceId: string;
  workspaceName: string;
  provider: string;
  status: "SUCCESS" | "FAILED";
  dataSource?: "LIVE" | "SIMULATED";
  billedSeats?: number;
  activeSeats?: number;
  wastedSeats?: number;
  wastedAmount?: number;
  currency?: string;
  error?: string;
}

export interface SeatAuditOptions {
  /** Restrict to a single integration (manual trigger). */
  integrationId?: string;
  /** Restrict to one workspace. */
  workspaceId?: string;
}

type SubscriptionLite = {
  merchantName: string;
  currency: string;
  billedSeats: number | null;
  seatUnitPrice: unknown;
  amount: unknown;
};

function findSubscription(subs: SubscriptionLite[], provider: "FIGMA" | "GITHUB_COPILOT") {
  const aliases = DEFAULTS[provider].aliases;
  const normalised = subs.map((s) => ({ s, name: s.merchantName.toLowerCase().replace(/[_-]+/g, " ").trim() }));
  // Prefer the most specific alias first (e.g. "github copilot" over "github").
  for (const alias of aliases) {
    const hit = normalised.find((n) => n.name === alias || n.name.includes(alias));
    if (hit) return hit.s;
  }
  return null;
}

function summarise(seats: SeatRecord[]) {
  const activeSeats = seats.filter((s) => s.status === "ACTIVE").length;
  const idleSeats = seats.filter((s) => s.status === "IDLE" || s.status === "NEVER_ACTIVE").length;
  return { activeSeats, idleSeats };
}

export async function runSeatAudit(opts: SeatAuditOptions = {}): Promise<SeatAuditResult[]> {
  const integrations = await prisma.integration.findMany({
    where: {
      provider: { in: ["FIGMA", "GITHUB_COPILOT"] },
      isActive: true,
      ...(opts.integrationId ? { id: opts.integrationId } : {}),
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
    },
    include: {
      workspace: {
        include: {
          subscriptions: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } },
        },
      },
    },
  });

  console.log(`⚙️  Seat optimizer: auditing ${integrations.length} integration(s)`);
  const results: SeatAuditResult[] = [];

  for (const integration of integrations) {
    const provider = integration.provider as "FIGMA" | "GITHUB_COPILOT";
    const base: SeatAuditResult = {
      integrationId: integration.id,
      workspaceId: integration.workspaceId,
      workspaceName: integration.workspace.name,
      provider,
      status: "FAILED",
    };
    try {
      const subscription = findSubscription(integration.workspace.subscriptions, provider);
      const defaults = DEFAULTS[provider];

      let billedSeats = defaults.seats;
      let billedSeatsSource: SeatAuditReport["billedSeatsSource"] = "DEFAULT";
      let seatUnitPrice = defaults.unitPrice;
      let currency = "USD";
      if (subscription) {
        currency = subscription.currency || "USD";
        if (subscription.billedSeats && subscription.billedSeats > 0) {
          billedSeats = subscription.billedSeats;
          billedSeatsSource = "INVOICE";
        }
        const unit = Number(subscription.seatUnitPrice);
        if (unit > 0) seatUnitPrice = unit;
        else if (subscription.billedSeats && subscription.billedSeats > 0) {
          seatUnitPrice = Number(subscription.amount) / subscription.billedSeats;
        }
      }

      let seats: SeatRecord[] = [];
      let dataSource: SeatAuditReport["dataSource"] = "SIMULATED";
      let simulationReason: string | null = null;
      let planType: string | null = null;
      const settings: Record<string, string | null> = {};

      if (provider === "GITHUB_COPILOT") {
        const orgSlug = integration.refreshToken ?? "";
        if (!orgSlug) throw new Error("GitHub organization slug is missing. Reconnect the integration.");
        const token = decryptSecret(integration.accessToken);

        if (isMockGithubToken(token)) {
          simulationReason = "Demo token: the GitHub API was not called. Connect a fine-grained PAT with Copilot billing access for live seat data.";
        } else {
          try {
            const [billing, apiSeats] = await Promise.all([
              fetchCopilotBilling(orgSlug, token),
              fetchCopilotSeats(orgSlug, token),
            ]);
            seats = toSeatRecords(apiSeats, IDLE_THRESHOLD_DAYS);
            dataSource = "LIVE";
            planType = billing.plan_type ?? null;
            settings.publicCodeSuggestions = billing.public_code_suggestions ?? null;
            settings.seatManagement = billing.seat_management_setting ?? null;
            settings.ideChat = billing.ide_chat ?? null;
            if (billing.seat_breakdown?.total > 0) {
              billedSeats = billing.seat_breakdown.total;
              billedSeatsSource = "VENDOR_API";
            }
            if (!subscription || !(Number(subscription.seatUnitPrice) > 0)) {
              seatUnitPrice = copilotListPrice(planType);
              currency = "USD";
            }
            console.log(`  ✅ ${orgSlug}: ${seats.length} Copilot seats fetched live (plan: ${planType ?? "unknown"})`);
          } catch (err) {
            const status = err instanceof GithubApiError ? err.status : 0;
            simulationReason = status
              ? describeGithubStatus(status, orgSlug)
              : "Could not reach the GitHub API. Seat activity is simulated for this audit.";
            console.warn(`  ⚠️ ${orgSlug}: ${simulationReason}`);
          }
        }
      } else {
        // FIGMA
        let accessToken = decryptSecret(integration.accessToken);
        const storedRefreshToken = decryptOptionalSecret(integration.refreshToken);
        const expiresAt = integration.tokenExpiresAt ? new Date(integration.tokenExpiresAt).getTime() : null;
        const nearExpiry = expiresAt !== null && expiresAt - Date.now() < 5 * 60 * 1000;
        if (nearExpiry && storedRefreshToken) {
          const refreshed = await refreshFigmaToken(storedRefreshToken);
          accessToken = refreshed.access_token;
          await prisma.integration.update({
            where: { id: integration.id },
            data: {
              accessToken: encryptSecret(accessToken),
              refreshToken: encryptSecret(refreshed.refresh_token ?? storedRefreshToken),
              tokenExpiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
            },
          });
          console.log("  🔑 Figma token refreshed");
        }
        if (isMockFigmaToken(accessToken)) {
          simulationReason = "Demo token: Figma was not called. " + FIGMA_SIMULATION_REASON;
        } else {
          try {
            const me = await fetchFigmaMe(accessToken);
            settings.verifiedAccount = me.email ?? me.handle ?? null;
            simulationReason = FIGMA_SIMULATION_REASON;
            console.log(`  ✅ Figma token verified for ${me.handle}`);
          } catch (err) {
            const status = err instanceof FigmaApiError ? err.status : 0;
            simulationReason =
              status === 401 || status === 403
                ? "Figma rejected the stored token. Reconnect Figma to restore verification. " + FIGMA_SIMULATION_REASON
                : "Could not reach the Figma API. " + FIGMA_SIMULATION_REASON;
            console.warn(`  ⚠️ Figma: ${simulationReason}`);
          }
        }
      }

      if (dataSource === "SIMULATED") {
        seats = simulateSeats(`${integration.workspaceId}:${provider}`, billedSeats, IDLE_THRESHOLD_DAYS);
      }

      const { activeSeats, idleSeats } = summarise(seats);
      const wastedSeats = Math.max(0, Math.min(idleSeats, billedSeats));
      const wastedAmount = Math.round(wastedSeats * seatUnitPrice * 100) / 100;

      const report: SeatAuditReport = {
        kind: "SEATS",
        version: 2,
        provider,
        dataSource,
        simulationReason,
        generatedAt: new Date().toISOString(),
        currency,
        seatUnitPrice: Math.round(seatUnitPrice * 100) / 100,
        billedSeats,
        billedSeatsSource,
        activeSeats,
        idleSeats,
        idleThresholdDays: IDLE_THRESHOLD_DAYS,
        planType,
        settings,
        seats,
      };

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastAuditAt: new Date(),
          billedSeats,
          activeSeats,
          wastedSeats,
          wastedAmount,
          tokenUsageReport: JSON.stringify(report),
        },
      });

      console.log(
        `  💾 ${integration.workspace.name} / ${provider}: billed ${billedSeats}, active ${activeSeats}, idle ${wastedSeats} → ${wastedAmount} ${currency}/mo (${dataSource})`
      );
      results.push({ ...base, status: "SUCCESS", dataSource, billedSeats, activeSeats, wastedSeats, wastedAmount, currency });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${integration.workspace.name} / ${provider}: ${message}`);
      results.push({ ...base, error: message });
    }
  }

  return results;
}
