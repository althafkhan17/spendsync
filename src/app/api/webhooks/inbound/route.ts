import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
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
// Note: the schema description text below is reused (in slightly
// different shapes) for both the Gemini Vision JSON schema AND the
// LangChain text-path schema, so keep them in sync — see
// `buildExtractionPrompt()` which is now the single source of truth
// for the *instructional* prompt text.
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

5. Extract invoiceDate (the date the invoice/receipt was issued) in strict YYYY-MM-DD format.

6. Extract renewalDate: the date the subscription will next renew, auto-renew, or expire. Look for phrasing like "active until June 17, 2026", "renews on", "your subscription will renew on", or a billing-period end date. Format as strict YYYY-MM-DD. If genuinely absent, return null — do not guess.

7. Self-report a confidence score from 0 to 1 for how certain you are that vendorName, primaryBilledSeats, and seatUnitPrice came from an explicit, unambiguous source (not inferred or defaulted). If you had to default seats to 1, or guess between two candidate rows, your confidence should be below 0.5.

8. If you used any fallback/default/guess anywhere, write one short sentence in extractionNotes explaining what you defaulted and why. Otherwise return null for extractionNotes.

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
    const textBody = payload.plain ?? "";

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
            // Low temperature isn't exposed on this SDK's generationConfig type
            // for structured JSON the same way as chat, but Vision JSON mode is
            // already low-variance; keeping this explicit for future SDK bumps.
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                vendorName: {
                  type: SchemaType.STRING,
                  description: "The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB",
                },
                primaryBilledSeats: {
                  type: SchemaType.INTEGER,
                  description:
                    "Quantity for the single primary recurring line item. Default to 1 if not seat-based.",
                },
                seatUnitPrice: {
                  type: SchemaType.NUMBER,
                  description:
                    "Unit price for the primary line item. Default to total invoice amount if not seat-based.",
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
            } as any,
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
        const model = new ChatGoogleGenerativeAI({
          model: "gemini-2.5-flash",
          temperature: 0,
          apiKey: process.env.GEMINI_API_KEY,
        });

        const structuredModel = model.withStructuredOutput(extractionSchema);
        const prompt = PromptTemplate.fromTemplate(
          "{instructions}\n\nEmail text:\n{emailText}"
        );

        const chain = prompt.pipe(structuredModel);
        extractedData = (await chain.invoke({
          instructions,
          emailText: textBody,
        })) as ExtractionResult;
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

    // 3. Database Upsert & Logging
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
        // No usable date in the document at all — lower confidence,
        // since the renewal-alert engine depends entirely on this date.
        finalConfidence = Math.min(finalConfidence, 0.4);
        nextRenewalDate = new Date();
        if (billingCycle === "MONTHLY") {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 30);
        } else {
          nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 365);
        }
      }

      const existingSubscription = await prisma.subscription.findFirst({
        where: {
          workspaceId: workspace.id,
          merchantName: {
            equals: extractedData.vendorName,
            mode: "insensitive",
          },
        },
      });

      const amount = extractedData.primaryBilledSeats * extractedData.seatUnitPrice;

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
            billedSeats: extractedData.primaryBilledSeats,
            seatUnitPrice: extractedData.seatUnitPrice,
          },
        });
        subscriptionId = updated.id;
        console.log(
          `✅ Updated existing subscription for "${extractedData.vendorName}" in workspace ${workspace.id} (confidence: ${finalConfidence})`
        );
      } else {
        const created = await prisma.subscription.create({
          data: {
            workspaceId: workspace.id,
            merchantName: extractedData.vendorName,
            amount,
            currency: normalizedCurrency,
            billingCycle,
            confidenceScore: finalConfidence,
            nextRenewalDate,
            status: "ACTIVE",
            billedSeats: extractedData.primaryBilledSeats,
            seatUnitPrice: extractedData.seatUnitPrice,
          },
        });
        subscriptionId = created.id;
        console.log(
          `✅ Created new subscription for "${extractedData.vendorName}" in workspace ${workspace.id} (confidence: ${finalConfidence})`
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
    console.error("⚠️  Webhook main handler error:", error);
    return NextResponse.json(
      { error: "Bad Request — invalid JSON payload" },
      { status: 400 }
    );
  }
}