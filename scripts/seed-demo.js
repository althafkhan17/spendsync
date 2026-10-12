#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * SpendSync demo seeder.
 *
 * Populates ONE workspace with a realistic agency stack: subscriptions with
 * staggered renewals, parsed receipt emails that back them, and demo
 * integrations (GitHub Copilot, Figma, Anthropic) whose audits are clearly
 * labelled as simulated. Then triggers the engines against the local dev
 * server so every card is populated before the demo starts.
 *
 * Usage:
 *   npm run seed:demo -- --email you@example.com          # workspace owned by this email
 *   npm run seed:demo -- --workspace <workspaceId>
 *   npm run seed:demo -- --email you@example.com --reset   # wipe subs/logs/integrations first
 *   npm run seed:demo -- --email you@example.com --no-audit
 *
 * Reads DATABASE_URL (and CRON_SECRET, NEXT_PUBLIC_APP_URL) from .env.local.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name) => args.includes(name);

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n) => new Date(Date.now() + n * DAY);
const agoDays = (n) => new Date(Date.now() - n * DAY);
const iso = (d) => d.toISOString().slice(0, 10);

/** Realistic agency stack. Renewal offsets are chosen so the demo has alerts in every window. */
const SUBSCRIPTIONS = [
  { merchantName: "Figma", seats: 15, unit: 15, cycle: "MONTHLY", renewIn: 6, sender: "Figma <billing@figma.com>", subject: "Your Figma invoice for Professional plan", source: "PDF", confidence: 0.96 },
  { merchantName: "GitHub Copilot", seats: 12, unit: 19, cycle: "MONTHLY", renewIn: 11, sender: "GitHub <billing@github.com>", subject: "[GitHub] Your Copilot Business receipt", source: "PDF", confidence: 0.94 },
  { merchantName: "Slack", seats: 18, unit: 8.75, cycle: "MONTHLY", renewIn: 21, sender: "Slack <feedback@slack.com>", subject: "Your Slack Pro invoice is available", source: "PDF", confidence: 0.93 },
  { merchantName: "Notion", seats: 14, unit: 10, cycle: "MONTHLY", renewIn: 27, sender: "Notion <team@makenotion.com>", subject: "Receipt for Notion Plus", source: "TEXT", confidence: 0.9 },
  { merchantName: "Zoom", seats: 6, unit: 15.99, cycle: "MONTHLY", renewIn: 9, sender: "Zoom <no-reply@zoom.us>", subject: "Zoom Workplace Pro: payment confirmation", source: "TEXT", confidence: 0.88 },
  { merchantName: "Linear", seats: 12, unit: 14, cycle: "MONTHLY", renewIn: 18, sender: "Linear <billing@linear.app>", subject: "Linear Business invoice", source: "PDF", confidence: 0.95 },
  { merchantName: "Vercel", seats: 3, unit: 20, cycle: "MONTHLY", renewIn: 4, sender: "Vercel <invoice@vercel.com>", subject: "Your receipt from Vercel Pro", source: "PDF", confidence: 0.97 },
  { merchantName: "AWS", seats: 1, unit: 412.37, cycle: "MONTHLY", renewIn: 15, sender: "Amazon Web Services <no-reply@amazon.com>", subject: "Amazon Web Services Billing Statement Available", source: "PDF", confidence: 0.81 },
  { merchantName: "Google Workspace", seats: 20, unit: 168, cycle: "ANNUAL", renewIn: 45, sender: "Google Workspace <payments-noreply@google.com>", subject: "Your Google Workspace annual invoice", source: "PDF", confidence: 0.92 },
  { merchantName: "Loom", seats: 5, unit: 12.5, cycle: "MONTHLY", renewIn: 13, status: "NEEDS_REVIEW", sender: "Loom <support@loom.com>", subject: "Thanks for your purchase", source: "TEXT", confidence: 0.42 },
  { merchantName: "Miro", seats: 8, unit: 10, cycle: "MONTHLY", renewIn: 2, status: "CANCELLED", sender: "Miro <noreply@miro.com>", subject: "Your Miro subscription receipt", source: "TEXT", confidence: 0.91 },
];

const NON_RECEIPTS = [
  { sender: "Product Hunt <hello@producthunt.com>", subject: "Top launches this week", body: "This week's most upvoted launches..." },
  { sender: "Stripe <no-reply@stripe.com>", subject: "Weekly payouts summary", body: "Your payouts for the week of..." },
];

async function resolveWorkspace() {
  const id = flag("--workspace");
  const email = flag("--email");
  if (id) {
    const ws = await prisma.workspace.findUnique({ where: { id }, include: { members: { include: { user: true } } } });
    if (!ws) throw new Error(`Workspace ${id} not found`);
    return ws;
  }
  if (email) {
    const member = await prisma.workspaceMember.findFirst({
      where: { user: { email: { equals: email, mode: "insensitive" } } },
      orderBy: { createdAt: "asc" },
      include: { workspace: { include: { members: { include: { user: true } } } } },
    });
    if (!member) throw new Error(`No workspace found for ${email}. Sign in once at /dashboard first.`);
    return member.workspace;
  }
  const all = await prisma.workspace.findMany({ include: { members: { include: { user: { select: { email: true } } } } } });
  console.log("Pass --email <owner email> or --workspace <id>. Workspaces in this database:");
  for (const w of all) console.log(`  ${w.id}  ${w.name}  (${w.members.map((m) => m.user.email).join(", ")})`);
  process.exit(1);
}

async function seedSubscriptions(workspaceId) {
  const created = new Map();
  for (const s of SUBSCRIPTIONS) {
    const amount = Math.round(s.seats * s.unit * 100) / 100;
    const data = {
      merchantName: s.merchantName,
      amount,
      currency: "USD",
      billingCycle: s.cycle,
      status: s.status || "ACTIVE",
      nextRenewalDate: inDays(s.renewIn),
      billedSeats: s.seats,
      seatUnitPrice: s.unit,
      confidenceScore: s.confidence,
      extractedFromEmail: s.sender,
      notes: s.status === "NEEDS_REVIEW" ? "Low-confidence extraction: seat count was not explicit on the receipt." : null,
    };
    const existing = await prisma.subscription.findFirst({
      where: { workspaceId, merchantName: { equals: s.merchantName, mode: "insensitive" } },
    });
    const row = existing
      ? await prisma.subscription.update({ where: { id: existing.id }, data })
      : await prisma.subscription.create({ data: { ...data, workspaceId } });
    created.set(s.merchantName, row);
  }
  return created;
}

async function seedEmailLogs(workspaceId, subs) {
  let count = 0;
  for (const s of SUBSCRIPTIONS) {
    const sub = subs.get(s.merchantName);
    const amount = Number(sub.amount);
    const invoiceDate = s.cycle === "ANNUAL" ? agoDays(320) : agoDays(30 - s.renewIn);
    const renewal = iso(sub.nextRenewalDate);
    const bodyPreview = `${s.merchantName} receipt. ${s.seats} x ${s.unit.toFixed(2)} USD. Total ${amount.toFixed(2)} USD. Your plan renews on ${renewal}.`;
    const rawExtraction = JSON.stringify({
      vendorName: s.merchantName.toUpperCase(),
      primaryBilledSeats: s.seats,
      seatUnitPrice: s.unit,
      currency: "USD",
      invoiceDate: iso(invoiceDate),
      renewalDate: renewal,
      confidence: s.confidence,
      extractionNotes: s.confidence < 0.6 ? "No explicit seat count; defaulted from plan description." : null,
    });
    const dup = await prisma.emailLog.findFirst({ where: { workspaceId, subject: s.subject, senderEmail: s.sender } });
    if (dup) continue;
    await prisma.emailLog.create({
      data: {
        workspaceId,
        subscriptionId: sub.id,
        senderEmail: s.sender,
        subject: s.subject,
        bodyPreview,
        source: s.source,
        attachmentName: s.source === "PDF" ? `${s.merchantName.toLowerCase().replace(/\s+/g, "-")}-invoice-${iso(invoiceDate)}.pdf` : null,
        wasReceipt: true,
        merchantName: s.merchantName.toUpperCase(),
        amount,
        confidenceScore: s.confidence,
        rawExtraction,
        createdAt: invoiceDate,
      },
    });
    count++;
  }
  for (const n of NON_RECEIPTS) {
    const dup = await prisma.emailLog.findFirst({ where: { workspaceId, subject: n.subject } });
    if (dup) continue;
    await prisma.emailLog.create({
      data: {
        workspaceId,
        senderEmail: n.sender,
        subject: n.subject,
        bodyPreview: n.body,
        source: "TEXT",
        wasReceipt: false,
        confidenceScore: 0.05,
        createdAt: agoDays(Math.floor(Math.random() * 20) + 1),
      },
    });
    count++;
  }
  return count;
}

async function seedIntegrations(workspaceId) {
  const rows = [
    { provider: "GITHUB_COPILOT", accessToken: "mock_demo_github_token", refreshToken: "acme-labs" },
    { provider: "FIGMA", accessToken: "mock_demo_figma_token", refreshToken: "mock_demo_figma_refresh", tokenExpiresAt: inDays(365) },
    { provider: "ANTHROPIC", accessToken: "sk-ant-test-mock", refreshToken: "50.00" },
  ];
  for (const r of rows) {
    await prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: r.provider } },
      create: { workspaceId, isActive: true, ...r },
      update: { isActive: true, accessToken: r.accessToken, refreshToken: r.refreshToken, tokenExpiresAt: r.tokenExpiresAt ?? null },
    });
  }
  return rows.length;
}

async function triggerEngines(workspaceId) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET ? `&secret=${encodeURIComponent(process.env.CRON_SECRET)}` : "";
  for (const route of ["optimize-seats", "sync-anthropic", "evaluate-leaks"]) {
    const url = `${base}/api/cron/${route}?workspaceId=${workspaceId}${secret}`;
    try {
      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      const summary =
        route === "optimize-seats"
          ? (body.results || []).map((r) => `${r.provider}: ${r.wastedSeats}/${r.billedSeats} idle (${r.dataSource})`).join("; ")
          : route === "sync-anthropic"
            ? (body.results || []).map((r) => `$${(r.totalCostUsd ?? 0).toFixed(2)} of $${(r.thresholdUsd ?? 0).toFixed(2)} (${r.dataSource})`).join("; ")
            : `flagged ${body.flaggedCount ?? 0}`;
      console.log(`  ${res.ok ? "✅" : "❌"} ${route} → ${res.status} ${summary}`);
    } catch (err) {
      console.log(`  ⚠️  ${route}: dev server not reachable at ${base} (${err.message}). Click "Run Audit" in the UI instead.`);
    }
  }
}

(async () => {
  try {
    const ws = await resolveWorkspace();
    console.log(`\n🌱 Seeding workspace "${ws.name}" (${ws.id})`);

    if (has("--reset")) {
      const [a, b, c] = await Promise.all([
        prisma.emailLog.deleteMany({ where: { workspaceId: ws.id } }),
        prisma.subscription.deleteMany({ where: { workspaceId: ws.id } }),
        prisma.integration.deleteMany({ where: { workspaceId: ws.id } }),
      ]);
      console.log(`  🧹 Reset: removed ${a.count} email logs, ${b.count} subscriptions, ${c.count} integrations`);
    }

    const subs = await seedSubscriptions(ws.id);
    console.log(`  💳 ${subs.size} subscriptions upserted`);
    const logs = await seedEmailLogs(ws.id, subs);
    console.log(`  📩 ${logs} email logs created`);
    const ints = await seedIntegrations(ws.id);
    console.log(`  🔌 ${ints} integrations upserted (demo credentials, audits labelled SIMULATED)`);

    if (!has("--no-audit")) {
      console.log("  ⚙️  Running engines against the dev server...");
      await triggerEngines(ws.id);
    }
    console.log("\n✨ Done. Open /dashboard to see the populated workspace.\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
