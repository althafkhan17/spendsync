/**
 * Sample data for the public /demo route.
 *
 * Everything here is generated in memory on each request: no database access,
 * no Clerk session. Dates are relative to "now" so the renewal radar and leak
 * warnings always look current. Integration reports are built with the same
 * deterministic simulator the real app uses and are labelled SIMULATED.
 */

import { Prisma } from "@prisma/client";
import type { SubscriptionRow } from "@/app/actions/subscriptions";
import type { EmailLogRow } from "@/app/actions/emails";
import type { IntegrationRow } from "@/app/actions/integrations";
import type { WorkspaceDetails } from "@/app/actions/workspace";
import type { DailySpend, ModelSpend, SeatAuditReport, TokenSpendReport } from "@/lib/audit-report";
import { simulateSeats, simulateTokenUsage } from "@/lib/simulation";
import { estimateCostUsd, round2 } from "@/lib/providers/anthropic";
import { getWorkspaceRoutingEmail } from "@/lib/env";

export const DEMO_WORKSPACE_ID = "00000000-0000-4000-8000-00000000demo";
export const DEMO_WORKSPACE_NAME = "Northwind Studio";
export const DEMO_FIRST_NAME = "Alex";
export const DEMO_SIMULATION_REASON =
  "Demo mode: this is sample data generated for the public demo. Connect a real token in your own workspace to see live numbers.";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);
const agoDays = (n: number) => new Date(Date.now() - n * DAY);
const agoHours = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

type Seed = {
  merchantName: string;
  seats: number;
  unit: number;
  cycle: "MONTHLY" | "ANNUAL";
  renewIn: number;
  status?: "ACTIVE" | "CANCELLED" | "NEEDS_REVIEW";
  currency?: string;
  sender: string;
  subject: string;
  source: "PDF" | "TEXT";
  confidence: number;
  receivedDaysAgo: number;
};

/** A realistic design-agency stack with renewals spread across every alert window. */
const STACK: Seed[] = [
  { merchantName: "Figma", seats: 15, unit: 15, cycle: "MONTHLY", renewIn: 6, sender: "Figma <billing@figma.com>", subject: "Your Figma invoice for Professional plan", source: "PDF", confidence: 0.96, receivedDaysAgo: 24 },
  { merchantName: "GitHub Copilot", seats: 12, unit: 19, cycle: "MONTHLY", renewIn: 11, sender: "GitHub <billing@github.com>", subject: "[GitHub] Your Copilot Business receipt", source: "PDF", confidence: 0.94, receivedDaysAgo: 19 },
  { merchantName: "Slack", seats: 18, unit: 8.75, cycle: "MONTHLY", renewIn: 21, sender: "Slack <feedback@slack.com>", subject: "Your Slack Pro invoice is available", source: "PDF", confidence: 0.93, receivedDaysAgo: 9 },
  { merchantName: "Notion", seats: 14, unit: 10, cycle: "MONTHLY", renewIn: 27, sender: "Notion <team@makenotion.com>", subject: "Receipt for Notion Plus", source: "TEXT", confidence: 0.9, receivedDaysAgo: 3 },
  { merchantName: "Zoom", seats: 6, unit: 15.99, cycle: "MONTHLY", renewIn: 9, sender: "Zoom <no-reply@zoom.us>", subject: "Zoom Workplace Pro: payment confirmation", source: "TEXT", confidence: 0.88, receivedDaysAgo: 21 },
  { merchantName: "Linear", seats: 12, unit: 14, cycle: "MONTHLY", renewIn: 18, sender: "Linear <billing@linear.app>", subject: "Linear Business invoice", source: "PDF", confidence: 0.95, receivedDaysAgo: 12 },
  { merchantName: "Vercel", seats: 3, unit: 20, cycle: "MONTHLY", renewIn: 4, sender: "Vercel <invoice@vercel.com>", subject: "Your receipt from Vercel Pro", source: "PDF", confidence: 0.97, receivedDaysAgo: 26 },
  { merchantName: "AWS", seats: 1, unit: 412.37, cycle: "MONTHLY", renewIn: 15, sender: "Amazon Web Services <no-reply@amazon.com>", subject: "Amazon Web Services Billing Statement Available", source: "PDF", confidence: 0.81, receivedDaysAgo: 15 },
  { merchantName: "Google Workspace", seats: 20, unit: 168, cycle: "ANNUAL", renewIn: 45, sender: "Google Workspace <payments-noreply@google.com>", subject: "Your Google Workspace annual invoice", source: "PDF", confidence: 0.92, receivedDaysAgo: 320 },
  { merchantName: "Razorpay", seats: 1, unit: 4999, cycle: "MONTHLY", renewIn: 23, currency: "INR", sender: "Razorpay <no-reply@razorpay.com>", subject: "Tax invoice for Razorpay subscription", source: "PDF", confidence: 0.9, receivedDaysAgo: 7 },
  { merchantName: "Loom", seats: 5, unit: 12.5, cycle: "MONTHLY", renewIn: 13, status: "NEEDS_REVIEW", sender: "Loom <support@loom.com>", subject: "Thanks for your purchase", source: "TEXT", confidence: 0.42, receivedDaysAgo: 17 },
  { merchantName: "Miro", seats: 8, unit: 10, cycle: "MONTHLY", renewIn: 2, status: "CANCELLED", sender: "Miro <noreply@miro.com>", subject: "Your Miro subscription receipt", source: "TEXT", confidence: 0.91, receivedDaysAgo: 28 },
];

const NON_RECEIPTS = [
  { sender: "Product Hunt <hello@producthunt.com>", subject: "Top launches this week", body: "This week's most upvoted launches, hand-picked by the community…", daysAgo: 1 },
  { sender: "Stripe <no-reply@stripe.com>", subject: "Weekly payouts summary", body: "Your payouts for the week are on their way. Nothing else to do.", daysAgo: 5 },
];

function subscriptionId(i: number) {
  return `demo-sub-${String(i + 1).padStart(2, "0")}`;
}

export function getDemoSubscriptions(): SubscriptionRow[] {
  return STACK.map((s, i) => ({
    id: subscriptionId(i),
    merchantName: s.merchantName,
    amount: new Prisma.Decimal(round2(s.seats * s.unit)),
    currency: s.currency ?? "USD",
    billingCycle: s.cycle,
    status: s.status ?? "ACTIVE",
    nextRenewalDate: inDays(s.renewIn),
    createdAt: agoDays(s.receivedDaysAgo),
  }));
}

export function getDemoEmailLogs(): EmailLogRow[] {
  const receipts: EmailLogRow[] = STACK.map((s, i) => {
    const amount = round2(s.seats * s.unit);
    const currency = s.currency ?? "USD";
    const extraction = {
      vendorName: s.merchantName.toUpperCase(),
      primaryBilledSeats: s.seats,
      seatUnitPrice: s.unit,
      currency,
      billingCycle: s.cycle,
      invoiceDate: agoDays(s.receivedDaysAgo).toISOString().slice(0, 10),
      renewalDate: inDays(s.renewIn).toISOString().slice(0, 10),
      confidence: s.confidence,
      extractionNotes: s.confidence < 0.5 ? "No explicit seat count found; defaulted from plan description." : null,
    };
    return {
      id: `demo-log-${String(i + 1).padStart(2, "0")}`,
      senderEmail: s.sender,
      subject: s.subject,
      bodyPreview: `Thanks for your payment. ${s.merchantName} ${s.cycle === "ANNUAL" ? "annual" : "monthly"} plan, ${s.seats} seat${s.seats === 1 ? "" : "s"} at ${s.unit} ${currency} each. Your next renewal is ${extraction.renewalDate}.`,
      source: s.source,
      attachmentName: s.source === "PDF" ? `${s.merchantName.toLowerCase().replace(/\s+/g, "-")}-invoice.pdf` : null,
      wasReceipt: true,
      merchantName: s.merchantName.toUpperCase(),
      amount,
      currency,
      confidenceScore: s.confidence,
      createdAt: agoDays(s.receivedDaysAgo),
      subscriptionId: subscriptionId(i),
      subscription: { merchantName: s.merchantName },
    };
  });

  const others: EmailLogRow[] = NON_RECEIPTS.map((n, i) => ({
    id: `demo-log-x${i + 1}`,
    senderEmail: n.sender,
    subject: n.subject,
    bodyPreview: n.body,
    source: "TEXT",
    attachmentName: null,
    wasReceipt: false,
    merchantName: null,
    amount: null,
    currency: "USD",
    confidenceScore: 0,
    createdAt: agoDays(n.daysAgo),
    subscriptionId: null,
    subscription: null,
  }));

  return [...receipts, ...others].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function seatReport(provider: "FIGMA" | "GITHUB_COPILOT", billedSeats: number, seatUnitPrice: number, planType: string | null): SeatAuditReport {
  const seats = simulateSeats(`demo:${provider}`, billedSeats, 30);
  const activeSeats = seats.filter((s) => s.status === "ACTIVE").length;
  const idleSeats = seats.filter((s) => s.status === "IDLE" || s.status === "NEVER_ACTIVE").length;
  return {
    kind: "SEATS",
    version: 2,
    provider,
    dataSource: "SIMULATED",
    simulationReason: DEMO_SIMULATION_REASON,
    generatedAt: agoHours(3).toISOString(),
    currency: "USD",
    seatUnitPrice,
    billedSeats,
    billedSeatsSource: "INVOICE",
    activeSeats,
    idleSeats,
    idleThresholdDays: 30,
    planType,
    settings: provider === "GITHUB_COPILOT" ? { publicCodeSuggestions: "block", seatManagement: "assign_selected", ideChat: "enabled" } : {},
    seats,
  };
}

function tokenReport(thresholdUsd: number): TokenSpendReport {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / DAY));
  const base = simulateTokenUsage("demo:anthropic", daysElapsed, 1);
  const baseCost = base.byModel.reduce((sum, m) => sum + estimateCostUsd(m), 0);
  const factor = baseCost > 0 ? (thresholdUsd * 0.82) / baseCost : 1;
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
    date: new Date(monthStart.getTime() + i * DAY).toISOString().slice(0, 10),
    costUsd: round2((totalCostUsd * w) / weightSum),
  }));
  return {
    kind: "TOKENS",
    version: 2,
    provider: "ANTHROPIC",
    dataSource: "SIMULATED",
    simulationReason: DEMO_SIMULATION_REASON,
    generatedAt: agoHours(1).toISOString(),
    keyKind: "DEMO",
    period: { start: monthStart.toISOString(), end: now.toISOString() },
    totalCostUsd,
    thresholdUsd,
    byModel,
    daily,
  };
}

export function getDemoIntegrations(): IntegrationRow[] {
  const copilot = seatReport("GITHUB_COPILOT", 12, 19, "business");
  const figma = seatReport("FIGMA", 15, 15, null);
  const anthropic = tokenReport(50);
  const row = (
    id: string,
    provider: string,
    report: SeatAuditReport | TokenSpendReport,
    extra: Partial<IntegrationRow>,
    createdDaysAgo: number
  ): IntegrationRow => ({
    id,
    provider,
    isActive: true,
    lastAuditAt: report.generatedAt,
    createdAt: agoDays(createdDaysAgo).toISOString(),
    wastedSeats: null,
    wastedAmount: null,
    billedSeats: null,
    activeSeats: null,
    tokenUsageReport: JSON.stringify(report),
    refreshToken: null,
    ...extra,
  });
  return [
    row("demo-int-copilot", "GITHUB_COPILOT", copilot, {
      wastedSeats: copilot.idleSeats,
      wastedAmount: round2(copilot.idleSeats * copilot.seatUnitPrice),
      billedSeats: copilot.billedSeats,
      activeSeats: copilot.activeSeats,
      refreshToken: "northwind-studio",
    }, 40),
    row("demo-int-figma", "FIGMA", figma, {
      wastedSeats: figma.idleSeats,
      wastedAmount: round2(figma.idleSeats * figma.seatUnitPrice),
      billedSeats: figma.billedSeats,
      activeSeats: figma.activeSeats,
    }, 38),
    row("demo-int-anthropic", "ANTHROPIC", anthropic, {
      wastedAmount: anthropic.totalCostUsd,
      refreshToken: anthropic.thresholdUsd.toFixed(2),
    }, 12),
  ];
}

export function getDemoWorkspace(): WorkspaceDetails {
  return {
    id: DEMO_WORKSPACE_ID,
    name: DEMO_WORKSPACE_NAME,
    slug: "northwind-studio",
    createdAt: agoDays(92),
    memberCount: 1,
    ownerEmail: "alex@northwind.example",
    routingEmail: getWorkspaceRoutingEmail(DEMO_WORKSPACE_ID),
  };
}
