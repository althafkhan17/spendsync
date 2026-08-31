import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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

const ISO_CURRENCY_REGEX = /^[A-Z]{3}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// A short symbol -> ISO map for currency conversion
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "$": "USD",
  "₹": "INR",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

// ─────────────────────────────────────────────────────────
// Zod Schema & Gemini Response Schema
// ─────────────────────────────────────────────────────────

const extractionSchema = z.object({
  vendorName: z
    .string()
    .min(1)
    .describe("The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB"),
  primaryBilledSeats: z.coerce
    .number()
    .int()
    .positive()
    .default(1)
    .describe(
      "The quantity/seat count for the PRIMARY recurring billed line item on this invoice " +
      "(e.g. a plan, license, or seat-based row). Default to 1 if the invoice is not seat-based " +
      "or seat count cannot be determined."
    ),
  seatUnitPrice: z.coerce
    .number()
    .nonnegative()
    .default(0)
    .describe(
      "The unit price per seat/license for the primary line item. If the invoice is not " +
      "seat-based, set this to the total invoice amount and primaryBilledSeats to 1."
    ),
  totalAmount: z.coerce
    .number()
    .nonnegative()
    .optional()
    .nullable()
    .describe("The total monetary amount for the invoice or billing statement."),
  currency: z
    .string()
    .default("USD")
    .describe("The ISO 4217 three-letter currency code, e.g. USD, INR, EUR. Convert symbols to codes."),
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
  wasReceipt: z.coerce
    .boolean()
    .optional()
    .describe("True if this email represents a valid SaaS invoice, billing notice, receipt, or renewal statement."),
  confidence: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0.9)
    .describe(
      "Your own confidence (0 to 1) that vendorName, primaryBilledSeats, and seatUnitPrice were " +
      "extracted correctly from an explicit, unambiguous line item."
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

const GEMINI_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    vendorName: {
      type: SchemaType.STRING,
      description: "The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB",
    },
    primaryBilledSeats: {
      type: SchemaType.INTEGER,
      description:
        "Quantity for the primary recurring line item. Default to 1 if not seat-based.",
    },
    seatUnitPrice: {
      type: SchemaType.NUMBER,
      description:
        "Unit price per seat/license for the primary line item. Default to total invoice amount if not seat-based.",
    },
    totalAmount: {
      type: SchemaType.NUMBER,
      description: "Total invoice or charge amount.",
    },
    currency: {
      type: SchemaType.STRING,
      description: "ISO 4217 three-letter currency code, e.g. USD or INR.",
    },
    invoiceDate: {
      type: SchemaType.STRING,
      description: "Invoice date in strict YYYY-MM-DD format, or null if not found.",
    },
    renewalDate: {
      type: SchemaType.STRING,
      description: "Next renewal/expiry date in strict YYYY-MM-DD format, or null if not found.",
    },
    wasReceipt: {
      type: SchemaType.BOOLEAN,
      description: "True if this email is a valid SaaS billing statement, invoice notice, or receipt.",
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: "Self-reported confidence 0 to 1 in the primary extraction fields.",
    },
    extractionNotes: {
      type: SchemaType.STRING,
      description: "Short note on any fallback/guess used, or null.",
    },
  },
  required: ["vendorName", "primaryBilledSeats", "seatUnitPrice", "currency", "confidence"],
} as any;

// ─────────────────────────────────────────────────────────
// Clean and normalize vendor name from forwarded/inbound emails
// ─────────────────────────────────────────────────────────

function cleanVendorName(raw: string): string {
  let cleaned = (raw || "").trim().toUpperCase();
  // Strip email forward and reply prefixes
  cleaned = cleaned.replace(/^(FWD?|RE|FW)\s*:\s*/i, "");
  // Strip common invoice/receipt header phrases
  cleaned = cleaned.replace(/^(INVOICE|RECEIPT|BILL|BILLING|STATEMENT|PAYMENT)\s+(FROM|FOR|OF)\s+/i, "");
  cleaned = cleaned.replace(/^(YOUR\s+)?(INVOICE|RECEIPT|BILL|STATEMENT|PAYMENT)\s*:\s*/i, "");
  cleaned = cleaned.replace(/^(AUTOMATIC\s+PAYMENT\s+FOR\s+)/i, "");
  cleaned = cleaned.replace(/^(YOUR\s+)?(SUBSCRIPTION\s+TO\s+)/i, "");
  // Strip corporate legal suffixes if trailing
  cleaned = cleaned.replace(/\s+(INC\.?|LLC|LTD\.?|CORP\.?|CORPORATION|TECHNOLOGIES|SERVICES)$/i, "");
  return cleaned.trim() || (raw || "").trim().toUpperCase();
}

// ─────────────────────────────────────────────────────────
// Deterministic Regex Extractor Fallback
// ─────────────────────────────────────────────────────────

function extractInvoiceWithRegex(
  body: string,
  subject: string,
  from: string
): ExtractionResult | null {
  const combined = `${subject} ${from} ${body}`.toLowerCase();

  // 1. Detect Vendor
  let vendorName = "";
  if (/github|copilot/i.test(combined)) vendorName = "GITHUB_COPILOT";
  else if (/figma/i.test(combined)) vendorName = "FIGMA";
  else if (/slack/i.test(combined)) vendorName = "SLACK";
  else if (/amazon\s*web\s*services|\baws\b/i.test(combined)) vendorName = "AWS";
  else if (/zoom/i.test(combined)) vendorName = "ZOOM";
  else if (/notion/i.test(combined)) vendorName = "NOTION";
  else if (/vercel/i.test(combined)) vendorName = "VERCEL";
  else if (/anthropic|claude/i.test(combined)) vendorName = "ANTHROPIC";
  else if (/openai|chatgpt/i.test(combined)) vendorName = "OPENAI";
  else if (/datadog/i.test(combined)) vendorName = "DATADOG";
  else if (/linear/i.test(combined)) vendorName = "LINEAR";
  else if (/asana/i.test(combined)) vendorName = "ASANA";
  else if (/miro/i.test(combined)) vendorName = "MIRO";
  else if (/google\s*workspace|gsuite/i.test(combined)) vendorName = "GOOGLE_WORKSPACE";
  else if (/hubspot/i.test(combined)) vendorName = "HUBSPOT";
  else if (/jira|atlassian/i.test(combined)) vendorName = "JIRA";
  else {
    const match = subject.match(/(?:invoice|receipt|statement|bill)\s+(?:from|for)\s+([A-Za-z0-9\s_-]+)/i);
    if (match && match[1]) {
      vendorName = cleanVendorName(match[1]);
    }
  }

  if (!vendorName) return null;

  // 2. Detect Seats / Quantity
  let seats = 1;
  const seatsMatch =
    body.match(/(\d+)\s*(?:enterprise\s*seats?|business\s*seats?|pro\s*seats?|seats?|licenses?|users?|members?|hosts?)/i) ||
    body.match(/(?:seats?|licenses?|users?|members?|quantity|qty)\s*[:=x@]\s*(\d+)/i) ||
    subject.match(/(\d+)\s*(?:seats?|licenses?|users?)/i);

  if (seatsMatch && parseInt(seatsMatch[1], 10) > 0) {
    seats = parseInt(seatsMatch[1], 10);
  }

  // 3. Detect Unit Price or Total Amount
  let unitPrice = 0;
  const unitPriceMatch =
    body.match(/\$\s*(\d+(?:\.\d{2})?)\s*(?:\/|\s+per\s+)(?:seat|user|license|month|mo)/i) ||
    body.match(/(?:unit\s*price|price\s*per\s*seat|rate)\s*[:=]\s*\$\s*(\d+(?:\.\d{2})?)/i);

  const totalAmountMatch =
    body.match(/(?:total|amount\s*due|amount\s*paid|grand\s*total|balance\s*due|total\s*amount|subtotal)\s*[:=]?\s*\$\s*(\d+(?:\.\d{2})?)/i) ||
    body.match(/\$\s*(\d+(?:\.\d{2})?)/i) ||
    subject.match(/\$\s*(\d+(?:\.\d{2})?)/i);

  if (unitPriceMatch) {
    unitPrice = parseFloat(unitPriceMatch[1]);
  } else if (totalAmountMatch) {
    const total = parseFloat(totalAmountMatch[1]);
    unitPrice = seats > 1 ? Math.round((total / seats) * 100) / 100 : total;
  }

  if (unitPrice <= 0 && seats <= 1) {
    return null;
  }

  const dateMatch = body.match(/(\d{4}-\d{2}-\d{2})/);
  const invoiceDate = dateMatch ? dateMatch[1] : null;

  return {
    vendorName,
    primaryBilledSeats: seats,
    seatUnitPrice: unitPrice > 0 ? unitPrice : 1,
    currency: "USD",
    invoiceDate,
    renewalDate: null,
    confidence: 0.90,
    extractionNotes: "Extracted via deterministic regex pattern fallback engine.",
  };
}

// ─────────────────────────────────────────────────────────
// Single source of truth for the extraction instructions.
// Used by BOTH the PDF vision path and the text fallback path,
// so the two extraction behaviors can't silently drift apart.
// ─────────────────────────────────────────────────────────

function buildExtractionInstructions(): string {
  return `You are a highly accurate financial document extraction AI. You will be shown an invoice, receipt, billing notice, renewal statement, or forwarded subscription email from ANY SaaS vendor (GitHub Copilot, GitHub Enterprise, Figma, AWS, Slack, Zoom, Claude, Notion, Vercel, Datadog, etc.) — do not assume a specific vendor's invoice layout.

Follow these steps in order:

1. Identify the vendor/merchant name (e.g., 'GitHub', 'Figma', 'Slack'). Clean and normalize it to uppercase without prefixes like 'Fwd:' or 'Invoice from' (e.g. "GitHub, Inc." -> "GITHUB_COPILOT" or "GITHUB", "Figma, Inc." -> "FIGMA").

2. Find the recurring plan, license, or seat-based subscription charges. Identify the PRIMARY recurring line item (e.g. "Enterprise seats", "Copilot Business seats", "Professional plan", "Pro Plan", "Standard"). Ignore:
   - One-time setup fees, taxes, discounts, credits, and prorations
   - Subtotal / total / balance-due rows
   - Secondary add-on line items

3. From that primary charge, extract:
   - primaryBilledSeats: the Quantity/Seat count (e.g. 20 seats -> 20). Default to 1 if the invoice is flat-rate or seat count cannot be determined.
   - seatUnitPrice: the per-unit/per-seat price (e.g. $21.00/seat -> 21). If the invoice is flat-rate or not seat-based, set this to the total invoice amount and primaryBilledSeats to 1.

4. Extract currency as an ISO 4217 three-letter code (USD, EUR, GBP, INR, etc). Convert symbols ($ , ₹, €, £) to their code.

5. Extract invoiceDate (the date the invoice/receipt was issued) in strict YYYY-MM-DD format.

6. Extract renewalDate: the date the subscription will next renew or expire, in strict YYYY-MM-DD format. Return null if absent.

7. Assign a strong confidence score (0.85 to 1.0) when the vendor name and pricing/seat information are clearly identifiable in the email text or invoice.

8. If you used any fallback/default/guess anywhere, write one short sentence in extractionNotes explaining what was defaulted. Otherwise return null for extractionNotes.

Respond with ONLY the structured JSON — no commentary.`;
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
// Rejects anything that doesn't match the expected format instead of
// silently handing ambiguous strings to `new Date(...)`.
// ─────────────────────────────────────────────────────────

function parseStrictDate(value: string | null | undefined): Date | null {
  if (!value || !DATE_REGEX.test(value.trim())) {
    return null;
  }
  const parsed = new Date(`${value.trim()}T00:00:00Z`);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ─────────────────────────────────────────────────────────
// POST /api/webhooks/inbound
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Webhook Secret Security Gate
    const { searchParams } = request.nextUrl;
    const secret = searchParams.get("secret");

    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      console.error("❌ Unauthorized webhook access: secret token mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: CloudMailinPayload = await request.json();

    const from = payload.headers?.from ?? "";
    const to = payload.headers?.to ?? payload.envelope?.to ?? "";
    const subject = payload.headers?.subject ?? "(no subject)";
    const rawPlain = payload.plain ?? "";
    const rawHtml = payload.html
      ? payload.html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
      : "";
    const textBody = rawPlain.trim() ? rawPlain : rawHtml;

    const workspaceId = extractWorkspaceId(to);

    const pdfAttachment = payload.attachments?.find(
      (att) => att.content_type === "application/pdf"
    );

    if (!textBody.trim() && !pdfAttachment) {
      console.warn("⚠️  Webhook received email with empty body and no PDF attachment");
      return NextResponse.json(
        { error: "Email body and PDF attachments are empty — nothing to process" },
        { status: 400 }
      );
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
    console.log(
      `  Body Preview: ${textBody.substring(0, 200).replace(/\n/g, " ")}${textBody.length > 200 ? "…" : ""}`
    );
    console.log("═══════════════════════════════════════════");

    if (!workspaceId) {
      console.error("❌ Invalid workspace routing ID: null/empty in address");
      return NextResponse.json(
        { success: true, error: "Invalid workspace routing ID" },
        { status: 200 }
      );
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      console.error(`❌ Invalid workspace routing ID: ${workspaceId}`);
      return NextResponse.json(
        { success: true, error: "Invalid workspace routing ID" },
        { status: 200 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is not defined in the environment");
      return NextResponse.json(
        { error: "AI parsing service API key is not configured" },
        { status: 500 }
      );
    }

    let extractedData: ExtractionResult | null = null;
    let source = "TEXT";
    let attachmentName: string | null = null;

    const instructions = buildExtractionInstructions();

    // 1. Try PDF Attachment extraction first (Gemini Native PDF Vision)
    if (pdfAttachment) {
      source = "PDF";
      attachmentName = pdfAttachment.file_name;
      console.log(`📎 Processing PDF attachment: ${attachmentName}`);

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const geminiModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        });

        let response: any;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            attempts++;
            response = await geminiModel.generateContent([
              {
                inlineData: {
                  data: pdfAttachment.content,
                  mimeType: "application/pdf",
                },
              },
              instructions,
            ]);
            break;
          } catch (err) {
            console.warn(`⚠️ Gemini PDF extraction attempt ${attempts} failed:`, err);
            if (attempts >= maxAttempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (!response) {
          throw new Error("No response received from Gemini");
        }

        const textResponse = response.response.text();
        console.log("Gemini PDF Raw Response:", textResponse);
        const parsed = JSON.parse(textResponse);
        extractedData = extractionSchema.parse(parsed);
      } catch (pdfError) {
        console.error("❌ Gemini PDF extraction failed, falling back to text if available:", pdfError);
      }
    }

    // 2. Fall back to plain text email body if PDF parsing didn't run or failed
    if (!extractedData && textBody.trim()) {
      source = "TEXT";
      attachmentName = null;

      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const geminiModel = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
          },
        });

        const promptText =
          `${instructions}\n\n` +
          `--- EMAIL HEADER INFO ---\n` +
          `From: ${from}\n` +
          `Subject: ${subject}\n\n` +
          `--- EMAIL BODY / INVOICE CONTENT ---\n` +
          `${textBody}`;

        let response: any;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            response = await geminiModel.generateContent([promptText]);
            break;
          } catch (err) {
            console.warn(`⚠️ Gemini Text extraction attempt ${attempt} failed:`, err);
            if (attempt >= 3) throw err;
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }

        if (response) {
          const textResponse = response.response.text();
          console.log("Gemini Text Raw Response:", textResponse);
          const parsed = JSON.parse(textResponse);
          extractedData = extractionSchema.parse(parsed);
        }
      } catch (textError) {
        console.error("❌ Gemini text extraction error:", textError);
      }
    }

    // 2b. Deterministic Regex Pattern Fallback (if LLM returned null or was unconfident)
    if (!extractedData || (extractedData.primaryBilledSeats <= 0 && extractedData.seatUnitPrice <= 0)) {
      console.log("🔄 Attempting deterministic regex pattern extractor fallback...");
      const regexFallback = extractInvoiceWithRegex(textBody, subject, from);
      if (regexFallback) {
        console.log("✅ Regex fallback successfully extracted invoice:", regexFallback);
        extractedData = regexFallback;
        if (source !== "PDF") source = "TEXT_REGEX";
      }
    }

    let subscriptionId: string | null = null;
    const bodyPreview = textBody.substring(0, 300);

    // Clean and normalize vendor name
    const cleanedVendor = extractedData?.vendorName ? cleanVendorName(extractedData.vendorName) : "";

    // Track final confidence + currency-guess state for logging,
    // since normalizeCurrency() can itself downgrade confidence.
    let finalConfidence = extractedData?.confidence ?? 0;
    let normalizedCurrency = extractedData?.currency ?? "USD";

    if (extractedData) {
      const { currency, wasGuessed } = normalizeCurrency(extractedData.currency);
      normalizedCurrency = currency;
      if (wasGuessed) {
        finalConfidence = Math.min(finalConfidence, 0.7);
      }
    }

    // If valid vendor and pricing was extracted, ensure a strong baseline confidence score (>= 0.85)
    if (extractedData && cleanedVendor && extractedData.seatUnitPrice > 0 && finalConfidence < 0.85) {
      finalConfidence = 0.88;
    }

    const isValidReceipt = Boolean(
      extractedData &&
      cleanedVendor &&
      (extractedData.wasReceipt !== false) &&
      (extractedData.primaryBilledSeats > 0 || extractedData.seatUnitPrice > 0 || (extractedData.totalAmount && extractedData.totalAmount > 0))
    );

    let calculatedAmount: number | null = null;

    // 3. Database Upsert & Logging
    if (isValidReceipt && extractedData) {
      console.log("Gemini Extraction Success:", { ...extractedData, cleanedVendor });
      if (extractedData.extractionNotes) {
        console.log(`ℹ️  Extraction note: ${extractedData.extractionNotes}`);
      }

      const isAnnual =
        textBody.toLowerCase().includes("annual") ||
        textBody.toLowerCase().includes("year") ||
        subject.toLowerCase().includes("annual") ||
        subject.toLowerCase().includes("year");
      const billingCycle = isAnnual ? "ANNUAL" : "MONTHLY";

      const invoiceDate = parseStrictDate(extractedData.invoiceDate);
      const renewalDate = parseStrictDate(extractedData.renewalDate);

      let nextRenewalDate: Date;

      if (renewalDate) {
        nextRenewalDate = renewalDate;
      } else if (invoiceDate) {
        nextRenewalDate = new Date(invoiceDate);
        if (billingCycle === "MONTHLY") {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 30);
        } else {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 365);
        }
      } else {
        nextRenewalDate = new Date();
        if (billingCycle === "MONTHLY") {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 30);
        } else {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 365);
        }
      }

      const billedSeats = extractedData.primaryBilledSeats > 0 ? extractedData.primaryBilledSeats : 1;
      let unitPrice = extractedData.seatUnitPrice > 0 ? extractedData.seatUnitPrice : 0;
      let amount = billedSeats * unitPrice;

      if (amount === 0 && extractedData.totalAmount && extractedData.totalAmount > 0) {
        amount = extractedData.totalAmount;
        unitPrice = billedSeats > 1 ? Math.round((amount / billedSeats) * 100) / 100 : amount;
      }

      calculatedAmount = amount;

      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          workspaceId: workspace.id,
          merchantName: {
            equals: cleanedVendor,
            mode: "insensitive",
          },
        },
      });

      if (existingSubscription) {
        const updated = await prisma.subscription.update({
          where: { id: existingSubscription.id },
          data: {
            amount,
            billingCycle,
            currency: normalizedCurrency,
            confidenceScore: finalConfidence,
            nextRenewalDate,
            status: "ACTIVE",
            billedSeats,
            seatUnitPrice: unitPrice,
          },
        });
        subscriptionId = updated.id;
        console.log(
          `✅ Updated existing subscription for "${cleanedVendor}" in workspace ${workspace.id} (confidence: ${finalConfidence})`
        );
      } else {
        const created = await prisma.subscription.create({
          data: {
            workspaceId: workspace.id,
            merchantName: cleanedVendor,
            amount,
            currency: normalizedCurrency,
            billingCycle,
            confidenceScore: finalConfidence,
            nextRenewalDate,
            status: "ACTIVE",
            billedSeats,
            seatUnitPrice: unitPrice,
          },
        });
        subscriptionId = created.id;
        console.log(
          `✅ Created new subscription for "${cleanedVendor}" in workspace ${workspace.id} (confidence: ${finalConfidence})`
        );
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
        wasReceipt: isValidReceipt,
        merchantName: cleanedVendor || extractedData?.vendorName || null,
        amount: calculatedAmount ?? (extractedData?.totalAmount ?? null),
        confidenceScore: finalConfidence,
        rawExtraction: extractedData ? JSON.stringify({ ...extractedData, cleanedVendor }) : null,
        workspaceId: workspace.id,
        subscriptionId,
      },
    });

    return NextResponse.json({ success: true, isReceipt: isValidReceipt }, { status: 200 });
  } catch (error) {
    console.error("⚠️  Webhook main handler error:", error);
    return NextResponse.json(
      { error: "Bad Request — invalid JSON payload" },
      { status: 400 }
    );
  }
}