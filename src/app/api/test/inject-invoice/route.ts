import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const GEMINI_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    vendorName: {
      type: SchemaType.STRING,
      description: "The name of the vendor/merchant in uppercase, e.g., FIGMA, AWS, GITHUB",
    },
    primaryBilledSeats: {
      type: SchemaType.INTEGER,
      description: "Quantity for the primary recurring line item. Default to 1 if not seat-based.",
    },
    seatUnitPrice: {
      type: SchemaType.NUMBER,
      description: "Unit price per seat/license for the primary line item. Default to total invoice amount if not seat-based.",
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
} as any;

function cleanVendorName(raw: string): string {
  let cleaned = (raw || "").trim().toUpperCase();
  cleaned = cleaned.replace(/^(FWD?|RE|FW)\s*:\s*/i, "");
  cleaned = cleaned.replace(/^(INVOICE|RECEIPT|BILL|BILLING|STATEMENT|PAYMENT)\s+(FROM|FOR|OF)\s+/i, "");
  cleaned = cleaned.replace(/^(YOUR\s+)?(INVOICE|RECEIPT|BILL|STATEMENT|PAYMENT)\s*:\s*/i, "");
  cleaned = cleaned.replace(/^(AUTOMATIC\s+PAYMENT\s+FOR\s+)/i, "");
  cleaned = cleaned.replace(/^(YOUR\s+)?(SUBSCRIPTION\s+TO\s+)/i, "");
  cleaned = cleaned.replace(/\s+(INC\.?|LLC|LTD\.?|CORP\.?|CORPORATION|TECHNOLOGIES|SERVICES)$/i, "");
  return cleaned.trim() || (raw || "").trim().toUpperCase();
}

function extractInvoiceWithRegex(body: string, subject: string, from: string) {
  const combined = `${subject} ${from} ${body}`.toLowerCase();

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

  let seats = 1;
  const seatsMatch =
    body.match(/(\d+)\s*(?:enterprise\s*seats?|business\s*seats?|pro\s*seats?|seats?|licenses?|users?|members?|hosts?)/i) ||
    body.match(/(?:seats?|licenses?|users?|members?|quantity|qty)\s*[:=x@]\s*(\d+)/i) ||
    subject.match(/(\d+)\s*(?:seats?|licenses?|users?)/i);

  if (seatsMatch && parseInt(seatsMatch[1], 10) > 0) {
    seats = parseInt(seatsMatch[1], 10);
  }

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText = body.rawText ?? "";
    const subject = body.subject ?? "Invoice from GitHub Enterprise";
    const from = body.from ?? "billing@github.com";

    let targetWorkspaceId = body.workspaceId;

    if (!targetWorkspaceId) {
      const firstWorkspace = await prisma.workspace.findFirst();
      if (!firstWorkspace) {
        return NextResponse.json({ error: "No workspace found in database" }, { status: 404 });
      }
      targetWorkspaceId = firstWorkspace.id;
    }

    let extractedData: any = null;

    // 1. Try Gemini LLM direct extraction
    if (process.env.GEMINI_API_KEY && rawText.trim()) {
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
          `Extract structured invoice and seat data from this email:\n\n` +
          `From: ${from}\nSubject: ${subject}\n\nContent:\n${rawText}`;

        const res = await geminiModel.generateContent([promptText]);
        const text = res.response.text();
        extractedData = JSON.parse(text);
      } catch (err) {
        console.error("Test inject LLM extraction failed:", err);
      }
    }

    // 2. Fallback to Regex Extractor
    if (!extractedData || (extractedData.primaryBilledSeats <= 0 && extractedData.seatUnitPrice <= 0)) {
      extractedData = extractInvoiceWithRegex(rawText, subject, from);
    }

    if (!extractedData) {
      return NextResponse.json({
        success: false,
        error: "Could not extract valid vendor or pricing details from text",
      }, { status: 422 });
    }

    const cleanedVendor = cleanVendorName(extractedData.vendorName);
    const billedSeats = extractedData.primaryBilledSeats > 0 ? extractedData.primaryBilledSeats : 1;
    const seatUnitPrice = extractedData.seatUnitPrice > 0 ? extractedData.seatUnitPrice : 0;
    const amount = billedSeats * seatUnitPrice;
    const currency = extractedData.currency || "USD";
    const confidenceScore = Math.max(extractedData.confidence || 0.85, 0.88);

    const nextRenewalDate = new Date();
    nextRenewalDate.setUTCDate(nextRenewalDate.getUTCDate() + 30);

    // Upsert Subscription
    const existing = await prisma.subscription.findFirst({
      where: {
        workspaceId: targetWorkspaceId,
        merchantName: { equals: cleanedVendor, mode: "insensitive" },
      },
    });

    let subscription;
    if (existing) {
      subscription = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          amount,
          billedSeats,
          seatUnitPrice,
          currency,
          confidenceScore,
          status: "ACTIVE",
          nextRenewalDate,
        },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          workspaceId: targetWorkspaceId,
          merchantName: cleanedVendor,
          amount,
          billedSeats,
          seatUnitPrice,
          currency,
          billingCycle: "MONTHLY",
          confidenceScore,
          status: "ACTIVE",
          nextRenewalDate,
        },
      });
    }

    // Create Email Log
    const emailLog = await prisma.emailLog.create({
      data: {
        senderEmail: from,
        subject,
        bodyPreview: rawText.substring(0, 300),
        source: "MANUAL_INJECT",
        wasReceipt: true,
        merchantName: cleanedVendor,
        amount,
        confidenceScore,
        rawExtraction: JSON.stringify({ ...extractedData, cleanedVendor }),
        workspaceId: targetWorkspaceId,
        subscriptionId: subscription.id,
      },
    });

    return NextResponse.json({
      success: true,
      wasReceipt: true,
      subscription,
      emailLog,
      extractedData: { ...extractedData, cleanedVendor },
    }, { status: 200 });
  } catch (error: any) {
    console.error("Test inject handler error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
