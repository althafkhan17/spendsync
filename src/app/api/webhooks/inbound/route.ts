import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────
// CloudMailin "JSON Normalized" payload shape
// Docs: https://docs.cloudmailin.com/http_post_formats/json_normalized/
// ─────────────────────────────────────────────────────────

interface CloudMailinHeaders {
  from: string;
  to: string;
  subject: string;
  [key: string]: string;
}

interface CloudMailinEnvelope {
  to: string;
  from: string;
  recipients: string[];
  [key: string]: unknown;
}

interface CloudMailinAttachment {
  file_name: string;
  content_type: string;
  size: number;
  content: string; // Base64 encoded content
  disposition: string;
}

interface CloudMailinPayload {
  headers: CloudMailinHeaders;
  envelope: CloudMailinEnvelope;
  plain: string;
  html?: string;
  reply_plain?: string;
  attachments?: CloudMailinAttachment[];
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";
const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ANNUAL_HINT_REGEX = /\b(annual(?:ly)?|yearly|per\s+year|per\s+annum|12[\s-]month|\/\s*(?:year|yr))\b/i;

// A short symbol -> ISO map for the common cases Gemini might still slip on.
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "$": "USD",
  "₹": "INR",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

// ─────────────────────────────────────────────────────────
// Zod Schema for Structured LLM Output
//
// The same field set is mirrored in `GEMINI_RESPONSE_SCHEMA` for the native
// PDF path. `buildExtractionInstructions()` is the single source of truth for
// the instructional prompt used by both paths.
// ─────────────────────────────────────────────────────────

const extractionSchema = z.object({
  vendorName: z
    .string()
    .min(1)
    .describe("The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB"),
  primaryBilledSeats: z
    .number()
    .int()
    .positive()
    .describe(
      "The quantity/seat count for the PRIMARY recurring billed line item on this invoice " +
      "(e.g. a plan, license, or seat-based row). Default to 1 if the invoice is not seat-based " +
      "or seat count cannot be determined."
    ),
  seatUnitPrice: z
    .number()
    .nonnegative()
    .describe(
      "The unit price per seat/license for the primary line item. If the invoice is not " +
      "seat-based, set this to the total invoice amount and primaryBilledSeats to 1."
    ),
  currency: z
    .string()
    .describe("The ISO 4217 three-letter currency code, e.g. USD, INR, EUR. Convert symbols to codes."),
  billingCycle: z
    .enum(["MONTHLY", "ANNUAL"])
    .nullable()
    .optional()
    .describe(
      "MONTHLY or ANNUAL depending on the billing period of the primary line item (e.g. 'Jan 1 – Jan 31' is MONTHLY, " +
      "'billed yearly' or a 12-month period is ANNUAL). Null if the period cannot be determined."
    ),
  invoiceDate: z
    .string()
    .nullable()
    .optional()
    .describe("The date of the invoice/receipt in strict YYYY-MM-DD format, or null if not found."),
  renewalDate: z
    .string()
    .nullable()
    .optional()
    .describe(
      "The date the subscription will next renew or expire, in strict YYYY-MM-DD format, or null if not found."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Your own confidence (0 to 1) that vendorName, primaryBilledSeats, and seatUnitPrice were " +
      "extracted correctly from an explicit, unambiguous line item. Use a LOW score (< 0.5) if you " +
      "had to guess, infer, or default any of these fields."
    ),
  extractionNotes: z
    .string()
    .nullable()
    .optional()
    .describe(
      "One short sentence noting any ambiguity, guess, or fallback used (e.g. 'No seat count found, defaulted to 1'). Null if extraction was unambiguous."
    ),
});

type ExtractionResult = z.infer<typeof extractionSchema>;

/** Native Gemini JSON schema for the PDF vision path; mirrors `extractionSchema`. */
const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vendorName: {
      type: Type.STRING,
      description: "The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB",
    },
    primaryBilledSeats: {
      type: Type.INTEGER,
      description: "Quantity for the single primary recurring line item. Default to 1 if not seat-based.",
    },
    seatUnitPrice: {
      type: Type.NUMBER,
      description: "Unit price for the primary line item. Default to total invoice amount if not seat-based.",
    },
    currency: {
      type: Type.STRING,
      description: "ISO 4217 three-letter currency code, e.g. USD or INR.",
    },
    billingCycle: {
      type: Type.STRING,
      enum: ["MONTHLY", "ANNUAL"],
      nullable: true,
      description: "Billing period of the primary line item: MONTHLY or ANNUAL. Null if it cannot be determined.",
    },
    invoiceDate: {
      type: Type.STRING,
      nullable: true,
      description: "Invoice date in strict YYYY-MM-DD format, or null if not found.",
    },
    renewalDate: {
      type: Type.STRING,
      nullable: true,
      description: "Next renewal/expiry date in strict YYYY-MM-DD format, or null if not found.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Self-reported confidence 0 to 1 in the primary extraction fields.",
    },
    extractionNotes: {
      type: Type.STRING,
      nullable: true,
      description: "Short note on any fallback/guess used, or null.",
    },
  },
  required: ["vendorName", "primaryBilledSeats", "seatUnitPrice", "currency", "confidence"],
};

// ─────────────────────────────────────────────────────────
// Single source of truth for the extraction instructions.
// Used by BOTH the PDF vision path and the text fallback path,
// so the two extraction behaviors can't silently drift apart.
// ─────────────────────────────────────────────────────────

function buildExtractionInstructions(): string {
  return `You are a highly accurate financial document extraction AI. You will be shown an invoice, receipt, or billing email from ANY SaaS vendor (Figma, AWS, GitHub Copilot, Slack, Zoom, Notion, etc.) — do not assume a specific vendor's invoice layout.

Follow these steps in order:

1. Identify the vendor/merchant name. Normalize it to uppercase (e.g. "Figma, Inc." -> "FIGMA").

2. Find the line items table or itemized charges section. Identify the PRIMARY recurring line item — this is the main plan, license, or seat-based subscription charge (e.g. "Professional plan (seats)", "Copilot Business seats", "Pro Plan"). Ignore:
   - One-time setup fees, taxes, discounts, credits, and prorations
   - Subtotal / total / balance-due rows
   - Secondary add-on line items (e.g. "Dev Mode seats" when a primary "Design seats" row also exists)
   If multiple candidate primary rows exist, prefer the one with the largest line-item subtotal.

3. From that single primary row, extract:
   - primaryBilledSeats: the Quantity value for that row only.
   - seatUnitPrice: the per-unit/per-seat price for that row only.
   If the invoice has no seat/quantity concept at all (e.g. a flat AWS usage bill), set primaryBilledSeats to 1 and seatUnitPrice to the total amount due.

4. Extract the currency as an ISO 4217 three-letter code (USD, INR, EUR, GBP, etc). Convert symbols ($ , ₹, €, £) to their code.

5. Determine billingCycle for the primary line item: MONTHLY when the service period spans about one month or the plan is billed monthly; ANNUAL when it spans about a year or is billed yearly/annually. Return null if the document gives no period information — do not guess from unrelated words.

6. Extract invoiceDate (the date the invoice/receipt was issued) in strict YYYY-MM-DD format.

7. Extract renewalDate: the date the subscription will next renew, auto-renew, or expire. Look for phrasing like "active until June 17, 2026", "renews on", "your subscription will renew on", or a billing-period end date. Format as strict YYYY-MM-DD. If genuinely absent, return null — do not guess.

8. Self-report a confidence score from 0 to 1 for how certain you are that vendorName, primaryBilledSeats, and seatUnitPrice came from an explicit, unambiguous source (not inferred or defaulted). If you had to default seats to 1, or guess between two candidate rows, your confidence should be below 0.5.

9. If you used any fallback/default/guess anywhere, write one short sentence in extractionNotes explaining what you defaulted and why. Otherwise return null for extractionNotes.

Respond with ONLY the structured data — no commentary.`;
}

// ─────────────────────────────────────────────────────────
// Utility: Extract workspace ID from the "To" address
// hash+workspaceId@cloudmailin.net
// ─────────────────────────────────────────────────────────

function extractWorkspaceId(toAddress: string): string | null {
  const match = toAddress.match(/\+([^@]+)@/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────
// Utility: Normalize/validate currency codes coming back from the model.
// Falls back to symbol-mapping, then to "USD" only as an absolute last resort
// (and lowers confidence when that happens, handled by the caller).
// ─────────────────────────────────────────────────────────

function normalizeCurrency(raw: string): { currency: string; wasGuessed: boolean } {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (ISO_CURRENCY_REGEX.test(upper)) {
    return { currency: upper, wasGuessed: false };
  }

  if (CURRENCY_SYMBOL_MAP[trimmed]) {
    return { currency: CURRENCY_SYMBOL_MAP[trimmed], wasGuessed: false };
  }

  // Try to find a known symbol anywhere in the string, e.g. "US$" or "Rs. 500"
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (trimmed.includes(symbol)) {
      return { currency: code, wasGuessed: false };
    }
  }

  console.warn(`⚠️  Unrecognized currency "${raw}", defaulting to USD`);
  return { currency: "USD", wasGuessed: true };
}

// ─────────────────────────────────────────────────────────
// Utility: Strictly parse a YYYY-MM-DD date string.
// ─────────────────────────────────────────────────────────

function parseStrictDate(value: string | null | undefined): Date | null {
  if (!value || !DATE_REGEX.test(value.trim())) {
    return null;
  }
  const parsed = new Date(`${value.trim()}T00:00:00Z`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Billing cycle: trust the model when it answered; otherwise fall back to an
 * explicit phrase match ("billed annually", "/year") rather than any mention
 * of the word "year", which also appears in phrases like "thanks for a great year".
 */
function resolveBillingCycle(extracted: ExtractionResult, subject: string, body: string): "MONTHLY" | "ANNUAL" {
  if (extracted.billingCycle === "MONTHLY" || extracted.billingCycle === "ANNUAL") {
    return extracted.billingCycle;
  }
  return ANNUAL_HINT_REGEX.test(subject) || ANNUAL_HINT_REGEX.test(body) ? "ANNUAL" : "MONTHLY";
}

function addCycle(from: Date, cycle: "MONTHLY" | "ANNUAL"): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + (cycle === "MONTHLY" ? 30 : 365));
  return d;
}

// ─────────────────────────────────────────────────────────
// Extraction paths
// ─────────────────────────────────────────────────────────

async function extractFromPdf(apiKey: string, pdfBase64: string, instructions: string): Promise<ExtractionResult> {
  const ai = new GoogleGenAI({ apiKey });
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { data: pdfBase64, mimeType: "application/pdf" } }, { text: instructions }],
          },
        ],
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned an empty response");
      console.log("Gemini PDF Raw Response:", text);
      return extractionSchema.parse(JSON.parse(text));
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Gemini PDF extraction attempt ${attempt} failed:`, err);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini PDF extraction failed");
}

async function extractFromText(apiKey: string, emailText: string, instructions: string): Promise<ExtractionResult> {
  const model = new ChatGoogleGenerativeAI({ model: GEMINI_MODEL, temperature: 0, apiKey });
  const structuredModel = model.withStructuredOutput(extractionSchema);
  const prompt = PromptTemplate.fromTemplate("{instructions}\n\nEmail text:\n{emailText}");
  const chain = prompt.pipe(structuredModel);
  return (await chain.invoke({ instructions, emailText })) as ExtractionResult;
}

// ─────────────────────────────────────────────────────────
// POST /api/webhooks/inbound
//
// Response codes matter: CloudMailin treats 4xx as a permanent rejection
// (the email bounces) and 5xx as "retry later". So malformed input is 4xx,
// and anything we can recover from on a retry (DB/AI outage) is 5xx.
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Webhook Secret Security Gate
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    console.error("❌ Unauthorized webhook access: secret token mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse the payload — the only failure that is genuinely the sender's fault
  let payload: CloudMailinPayload;
  try {
    payload = (await request.json()) as CloudMailinPayload;
  } catch {
    console.error("❌ Webhook payload is not valid JSON");
    return NextResponse.json({ error: "Bad Request — invalid JSON payload" }, { status: 400 });
  }

  try {
    const from = payload.headers?.from ?? "";
    const to = payload.headers?.to ?? payload.envelope?.to ?? "";
    const subject = payload.headers?.subject ?? "(no subject)";
    const textBody = payload.plain ?? "";

    const workspaceId = extractWorkspaceId(to);

    const pdfAttachment = payload.attachments?.find((att) => att.content_type === "application/pdf");

    if (!textBody.trim() && !pdfAttachment) {
      console.warn("⚠️  Webhook received email with empty body and no PDF attachment");
      return NextResponse.json({ error: "Email body and PDF attachments are empty — nothing to process" }, { status: 400 });
    }

    console.log("═══════════════════════════════════════════");
    console.log("📩 INBOUND EMAIL RECEIVED");
    console.log("═══════════════════════════════════════════");
    console.log(`  From:         ${from}`);
    console.log(`  To:           ${to}`);
    console.log(`  Subject:      ${subject}`);
    console.log(`  Workspace ID: ${workspaceId ?? "⚠️  not found in To address"}`);
    console.log(`  Has PDF:      ${pdfAttachment ? "Yes (" + pdfAttachment.file_name + ")" : "No"}`);
    console.log("───────────────────────────────────────────");
    console.log(`  Body Preview: ${textBody.substring(0, 200).replace(/\n/g, " ")}${textBody.length > 200 ? "…" : ""}`);
    console.log("═══════════════════════════════════════════");

    // Unknown routing ids are acknowledged with 200 so CloudMailin does not
    // keep retrying mail that can never be delivered.
    if (!workspaceId) {
      console.error("❌ Invalid workspace routing ID: null/empty in address");
      return NextResponse.json({ success: true, error: "Invalid workspace routing ID" }, { status: 200 });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      console.error(`❌ Invalid workspace routing ID: ${workspaceId}`);
      return NextResponse.json({ success: true, error: "Invalid workspace routing ID" }, { status: 200 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error("❌ GEMINI_API_KEY is not defined in the environment");
      return NextResponse.json({ error: "AI parsing service API key is not configured" }, { status: 500 });
    }

    let extractedData: ExtractionResult | null = null;
    let source = "TEXT";
    let attachmentName: string | null = null;

    const instructions = buildExtractionInstructions();

    // 3. Try PDF attachment extraction first (Gemini native PDF vision)
    if (pdfAttachment) {
      source = "PDF";
      attachmentName = pdfAttachment.file_name;
      console.log(`📎 Processing PDF attachment: ${attachmentName}`);
      try {
        extractedData = await extractFromPdf(geminiKey, pdfAttachment.content, instructions);
      } catch (pdfError) {
        console.error("❌ Gemini PDF extraction failed, falling back to text if available:", pdfError);
      }
    }

    // 4. Fall back to the plain-text body if PDF parsing didn't run or failed
    if (!extractedData && textBody.trim()) {
      source = "TEXT";
      attachmentName = null;
      try {
        extractedData = await extractFromText(geminiKey, textBody, instructions);
      } catch (textError) {
        console.error("❌ Gemini text extraction failed:", textError);
      }
    }

    let subscriptionId: string | null = null;
    const bodyPreview = textBody.substring(0, 300);

    // Track final confidence + currency-guess state for logging,
    // since normalizeCurrency() can itself downgrade confidence.
    let finalConfidence = extractedData?.confidence ?? 0;
    let normalizedCurrency = extractedData?.currency ?? "USD";

    // 5. Database upsert & logging
    if (extractedData && extractedData.primaryBilledSeats > 0) {
      console.log("Gemini Extraction Success:", extractedData);
      if (extractedData.extractionNotes) {
        console.log(`ℹ️  Extraction note: ${extractedData.extractionNotes}`);
      }

      const { currency, wasGuessed } = normalizeCurrency(extractedData.currency);
      normalizedCurrency = currency;
      if (wasGuessed) {
        finalConfidence = Math.min(finalConfidence, 0.3);
      }

      const billingCycle = resolveBillingCycle(extractedData, subject, textBody);
      const invoiceDate = parseStrictDate(extractedData.invoiceDate);
      const renewalDate = parseStrictDate(extractedData.renewalDate);

      let nextRenewalDate: Date;
      if (renewalDate) {
        nextRenewalDate = renewalDate;
      } else if (invoiceDate) {
        nextRenewalDate = addCycle(invoiceDate, billingCycle);
      } else {
        // No usable date in the document at all — lower confidence,
        // since the renewal-alert engine depends entirely on this date.
        finalConfidence = Math.min(finalConfidence, 0.4);
        nextRenewalDate = addCycle(new Date(), billingCycle);
      }

      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          workspaceId: workspace.id,
          merchantName: { equals: extractedData.vendorName, mode: "insensitive" },
        },
      });

      const amount = extractedData.primaryBilledSeats * extractedData.seatUnitPrice;
      const data = {
        amount,
        billingCycle,
        currency: normalizedCurrency,
        confidenceScore: finalConfidence,
        nextRenewalDate,
        status: "ACTIVE" as const,
        billedSeats: extractedData.primaryBilledSeats,
        seatUnitPrice: extractedData.seatUnitPrice,
      };

      if (existingSubscription) {
        const updated = await prisma.subscription.update({ where: { id: existingSubscription.id }, data });
        subscriptionId = updated.id;
        console.log(`✅ Updated existing subscription for "${extractedData.vendorName}" in workspace ${workspace.id} (confidence: ${finalConfidence})`);
      } else {
        const created = await prisma.subscription.create({
          data: { workspaceId: workspace.id, merchantName: extractedData.vendorName, ...data },
        });
        subscriptionId = created.id;
        console.log(`✅ Created new subscription for "${extractedData.vendorName}" in workspace ${workspace.id} (confidence: ${finalConfidence})`);
      }
    } else {
      console.log("ℹ️  Not identified as a subscription receipt:", extractedData);
    }

    await prisma.emailLog.create({
      data: {
        senderEmail: from,
        subject,
        bodyPreview,
        source,
        attachmentName,
        wasReceipt: extractedData ? extractedData.primaryBilledSeats > 0 : false,
        merchantName: extractedData?.vendorName ?? null,
        amount: extractedData ? extractedData.primaryBilledSeats * extractedData.seatUnitPrice : null,
        confidenceScore: finalConfidence,
        rawExtraction: extractedData ? JSON.stringify(extractedData) : null,
        workspaceId: workspace.id,
        subscriptionId,
      },
    });

    return NextResponse.json({ success: true, isReceipt: !!subscriptionId }, { status: 200 });
  } catch (error) {
    // Database / AI outage: tell CloudMailin to retry rather than bounce the email.
    console.error("⚠️  Webhook main handler error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
