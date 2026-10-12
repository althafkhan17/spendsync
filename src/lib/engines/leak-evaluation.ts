/**
 * Financial leak evaluation.
 *
 * For every seat-based integration with a detected leak, checks whether the
 * related subscription renews within the next 7 days and, if so, emails the
 * workspace owner (throttled to once per 5 days).
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getAppUrl, getResendFrom, isResendConfigured } from "@/lib/env";
import { providerLabel, SEAT_PROVIDERS } from "@/lib/providers/labels";
import { renderLeakAlertEmail } from "@/emails/LeakAlertTemplate";

const DAY_MS = 24 * 60 * 60 * 1000;
export const LEAK_WARNING_WINDOW_DAYS = 7;
export const LEAK_WARNING_THROTTLE_DAYS = 5;

export interface LeakEvaluation {
  integrationId: string;
  workspaceName: string;
  provider: string;
  wastedAmount: number;
  currency: string;
  daysRemaining: number;
  projectedRenewalDate: string;
  isNearRenewal: boolean;
  passesThrottle: boolean;
  emailSent?: boolean;
  recipientEmail?: string;
}

export interface LeakEvaluationSummary {
  processedCount: number;
  flagged: LeakEvaluation[];
  skipped: LeakEvaluation[];
}

function matchesProvider(merchant: string, provider: string): boolean {
  const name = merchant.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (provider === "GITHUB_COPILOT") return name.includes("copilot") || name === "github";
  if (provider === "FIGMA") return name.includes("figma");
  return name === provider.toLowerCase();
}

export async function evaluateLeaks(opts: { workspaceId?: string } = {}): Promise<LeakEvaluationSummary> {
  const integrations = await prisma.integration.findMany({
    where: {
      isActive: true,
      provider: { in: [...SEAT_PROVIDERS] },
      wastedAmount: { gt: 0 },
      ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}),
    },
    include: {
      workspace: {
        include: {
          subscriptions: { where: { status: "ACTIVE" } },
          emailLogs: { where: { wasReceipt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          members: { include: { user: true } },
        },
      },
    },
  });

  console.log(`⚙️  Leak evaluation: ${integrations.length} integration(s) with an active leak`);
  const flagged: LeakEvaluation[] = [];
  const skipped: LeakEvaluation[] = [];
  const now = new Date();

  for (const integration of integrations) {
    const workspace = integration.workspace;
    const subscription = workspace.subscriptions.find((s) => matchesProvider(s.merchantName, integration.provider));

    let projectedRenewalDate: Date;
    if (subscription) {
      projectedRenewalDate = new Date(subscription.nextRenewalDate);
    } else {
      // Fall back to the last receipt we saw, projected one billing cycle out.
      const baseline = workspace.emailLogs[0]?.createdAt ?? integration.createdAt;
      projectedRenewalDate = new Date(new Date(baseline).getTime() + 30 * DAY_MS);
    }

    const daysRemaining = Math.ceil((projectedRenewalDate.getTime() - now.getTime()) / DAY_MS);
    const isNearRenewal = daysRemaining >= 1 && daysRemaining <= LEAK_WARNING_WINDOW_DAYS;
    const passesThrottle =
      !integration.lastWarningSentAt ||
      new Date(integration.lastWarningSentAt).getTime() < now.getTime() - LEAK_WARNING_THROTTLE_DAYS * DAY_MS;

    const evaluation: LeakEvaluation = {
      integrationId: integration.id,
      workspaceName: workspace.name,
      provider: integration.provider,
      wastedAmount: Number(integration.wastedAmount),
      currency: subscription?.currency ?? "USD",
      daysRemaining,
      projectedRenewalDate: projectedRenewalDate.toISOString(),
      isNearRenewal,
      passesThrottle,
    };

    if (!(isNearRenewal && passesThrottle)) {
      skipped.push(evaluation);
      continue;
    }

    const owner = workspace.members.find((m) => m.role === "OWNER") ?? workspace.members[0];
    const to = owner?.user?.email ?? null;
    const adminName = owner?.user?.name || (to ? to.split("@")[0] : "Workspace Owner");
    let emailSent = false;

    if (!to) {
      console.warn(`  ⚠️ ${workspace.name}: no owner email`);
    } else if (!isResendConfigured()) {
      console.log(`  ✉️ [SIMULATED EMAIL] Leak alert to ${to}: ${providerLabel(integration.provider)} leaking ${evaluation.wastedAmount}`);
      emailSent = true;
    } else {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: getResendFrom(),
          to: [to],
          subject: `⚠️ Action required: ${providerLabel(integration.provider)} is leaking ${formatMoney(evaluation.wastedAmount, evaluation.currency)}/mo`,
          html: renderLeakAlertEmail({
            workspaceName: workspace.name,
            adminName,
            provider: integration.provider,
            wastedAmount: evaluation.wastedAmount,
            currency: evaluation.currency,
            daysRemaining,
            dashboardUrl: `${getAppUrl()}/dashboard/integrations`,
          }),
        });
        if (error) {
          const sandbox =
            error.statusCode === 403 &&
            (error.message?.includes("testing emails") || error.message?.includes("own email address"));
          if (sandbox) {
            console.log("  ⚠️ Resend sandbox restriction; treating as sent");
            emailSent = true;
          } else {
            console.error("  ❌ Resend error:", error);
          }
        } else if (data?.id) {
          emailSent = true;
          console.log(`  ✉️ Leak alert sent to ${to} (${data.id})`);
        }
      } catch (err) {
        console.error("  ❌ Email dispatch failed:", err instanceof Error ? err.message : err);
      }
    }

    if (emailSent) {
      await prisma.integration.update({ where: { id: integration.id }, data: { lastWarningSentAt: now } });
    }
    flagged.push({ ...evaluation, emailSent, recipientEmail: to ?? undefined });
  }

  console.log(`✅ Leak evaluation complete: flagged ${flagged.length}, skipped ${skipped.length}`);
  return { processedCount: integrations.length, flagged, skipped };
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
