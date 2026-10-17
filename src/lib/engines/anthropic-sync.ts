/**
 * Anthropic token-spend sync.
 *
 * Pulls month-to-date spend for every connected Anthropic organisation and
 * raises a budget alert when the workspace's threshold is crossed.
 *
 * Shared by the daily cron and the dashboard "Run Audit" button.
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import type { DailySpend, ModelSpend, TokenSpendReport } from "@/lib/audit-report";
import { simulateTokenUsage } from "@/lib/simulation";
import {
  estimateCostUsd,
  fetchAnthropicSpend,
  isDemoAnthropicKey,
  looksLikeAdminKey,
  round2,
} from "@/lib/providers/anthropic";
import { getAppUrl, getResendFrom, isResendConfigured } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
import { renderSpendAlertEmail } from "@/emails/SpendAlertTemplate";

export interface AnthropicSyncResult {
  integrationId: string;
  workspaceId: string;
  workspaceName: string;
  success: boolean;
  dataSource?: "LIVE" | "SIMULATED";
  totalCostUsd?: number;
  thresholdUsd?: number;
  alertTriggered?: boolean;
  alertSent?: boolean;
  error?: string;
}

export interface AnthropicSyncOptions {
  integrationId?: string;
  workspaceId?: string;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildSimulatedSpend(seed: string, start: Date, end: Date, thresholdUsd: number) {
  const dayMs = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs));
  const base = simulateTokenUsage(seed, daysElapsed, 1);
  const baseCost = base.byModel.reduce((sum, m) => sum + estimateCostUsd(m), 0);
  // Land the simulated month at ~82% of the budget so the gauge reads clearly
  // and lowering the threshold in a demo triggers the alert.
  const target = Math.max(1, thresholdUsd * 0.82);
  const factor = baseCost > 0 ? target / baseCost : 1;
  const byModel: ModelSpend[] = base.byModel.map((m) => {
    const scaled = {
      model: m.model,
      uncachedInputTokens: Math.round(m.uncachedInputTokens * factor),
      cacheReadTokens: Math.round(m.cacheReadTokens * factor),
      cacheCreationTokens: Math.round(m.cacheCreationTokens * factor),
      outputTokens: Math.round(m.outputTokens * factor),
    };
    return { ...scaled, costUsd: round2(estimateCostUsd(scaled)) };
  });
  const totalCostUsd = round2(byModel.reduce((s, m) => s + m.costUsd, 0));
  const weightSum = base.dailyWeights.reduce((s, w) => s + w, 0);
  const daily: DailySpend[] = base.dailyWeights.map((w, i) => ({
    date: toDateKey(new Date(start.getTime() + i * dayMs)),
    costUsd: round2((totalCostUsd * w) / weightSum),
  }));
  return { byModel, daily, totalCostUsd };
}

export async function runAnthropicSync(opts: AnthropicSyncOptions = {}): Promise<AnthropicSyncResult[]> {
  const integrations = await prisma.integration.findMany({
    where: {
      provider: "ANTHROPIC",
      isActive: true,
      ...(opts.integrationId ? { id: opts.integrationId } : {}),
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
    },
    include: { workspace: { include: { members: { include: { user: true } } } } },
  });

  console.log(`⏰ Anthropic sync: ${integrations.length} integration(s)`);
  const results: AnthropicSyncResult[] = [];
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (const integration of integrations) {
    const base = { integrationId: integration.id, workspaceId: integration.workspaceId, workspaceName: integration.workspace.name };
    try {
      if (!integration.accessToken) throw new Error("API key missing. Reconnect Anthropic.");
      const apiKey = decryptSecret(integration.accessToken);
      const thresholdUsd = Math.max(0.01, parseFloat(integration.refreshToken || "50") || 50);

      let dataSource: TokenSpendReport["dataSource"] = "SIMULATED";
      let keyKind: TokenSpendReport["keyKind"] = "STANDARD";
      let simulationReason: string | null = null;
      let spend: { byModel: ModelSpend[]; daily: DailySpend[]; totalCostUsd: number };

      if (isDemoAnthropicKey(apiKey)) {
        keyKind = "DEMO";
        simulationReason = "Demo key: the Anthropic API was not called. Connect an Admin API key (sk-ant-admin...) for live organization spend.";
        spend = buildSimulatedSpend(`${integration.workspaceId}:anthropic:${toDateKey(monthStart)}`, monthStart, now, thresholdUsd);
      } else if (looksLikeAdminKey(apiKey)) {
        keyKind = "ADMIN";
        try {
          spend = await fetchAnthropicSpend(apiKey, monthStart, now);
          dataSource = "LIVE";
          console.log(`  📡 Live spend for ${integration.workspace.name}: $${spend.totalCostUsd.toFixed(2)}`);
        } catch (err) {
          simulationReason = `${err instanceof Error ? err.message : "Admin API call failed"}. Showing simulated telemetry until the key is fixed.`;
          spend = buildSimulatedSpend(`${integration.workspaceId}:anthropic:${toDateKey(monthStart)}`, monthStart, now, thresholdUsd);
          console.warn(`  ⚠️ ${simulationReason}`);
        }
      } else {
        simulationReason =
          "Standard API key connected. Anthropic's Usage & Cost API requires an Admin API key (sk-ant-admin...), so month-to-date spend is simulated.";
        spend = buildSimulatedSpend(`${integration.workspaceId}:anthropic:${toDateKey(monthStart)}`, monthStart, now, thresholdUsd);
      }

      const report: TokenSpendReport = {
        kind: "TOKENS",
        version: 2,
        provider: "ANTHROPIC",
        dataSource,
        simulationReason,
        generatedAt: now.toISOString(),
        keyKind,
        period: { start: monthStart.toISOString(), end: now.toISOString() },
        totalCostUsd: spend.totalCostUsd,
        thresholdUsd,
        byModel: spend.byModel,
        daily: spend.daily,
      };

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          wastedAmount: spend.totalCostUsd,
          lastAuditAt: now,
          tokenUsageReport: JSON.stringify(report),
        },
      });

      // Budget alert, at most once per calendar month.
      const exceeded = spend.totalCostUsd > thresholdUsd;
      let alertSent = false;
      if (exceeded) {
        const last = integration.lastWarningSentAt ? new Date(integration.lastWarningSentAt) : null;
        const alreadyThisMonth =
          !!last && last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth();
        if (!alreadyThisMonth) {
          const owner = integration.workspace.members.find((m) => m.role === "OWNER") ?? integration.workspace.members[0];
          const to = owner?.user?.email;
          if (!to) {
            console.warn("  ⚠️ No owner email; skipping budget alert");
          } else if (!isResendConfigured()) {
            console.log(`  ✉️ [SIMULATED EMAIL] Budget alert to ${to}: $${spend.totalCostUsd.toFixed(2)} > $${thresholdUsd.toFixed(2)}`);
            alertSent = true;
          } else {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { error } = await resend.emails.send({
              from: getResendFrom(),
              to,
              subject: `⚠️ Anthropic spend is over budget: $${spend.totalCostUsd.toFixed(2)} of $${thresholdUsd.toFixed(2)}`,
              html: renderSpendAlertEmail({
                workspaceName: integration.workspace.name,
                adminName: owner?.user?.name || to.split("@")[0],
                totalCostUsd: spend.totalCostUsd,
                thresholdUsd,
                topModels: spend.byModel.slice(0, 3),
                dashboardUrl: `${getAppUrl()}/dashboard/integrations`,
                dataSource,
              }),
            });
            if (error) {
              console.error("  ❌ Resend error:", error);
            } else {
              alertSent = true;
              console.log(`  ✉️ Budget alert sent to ${to}`);
            }
          }
          if (alertSent) {
            await prisma.integration.update({ where: { id: integration.id }, data: { lastWarningSentAt: now } });
          }
        } else {
          console.log("  ℹ️ Budget alert already sent this month");
        }
      }

      results.push({
        ...base,
        success: true,
        dataSource,
        totalCostUsd: spend.totalCostUsd,
        thresholdUsd,
        alertTriggered: exceeded,
        alertSent,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ${integration.workspace.name}: ${message}`);
      results.push({ ...base, success: false, error: message });
    }
  }

  return results;
}
