/**
 * Renewal alerting engine.
 *
 * Emails the workspace owner for every active subscription that renews in
 * exactly `daysAhead` days (default 7).
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getAppUrl, getResendFrom, isResendConfigured } from "@/lib/env";
import { renderRenewalAlertEmail } from "@/emails/RenewalAlertTemplate";
import { formatMoney } from "@/lib/engines/leak-evaluation";

export interface RenewalAlertSummary {
  matched: number;
  emailsSent: number;
  simulated: boolean;
  details: Array<{ subscriptionId: string; merchantName: string; to: string | null; sent: boolean }>;
}

export async function runRenewalAlerts(daysAhead = 7): Promise<RenewalAlertSummary> {
  const target = new Date();
  target.setDate(target.getDate() + daysAhead);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(target);
  end.setHours(23, 59, 59, 999);

  const subscriptions = await prisma.subscription.findMany({
    where: { status: "ACTIVE", nextRenewalDate: { gte: start, lte: end } },
    include: {
      workspace: { include: { members: { where: { role: "OWNER" }, include: { user: true } } } },
    },
  });

  console.log(`⏰ Renewal alerts: ${subscriptions.length} subscription(s) renew in ${daysAhead} day(s)`);
  const simulated = !isResendConfigured();
  const resend = simulated ? null : new Resend(process.env.RESEND_API_KEY);
  const details: RenewalAlertSummary["details"] = [];

  for (const sub of subscriptions) {
    const owner = sub.workspace.members[0];
    const to = owner?.user?.email ?? null;
    if (!to) {
      details.push({ subscriptionId: sub.id, merchantName: sub.merchantName, to: null, sent: false });
      continue;
    }
    const amount = Number(sub.amount);
    const html = renderRenewalAlertEmail({
      adminName: owner.user.name || to.split("@")[0],
      workspaceName: sub.workspace.name,
      merchantName: sub.merchantName,
      amountLabel: formatMoney(amount, sub.currency),
      billingCycle: sub.billingCycle,
      renewalDate: sub.nextRenewalDate,
      daysAhead,
      seats: sub.billedSeats,
      dashboardUrl: `${getAppUrl()}/dashboard/subscriptions`,
    });
    if (simulated || !resend) {
      console.log(`  ✉️ [SIMULATED EMAIL] Renewal alert to ${to} for ${sub.merchantName}`);
      details.push({ subscriptionId: sub.id, merchantName: sub.merchantName, to, sent: true });
      continue;
    }
    const { error } = await resend.emails.send({
      from: getResendFrom(),
      to,
      subject: `Renewal in ${daysAhead} days: ${sub.merchantName} (${formatMoney(amount, sub.currency)})`,
      html,
    });
    if (error) console.error(`  ❌ Resend error for ${sub.merchantName}:`, error);
    else console.log(`  ✉️ Renewal alert sent to ${to} for ${sub.merchantName}`);
    details.push({ subscriptionId: sub.id, merchantName: sub.merchantName, to, sent: !error });
  }

  return {
    matched: subscriptions.length,
    emailsSent: details.filter((d) => d.sent).length,
    simulated,
    details,
  };
}
