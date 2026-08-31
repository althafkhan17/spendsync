// ─────────────────────────────────────────────────────────
// Invoice Agent
//
// Specialized extraction agent that parses invoice documents
// (text or PDF) and produces a rich InvoiceContext including
// contract minimums, tiered pricing, and renewal penalties
// that downstream agents need for safe verification.
// ─────────────────────────────────────────────────────────

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { InvoiceContext, InvoiceLineItem, AgentActionTrace } from "./types";

// The JSON response schema given to Gemini's structured-output mode.
// Kept as a plain object so it can be passed directly to `responseSchema`.
const INVOICE_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    vendorName: {
      type: SchemaType.STRING,
      description: "Vendor / merchant name in UPPERCASE (e.g. FIGMA, GITHUB).",
    },
    invoiceDate: {
      type: SchemaType.STRING,
      description: "Invoice issue date in YYYY-MM-DD format, or empty string if not found.",
    },
    renewalDate: {
      type: SchemaType.STRING,
      description: "Next renewal / expiry date in YYYY-MM-DD, or empty string if not found.",
    },
    billedSeats: {
      type: SchemaType.INTEGER,
      description: "Total seats / licenses billed on this invoice. Default 1 if not seat-based.",
    },
    seatUnitPrice: {
      type: SchemaType.NUMBER,
      description: "Per-seat unit price. If not seat-based, use total amount and set billedSeats=1.",
    },
    totalAmount: {
      type: SchemaType.NUMBER,
      description: "Grand total amount charged on this invoice.",
    },
    currency: {
      type: SchemaType.STRING,
      description: "ISO 4217 currency code (e.g. USD, EUR, INR).",
    },
    lineItems: {
      type: SchemaType.ARRAY,
      description: "All itemized line items found on the invoice.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          quantity: { type: SchemaType.INTEGER },
          unitPrice: { type: SchemaType.NUMBER },
          lineTotal: { type: SchemaType.NUMBER },
          isPrimary: {
            type: SchemaType.BOOLEAN,
            description: "True if this is the main recurring subscription line item.",
          },
        },
        required: ["description", "quantity", "unitPrice", "lineTotal", "isPrimary"],
      },
    },
    contractMinimumSeats: {
      type: SchemaType.INTEGER,
      description:
        "Contractual minimum seat commitment. 0 if none found or not applicable.",
    },
    renewalPenaltyTerms: {
      type: SchemaType.STRING,
      description:
        "Any early-termination or seat-reduction penalty language found on the invoice, or empty string.",
    },
    tieredPricing: {
      type: SchemaType.ARRAY,
      description: "Pricing tiers found (e.g. 1-10 seats at $X, 11-50 at $Y). Empty array if flat pricing.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          tierName: { type: SchemaType.STRING },
          minSeats: { type: SchemaType.INTEGER },
          maxSeats: { type: SchemaType.INTEGER },
          pricePerSeat: { type: SchemaType.NUMBER },
        },
        required: ["tierName", "minSeats", "maxSeats", "pricePerSeat"],
      },
    },
    evidence: {
      type: SchemaType.ARRAY,
      description:
        "Short bullet-point quotes or references from the document that support each extracted field.",
      items: { type: SchemaType.STRING },
    },
  },
  required: [
    "vendorName",
    "billedSeats",
    "seatUnitPrice",
    "totalAmount",
    "currency",
    "lineItems",
    "contractMinimumSeats",
    "tieredPricing",
    "evidence",
  ],
} as any;

const INVOICE_INSTRUCTIONS = `You are a meticulous financial document extraction AI specializing in SaaS invoices.

You will be given an invoice, receipt, or billing document. Extract ALL of the following:

1. **Vendor name** — normalized to UPPERCASE.
2. **Line items table** — every row with description, quantity, unit price, line total.
   Mark exactly one row as the PRIMARY recurring subscription charge (isPrimary=true).
3. **Billed seats / licenses** — the quantity on the primary line item.
4. **Seat unit price** — the per-unit price on the primary line item.
5. **Total amount** — the grand total charged.
6. **Currency** — ISO 4217 code.
7. **Invoice date** — in YYYY-MM-DD. Empty string if absent.
8. **Renewal / expiry date** — in YYYY-MM-DD. Empty string if absent.
9. **Contract minimum seats** — if the document mentions a minimum seat commitment, annual commitment,
   or a floor below which seats cannot be reduced, extract that number. Use 0 if none found.
10. **Renewal penalty terms** — any language about early termination fees, mid-cycle reduction penalties,
    or pro-rated refund policies. Empty string if none found.
11. **Tiered pricing** — if the invoice shows volume-based or tiered pricing brackets, list each tier.
    Empty array if flat pricing.
12. **Evidence** — for each key field extracted, include a short quote or reference from the source
    document proving where the value came from.

Respond with ONLY the structured JSON — no commentary.`;

export interface InvoiceAgentInput {
  rawText?: string;
  pdfBuffer?: Buffer;
  metadata?: Record<string, unknown>;
}

export interface InvoiceAgentOutput extends InvoiceContext {
  trace: AgentActionTrace;
}

/**
 * Runs the InvoiceAgent: parses an invoice document (text or PDF)
 * into a rich InvoiceContext with contract terms and evidence.
 */
export async function runInvoiceAgent(
  input: InvoiceAgentInput
): Promise<InvoiceAgentOutput> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }

  const inputSummary = input.pdfBuffer
    ? `PDF buffer (${input.pdfBuffer.length} bytes)`
    : `Text (${(input.rawText?.length ?? 0)} chars)`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: INVOICE_RESPONSE_SCHEMA,
      },
    });

    // Build the request parts depending on whether we have a PDF or plain text.
    const parts: any[] = [];

    if (input.pdfBuffer) {
      parts.push({
        inlineData: {
          data: input.pdfBuffer.toString("base64"),
          mimeType: "application/pdf",
        },
      });
    }

    parts.push(
      INVOICE_INSTRUCTIONS +
        (input.rawText ? `\n\n--- INVOICE TEXT ---\n${input.rawText}` : "")
    );

    // Retry loop (up to 3 attempts with backoff)
    let response: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await model.generateContent(parts);
        break;
      } catch (err) {
        console.warn(`⚠️ InvoiceAgent attempt ${attempt}/3 failed:`, err);
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }

    if (!response) {
      throw new Error("InvoiceAgent received no response from Gemini.");
    }

    const raw = JSON.parse(response.response.text());

    // Normalize extracted data into our typed interface
    const lineItems: InvoiceLineItem[] = (raw.lineItems ?? []).map((li: any) => ({
      description: li.description ?? "",
      quantity: li.quantity ?? 1,
      unitPrice: li.unitPrice ?? 0,
      lineTotal: li.lineTotal ?? 0,
      isPrimary: li.isPrimary ?? false,
    }));

    const context: InvoiceContext = {
      vendorName: (raw.vendorName ?? "UNKNOWN").toUpperCase(),
      invoiceDate: raw.invoiceDate || null,
      renewalDate: raw.renewalDate || null,
      billedSeats: raw.billedSeats ?? 1,
      seatUnitPrice: raw.seatUnitPrice ?? 0,
      totalAmount: raw.totalAmount ?? 0,
      currency: (raw.currency ?? "USD").toUpperCase(),
      lineItems,
      contractMinimumSeats: raw.contractMinimumSeats > 0 ? raw.contractMinimumSeats : null,
      renewalPenaltyTerms: raw.renewalPenaltyTerms || null,
      tieredPricing: (raw.tieredPricing ?? []).map((t: any) => ({
        tierName: t.tierName ?? "",
        minSeats: t.minSeats ?? 0,
        maxSeats: t.maxSeats > 0 ? t.maxSeats : null,
        pricePerSeat: t.pricePerSeat ?? 0,
      })),
      evidence: raw.evidence ?? [],
    };

    const durationMs = Date.now() - startTime;

    const trace: AgentActionTrace = {
      stepName: "Extract Invoice Data",
      agentName: "InvoiceAgent",
      inputSummary,
      findings:
        `Extracted ${context.vendorName}: ${context.billedSeats} seats × ` +
        `${context.currency} ${context.seatUnitPrice}/seat = ${context.currency} ${context.totalAmount}. ` +
        `Contract min: ${context.contractMinimumSeats ?? "none"}. ` +
        `${context.lineItems.length} line item(s), ${context.evidence.length} evidence point(s).`,
      status: "SUCCESS",
      timestamp: new Date().toISOString(),
      durationMs,
    };

    return { ...context, trace };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error("❌ InvoiceAgent failed:", error);

    const trace: AgentActionTrace = {
      stepName: "Extract Invoice Data",
      agentName: "InvoiceAgent",
      inputSummary,
      findings: `Failed: ${error.message ?? "Unknown error"}`,
      status: "ERROR",
      timestamp: new Date().toISOString(),
      durationMs,
    };

    // Return a minimal context so downstream agents can still attempt to run
    return {
      vendorName: "UNKNOWN",
      invoiceDate: null,
      renewalDate: null,
      billedSeats: 0,
      seatUnitPrice: 0,
      totalAmount: 0,
      currency: "USD",
      lineItems: [],
      contractMinimumSeats: null,
      renewalPenaltyTerms: null,
      tieredPricing: [],
      evidence: [],
      trace,
    };
  }
}
