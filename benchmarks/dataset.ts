// ─────────────────────────────────────────────────────────
// Benchmark Dataset: 16 Structured Test Cases
//
// Designed to rigorously test:
//   1. Straightforward dormancy detection
//   2. Difficult adversarial scenarios (bot shielding, contract minimums, borderline activity, tiered pricing)
//   3. Edge cases (0 dormancy, annual lock-in, corrupted telemetry, duplicate aliases)
// ─────────────────────────────────────────────────────────

export interface BenchmarkCase {
  id: string;
  name: string;
  category: "STRAIGHTFORWARD" | "DIFFICULT" | "EDGE_CASE";
  description: string;
  invoiceInput: {
    rawText: string;
    vendorName: string;
    billedSeats: number;
    seatUnitPrice: number;
    totalAmount: number;
    currency: string;
    contractMinimumSeats?: number;
    renewalPenaltyTerms?: string;
  };
  telemetryInput: {
    inactivityThresholdDays: number;
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      lastActiveAt: string;
      activityCount: number;
    }>;
  };
  groundTruth: {
    expectedCutSeats: number;
    expectedSavings: number;
    expectedProtectedAccountShields: number;
    expectedBorderlineFlags: number;
    shouldContractMinApply: boolean;
    validDormantUserEmails: string[];
    protectedUserEmails: string[];
    notes: string;
  };
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  // ─────────────────────────────────────────────────────────
  // CATEGORY 1: STRAIGHTFORWARD (5 Cases)
  // ─────────────────────────────────────────────────────────
  {
    id: "case-01-figma-standard",
    name: "Figma Professional — Standard Dormancy",
    category: "STRAIGHTFORWARD",
    description: "10 billed seats at $15/seat. 3 users have been inactive for >60 days; 7 are actively designing.",
    invoiceInput: {
      rawText: "INVOICE #FIG-9021\nVendor: FIGMA\nProfessional Plan: 10 seats @ $15.00/seat/mo = $150.00\nBilling Period: Monthly\nRenewal: 2026-09-15",
      vendorName: "FIGMA",
      billedSeats: 10,
      seatUnitPrice: 15.0,
      totalAmount: 150.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "u1", name: "Sarah Connor", email: "sarah@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 42 },
        { id: "u2", name: "John Doe", email: "john@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 4 * 86400000).toISOString(), activityCount: 18 },
        { id: "u3", name: "Kyle Reese", email: "kyle@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 65 * 86400000).toISOString(), activityCount: 0 },
        { id: "u4", name: "Miles Dyson", email: "miles@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 80 * 86400000).toISOString(), activityCount: 0 },
        { id: "u5", name: "T-800", email: "t800.designer@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 95 * 86400000).toISOString(), activityCount: 0 },
        { id: "u6", name: "Grace Park", email: "grace@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 65 },
        { id: "u7", name: "Marcus Wright", email: "marcus@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 8 * 86400000).toISOString(), activityCount: 12 },
        { id: "u8", name: "Dani Ramos", email: "dani@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), activityCount: 29 },
        { id: "u9", name: "John Connor", email: "jconnor@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 33 },
        { id: "u10", name: "Kate Brewster", email: "kate@acme.com", role: "editor", lastActiveAt: new Date(Date.now() - 12 * 86400000).toISOString(), activityCount: 15 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 3,
      expectedSavings: 45.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["kyle@acme.com", "miles@acme.com", "t800.designer@acme.com"],
      protectedUserEmails: [],
      notes: "3 obvious dormant seats (>60d) with zero activity.",
    },
  },
  {
    id: "case-02-slack-inactive",
    name: "Slack Business+ — Obvious Dormancy",
    category: "STRAIGHTFORWARD",
    description: "8 billed seats at $15/seat. 2 users have been dormant for >75 days.",
    invoiceInput: {
      rawText: "Slack Technologies LLC\nPlan: Business+ (Monthly)\nActive Users Billed: 8 seats x $15.00/user = $120.00\nDue: 2026-09-01",
      vendorName: "SLACK",
      billedSeats: 8,
      seatUnitPrice: 15.0,
      totalAmount: 120.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "s1", name: "Elena Gilbert", email: "elena@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 120 },
        { id: "s2", name: "Stefan Salvatore", email: "stefan@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 85 * 86400000).toISOString(), activityCount: 0 },
        { id: "s3", name: "Damon Salvatore", email: "damon@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), activityCount: 95 },
        { id: "s4", name: "Bonnie Bennett", email: "bonnie@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 140 },
        { id: "s5", name: "Matt Donovan", email: "matt@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 90 * 86400000).toISOString(), activityCount: 0 },
        { id: "s6", name: "Caroline Forbes", email: "caroline@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 210 },
        { id: "s7", name: "Tyler Lockwood", email: "tyler@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 4 * 86400000).toISOString(), activityCount: 45 },
        { id: "s8", name: "Alaric Saltzman", email: "alaric@mystic.com", role: "member", lastActiveAt: new Date(Date.now() - 6 * 86400000).toISOString(), activityCount: 30 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 30.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["stefan@mystic.com", "matt@mystic.com"],
      protectedUserEmails: [],
      notes: "2 dormant seats (>80d).",
    },
  },
  {
    id: "case-03-copilot-devs",
    name: "GitHub Copilot Business — Idle Engineers",
    category: "STRAIGHTFORWARD",
    description: "6 billed seats at $19/seat. 2 engineers left the company 90 days ago.",
    invoiceInput: {
      rawText: "GitHub, Inc. Invoice\nGitHub Copilot Business (Monthly): 6 seats @ $19.00 USD/seat = $114.00 USD\nRenews on Oct 01, 2026",
      vendorName: "GITHUB_COPILOT",
      billedSeats: 6,
      seatUnitPrice: 19.0,
      totalAmount: 114.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "g1", name: "Linus Torvalds", email: "linus@kernel.org", role: "engineer", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 340 },
        { id: "g2", name: "Ada Lovelace", email: "ada@computing.org", role: "engineer", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 180 },
        { id: "g3", name: "Alan Turing", email: "alan@enigma.org", role: "engineer", lastActiveAt: new Date(Date.now() - 100 * 86400000).toISOString(), activityCount: 0 },
        { id: "g4", name: "Grace Hopper", email: "grace@navy.mil", role: "engineer", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 95 },
        { id: "g5", name: "Claude Shannon", email: "shannon@bell.org", role: "engineer", lastActiveAt: new Date(Date.now() - 110 * 86400000).toISOString(), activityCount: 0 },
        { id: "g6", name: "Margaret Hamilton", email: "margaret@apollo.nasa.gov", role: "engineer", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), activityCount: 220 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 38.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["alan@enigma.org", "shannon@bell.org"],
      protectedUserEmails: [],
      notes: "2 inactive engineer seats at $19/seat.",
    },
  },
  {
    id: "case-04-zoom-pro",
    name: "Zoom Workplace Pro — Dormant Hosts",
    category: "STRAIGHTFORWARD",
    description: "5 billed host licenses at $16/seat. 1 host inactive for 120 days.",
    invoiceInput: {
      rawText: "Zoom Video Communications, Inc.\nWorkplace Pro Monthly: 5 Licensed Hosts x $16.00 = $80.00\nBilling Cycle: Monthly",
      vendorName: "ZOOM",
      billedSeats: 5,
      seatUnitPrice: 16.0,
      totalAmount: 80.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "z1", name: "Host One", email: "host1@corp.com", role: "host", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 15 },
        { id: "z2", name: "Host Two", email: "host2@corp.com", role: "host", lastActiveAt: new Date(Date.now() - 7 * 86400000).toISOString(), activityCount: 8 },
        { id: "z3", name: "Host Three", email: "host3@corp.com", role: "host", lastActiveAt: new Date(Date.now() - 120 * 86400000).toISOString(), activityCount: 0 },
        { id: "z4", name: "Host Four", email: "host4@corp.com", role: "host", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 30 },
        { id: "z5", name: "Host Five", email: "host5@corp.com", role: "host", lastActiveAt: new Date(Date.now() - 4 * 86400000).toISOString(), activityCount: 12 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 16.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["host3@corp.com"],
      protectedUserEmails: [],
      notes: "1 dormant host seat at $16.00.",
    },
  },
  {
    id: "case-05-notion-plus",
    name: "Notion Plus — Departed Contractor",
    category: "STRAIGHTFORWARD",
    description: "4 billed members at $10/seat. 1 departed member inactive for 85 days.",
    invoiceInput: {
      rawText: "Notion Labs, Inc.\nNotion Plus Monthly: 4 members x $10.00 = $40.00\nRenews: 2026-09-20",
      vendorName: "NOTION",
      billedSeats: 4,
      seatUnitPrice: 10.0,
      totalAmount: 40.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "n1", name: "Alice", email: "alice@start.io", role: "member", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 50 },
        { id: "n2", name: "Bob", email: "bob@start.io", role: "member", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), activityCount: 40 },
        { id: "n3", name: "Charlie", email: "charlie@start.io", role: "member", lastActiveAt: new Date(Date.now() - 85 * 86400000).toISOString(), activityCount: 0 },
        { id: "n4", name: "Diana", email: "diana@start.io", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 75 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 10.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["charlie@start.io"],
      protectedUserEmails: [],
      notes: "1 departed contractor seat at $10.00.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // CATEGORY 2: DIFFICULT (6 Cases)
  // ─────────────────────────────────────────────────────────
  {
    id: "case-06-bot-shielding",
    name: "GitHub Copilot — Service & Bot Account Shielding",
    category: "DIFFICULT",
    description: "6 billed seats at $19/seat. 3 accounts have 0 commits, but 2 are CI/CD service bots (github-actions-bot and security-scanner). Only 1 human should be cut.",
    invoiceInput: {
      rawText: "GitHub, Inc.\nGitHub Copilot Business: 6 seats @ $19.00 = $114.00 / month\nAccount: org-core",
      vendorName: "GITHUB_COPILOT",
      billedSeats: 6,
      seatUnitPrice: 19.0,
      totalAmount: 114.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "b1", name: "Dev Alpha", email: "alpha@corp.com", role: "engineer", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 65 },
        { id: "b2", name: "Dev Beta", email: "beta@corp.com", role: "engineer", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 40 },
        { id: "b3", name: "Dev Gamma", email: "gamma@corp.com", role: "engineer", lastActiveAt: new Date(Date.now() - 95 * 86400000).toISOString(), activityCount: 0 },
        { id: "b4", name: "GitHub Actions Bot", email: "github-actions-bot@corp.com", role: "service", lastActiveAt: "", activityCount: 0 },
        { id: "b5", name: "Security Scanner Runner", email: "ci-security-runner@corp.com", role: "service", lastActiveAt: new Date(Date.now() - 200 * 86400000).toISOString(), activityCount: 0 },
        { id: "b6", name: "Dev Delta", email: "delta@corp.com", role: "engineer", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 110 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 19.0,
      expectedProtectedAccountShields: 2,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["gamma@corp.com"],
      protectedUserEmails: ["github-actions-bot@corp.com", "ci-security-runner@corp.com"],
      notes: "Must shield both service bot accounts from deprovisioning.",
    },
  },
  {
    id: "case-07-contract-floor",
    name: "Figma Enterprise — 15-Seat Contractual Floor Clamping",
    category: "DIFFICULT",
    description: "20 billed seats at $45/seat ($900/mo) with a 15-seat contract minimum floor. 8 users are dormant, but only 5 can be cut.",
    invoiceInput: {
      rawText: "Figma, Inc. Master Subscription Agreement\nFigma Enterprise Edition: 20 seats @ $45.00/seat/mo = $900.00/mo\nContract Terms: Minimum annual seat commitment is 15 seats. Reductions below 15 seats are prohibited prior to renewal.",
      vendorName: "FIGMA",
      billedSeats: 20,
      seatUnitPrice: 45.0,
      totalAmount: 900.0,
      currency: "USD",
      contractMinimumSeats: 15,
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `act-${i}`,
          name: `Active Designer ${i + 1}`,
          email: `designer${i + 1}@company.com`,
          role: "editor",
          lastActiveAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
          activityCount: 20 + i,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `dorm-${i}`,
          name: `Dormant User ${i + 1}`,
          email: `dormant${i + 1}@company.com`,
          role: "editor",
          lastActiveAt: new Date(Date.now() - (60 + i * 10) * 86400000).toISOString(),
          activityCount: 0,
        })),
      ],
    },
    groundTruth: {
      expectedCutSeats: 5,
      expectedSavings: 225.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: true,
      validDormantUserEmails: [
        "dormant1@company.com",
        "dormant2@company.com",
        "dormant3@company.com",
        "dormant4@company.com",
        "dormant5@company.com",
      ],
      protectedUserEmails: [],
      notes: "8 dormant users, but clamped to 5 cuts (20 billed - 15 min floor).",
    },
  },
  {
    id: "case-08-borderline-threshold",
    name: "Slack Pro — Borderline Inactivity (31 Days vs 30d Threshold)",
    category: "DIFFICULT",
    description: "6 billed seats at $12.50/seat. 1 user active 31 days ago (borderline), 1 user inactive 90 days. Only 1 definite cut, 1 flagged for human review.",
    invoiceInput: {
      rawText: "Slack Technologies LLC\nPro Plan: 6 users x $12.50 = $75.00/mo",
      vendorName: "SLACK",
      billedSeats: 6,
      seatUnitPrice: 12.5,
      totalAmount: 75.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "bl1", name: "Active Alice", email: "alice@team.com", role: "member", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 50 },
        { id: "bl2", name: "Active Bob", email: "bob@team.com", role: "member", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 30 },
        { id: "bl3", name: "Borderline Brenda", email: "brenda@team.com", role: "member", lastActiveAt: new Date(Date.now() - 31 * 86400000).toISOString(), activityCount: 4 },
        { id: "bl4", name: "Dormant Dan", email: "dan@team.com", role: "member", lastActiveAt: new Date(Date.now() - 95 * 86400000).toISOString(), activityCount: 0 },
        { id: "bl5", name: "Active Carol", email: "carol@team.com", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 90 },
        { id: "bl6", name: "Active Dave", email: "dave@team.com", role: "member", lastActiveAt: new Date(Date.now() - 8 * 86400000).toISOString(), activityCount: 22 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 12.5,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 1,
      shouldContractMinApply: false,
      validDormantUserEmails: ["dan@team.com"],
      protectedUserEmails: [],
      notes: "Brenda (31d inactive) must be marked borderline / human review, not auto-cut.",
    },
  },
  {
    id: "case-09-admin-security-shield",
    name: "AWS IAM / SSO — Security Officer Shielding",
    category: "DIFFICULT",
    description: "5 billed admin seats at $40/seat. 1 security compliance admin inactive for 100 days (only logs in during quarterly audits). Must be shielded.",
    invoiceInput: {
      rawText: "Amazon Web Services, Inc.\nIAM Identity Center Managed SSO: 5 Admin Seats @ $40.00/seat = $200.00",
      vendorName: "AWS",
      billedSeats: 5,
      seatUnitPrice: 40.0,
      totalAmount: 200.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "sec1", name: "Lead DevOps", email: "devops-lead@cloud.io", role: "admin", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 88 },
        { id: "sec2", name: "Site Reliability", email: "sre-core@cloud.io", role: "admin", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 140 },
        { id: "sec3", name: "Chief InfoSec Officer", email: "security-compliance-officer@cloud.io", role: "admin", lastActiveAt: new Date(Date.now() - 100 * 86400000).toISOString(), activityCount: 2 },
        { id: "sec4", name: "Ex Contractor", email: "temp-consultant@cloud.io", role: "member", lastActiveAt: new Date(Date.now() - 110 * 86400000).toISOString(), activityCount: 0 },
        { id: "sec5", name: "Platform Eng", email: "platform@cloud.io", role: "admin", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 45 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 40.0,
      expectedProtectedAccountShields: 1,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["temp-consultant@cloud.io"],
      protectedUserEmails: ["security-compliance-officer@cloud.io"],
      notes: "Infosec compliance account is shielded. Only temp-consultant is cut.",
    },
  },
  {
    id: "case-10-tiered-volume-trap",
    name: "HubSpot CRM — Tiered Pricing Boundary",
    category: "DIFFICULT",
    description: "12 billed seats at $50/seat ($600/mo). Tiered pricing terms present.",
    invoiceInput: {
      rawText: "HubSpot, Inc. Invoice\nSales Hub Professional: 12 seats @ $50.00 = $600.00 / month\nTier Notice: Tier 1 (1-10 seats) is $65/seat. Tier 2 (11-25 seats) is $50/seat.",
      vendorName: "HUBSPOT",
      billedSeats: 12,
      seatUnitPrice: 50.0,
      totalAmount: 600.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `hs-act-${i}`,
          name: `Sales Rep ${i + 1}`,
          email: `rep${i + 1}@sales.io`,
          role: "member",
          lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          activityCount: 30 + i,
        })),
        { id: "hs-dorm-1", name: "Inactive Rep A", email: "inactiverepA@sales.io", role: "member", lastActiveAt: new Date(Date.now() - 75 * 86400000).toISOString(), activityCount: 0 },
        { id: "hs-dorm-2", name: "Inactive Rep B", email: "inactiverepB@sales.io", role: "member", lastActiveAt: new Date(Date.now() - 90 * 86400000).toISOString(), activityCount: 0 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 100.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["inactiverepA@sales.io", "inactiverepB@sales.io"],
      protectedUserEmails: [],
      notes: "2 dormant seats flagged.",
    },
  },
  {
    id: "case-11-tax-line-item-filter",
    name: "Datadog — State Tax & Proration Row Filtering",
    category: "DIFFICULT",
    description: "Invoice has 8 seats @ $15 = $120, plus a '$15.00 State Sales Tax' row. Primary seat quantity is 8, not 9.",
    invoiceInput: {
      rawText: "Datadog, Inc. Tax Invoice\nLine 1: Pro Host Monitoring (8 seats) x $15.00 = $120.00\nLine 2: One-time State Sales Tax (1 qty) x $15.00 = $15.00\nTotal Due: $135.00",
      vendorName: "DATADOG",
      billedSeats: 8,
      seatUnitPrice: 15.0,
      totalAmount: 135.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `dd-act-${i}`,
          name: `Engineer ${i + 1}`,
          email: `eng${i + 1}@data.io`,
          role: "member",
          lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          activityCount: 25,
        })),
        { id: "dd-d1", name: "Departed Eng A", email: "departedA@data.io", role: "member", lastActiveAt: new Date(Date.now() - 90 * 86400000).toISOString(), activityCount: 0 },
        { id: "dd-d2", name: "Departed Eng B", email: "departedB@data.io", role: "member", lastActiveAt: new Date(Date.now() - 110 * 86400000).toISOString(), activityCount: 0 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 30.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["departedA@data.io", "departedB@data.io"],
      protectedUserEmails: [],
      notes: "Tax row must not be counted as a 9th seat.",
    },
  },

  // ─────────────────────────────────────────────────────────
  // CATEGORY 3: EDGE CASES (5 Cases)
  // ─────────────────────────────────────────────────────────
  {
    id: "case-12-zero-dormancy",
    name: "Linear — 100% Active Team (Zero Dormancy)",
    category: "EDGE_CASE",
    description: "10 billed seats at $12/seat. All 10 users active in the last 5 days. Must recommend 0 cuts with 100% confidence.",
    invoiceInput: {
      rawText: "Linear Orbit, Inc.\nLinear Standard Plan: 10 seats @ $12.00/seat = $120.00 / month",
      vendorName: "LINEAR",
      billedSeats: 10,
      seatUnitPrice: 12.0,
      totalAmount: 120.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: Array.from({ length: 10 }, (_, i) => ({
        id: `lin-${i}`,
        name: `Sprint Team Member ${i + 1}`,
        email: `member${i + 1}@linear-team.com`,
        role: "member",
        lastActiveAt: new Date(Date.now() - ((i % 5) + 1) * 86400000).toISOString(),
        activityCount: 40 + i * 5,
      })),
    },
    groundTruth: {
      expectedCutSeats: 0,
      expectedSavings: 0.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: [],
      protectedUserEmails: [],
      notes: "Clean 0-cut recommendation. No false positives.",
    },
  },
  {
    id: "case-13-annual-prepaid-no-refund",
    name: "Miro Enterprise — Annual Prepaid Lock-In",
    category: "EDGE_CASE",
    description: "10 seats billed annually at $192/seat/year ($1,920 prepaid). Contract states: 'Prepaid annual licenses are non-refundable mid-term.'",
    invoiceInput: {
      rawText: "RealtimeBoard, Inc. (Miro)\nPlan: Enterprise Annual (10 seats @ $192.00/yr = $1,920.00)\nPenalty Terms: Prepaid annual licenses are strictly non-refundable and cannot be downgraded mid-cycle.",
      vendorName: "MIRO",
      billedSeats: 10,
      seatUnitPrice: 16.0,
      totalAmount: 160.0,
      currency: "USD",
      renewalPenaltyTerms: "Prepaid annual licenses are strictly non-refundable.",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `miro-act-${i}`,
          name: `Product Designer ${i + 1}`,
          email: `pd${i + 1}@miro-user.com`,
          role: "editor",
          lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          activityCount: 30,
        })),
        { id: "miro-d1", name: "Inactive A", email: "inactA@miro-user.com", role: "editor", lastActiveAt: new Date(Date.now() - 70 * 86400000).toISOString(), activityCount: 0 },
        { id: "miro-d2", name: "Inactive B", email: "inactB@miro-user.com", role: "editor", lastActiveAt: new Date(Date.now() - 90 * 86400000).toISOString(), activityCount: 0 },
        { id: "miro-d3", name: "Inactive C", email: "inactC@miro-user.com", role: "editor", lastActiveAt: new Date(Date.now() - 110 * 86400000).toISOString(), activityCount: 0 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 3,
      expectedSavings: 48.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["inactA@miro-user.com", "inactB@miro-user.com", "inactC@miro-user.com"],
      protectedUserEmails: [],
      notes: "Flag 3 seats for renewal reduction, noting non-refundable annual term.",
    },
  },
  {
    id: "case-14-imminent-renewal",
    name: "Vercel Pro — Imminent 24-Hour Auto-Renewal",
    category: "EDGE_CASE",
    description: "4 billed seats at $20/seat ($80/mo). Next renewal is tomorrow. 2 dormant seats.",
    invoiceInput: {
      rawText: "Vercel Inc. Monthly Invoice\nVercel Pro Team: 4 members @ $20.00 = $80.00 / month\nRenewal Date: Tomorrow (2026-09-01)",
      vendorName: "VERCEL",
      billedSeats: 4,
      seatUnitPrice: 20.0,
      totalAmount: 80.0,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "v1", name: "Lead Dev", email: "lead@vercel-team.com", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 77 },
        { id: "v2", name: "Frontend Eng", email: "fe@vercel-team.com", role: "member", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 45 },
        { id: "v3", name: "Ex Contractor A", email: "contractorA@vercel-team.com", role: "member", lastActiveAt: new Date(Date.now() - 80 * 86400000).toISOString(), activityCount: 0 },
        { id: "v4", name: "Ex Contractor B", email: "contractorB@vercel-team.com", role: "member", lastActiveAt: new Date(Date.now() - 95 * 86400000).toISOString(), activityCount: 0 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 40.0,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["contractorA@vercel-team.com", "contractorB@vercel-team.com"],
      protectedUserEmails: [],
      notes: "2 dormant seats at $20/seat.",
    },
  },
  {
    id: "case-15-corrupted-telemetry",
    name: "Jira Software — Missing & Corrupted Timestamps",
    category: "EDGE_CASE",
    description: "5 billed seats at $8.50/seat. Telemetry contains missing/null timestamps and empty strings. Pipeline must handle gracefully without crashing.",
    invoiceInput: {
      rawText: "Atlassian Pty Ltd\nJira Software Standard: 5 users x $8.50 = $42.50\nRenews: Monthly",
      vendorName: "JIRA",
      billedSeats: 5,
      seatUnitPrice: 8.5,
      totalAmount: 42.5,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "j1", name: "Valid Active", email: "valid@atlassian-user.com", role: "member", lastActiveAt: new Date(Date.now() - 2 * 86400000).toISOString(), activityCount: 40 },
        { id: "j2", name: "Corrupted Null", email: "null-date@atlassian-user.com", role: "member", lastActiveAt: "", activityCount: 0 },
        { id: "j3", name: "Valid Active 2", email: "valid2@atlassian-user.com", role: "member", lastActiveAt: new Date(Date.now() - 5 * 86400000).toISOString(), activityCount: 18 },
        { id: "j4", name: "Clearly Dormant", email: "dormant@atlassian-user.com", role: "member", lastActiveAt: new Date(Date.now() - 100 * 86400000).toISOString(), activityCount: 0 },
        { id: "j5", name: "DevOps Deploy Bot", email: "devops-deploy-bot@atlassian-user.com", role: "service", lastActiveAt: "", activityCount: 0 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 2,
      expectedSavings: 17.0,
      expectedProtectedAccountShields: 1,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["null-date@atlassian-user.com", "dormant@atlassian-user.com"],
      protectedUserEmails: ["devops-deploy-bot@atlassian-user.com"],
      notes: "Bot shielded. Corrupted date treated as dormant. Total 2 cuts.",
    },
  },
  {
    id: "case-16-duplicate-aliases",
    name: "Asana Enterprise — Duplicate Employee Aliases",
    category: "EDGE_CASE",
    description: "4 billed seats at $30/seat. 1 employee has 2 accounts (john@corp.com active, john.doe@corp.com unused for 120d).",
    invoiceInput: {
      rawText: "Asana, Inc.\nAsana Enterprise: 4 members @ $30.49 = $121.96 / month",
      vendorName: "ASANA",
      billedSeats: 4,
      seatUnitPrice: 30.49,
      totalAmount: 121.96,
      currency: "USD",
    },
    telemetryInput: {
      inactivityThresholdDays: 30,
      users: [
        { id: "as1", name: "John Doe", email: "john@corp.com", role: "member", lastActiveAt: new Date(Date.now() - 1 * 86400000).toISOString(), activityCount: 88 },
        { id: "as2", name: "John Doe (Duplicate)", email: "john.doe@corp.com", role: "member", lastActiveAt: new Date(Date.now() - 120 * 86400000).toISOString(), activityCount: 0 },
        { id: "as3", name: "Emily Watson", email: "emily@corp.com", role: "member", lastActiveAt: new Date(Date.now() - 3 * 86400000).toISOString(), activityCount: 42 },
        { id: "as4", name: "David Miller", email: "david@corp.com", role: "member", lastActiveAt: new Date(Date.now() - 4 * 86400000).toISOString(), activityCount: 35 },
      ],
    },
    groundTruth: {
      expectedCutSeats: 1,
      expectedSavings: 30.49,
      expectedProtectedAccountShields: 0,
      expectedBorderlineFlags: 0,
      shouldContractMinApply: false,
      validDormantUserEmails: ["john.doe@corp.com"],
      protectedUserEmails: [],
      notes: "1 duplicate alias seat safely deprovisioned.",
    },
  },
];
