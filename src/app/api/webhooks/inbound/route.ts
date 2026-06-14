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
  [key: string]: string; // Additional headers we don't need yet
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
  plain: string;    // Raw text body of the email
  html?: string;    // HTML body (optional)
  reply_plain?: string;
  attachments?: CloudMailinAttachment[];
}

// ─────────────────────────────────────────────────────────
// Zod Schema for Structured LLM Output (Step 7)
// ─────────────────────────────────────────────────────────

const extractionSchema = z.object({
  vendorName: z.string().describe("The name of the vendor/merchant in uppercase, e.g., FIGMA"),
  primaryBilledSeats: z.number().int().describe("Locate the explicit line item for 'Figma Design (seats)' or 'Professional plan'. Extract ONLY the value from the Quantity column for this row. Ignore Dev Mode quantities, subtotals, taxes, or total dollar balances. For non-seat-based invoices (e.g. AWS) or if seat details are missing, default to 1."),
  seatUnitPrice: z.number().describe("The unit price per seat, e.g. 15.00. For non-seat-based invoices (e.g. AWS) or if seat details are missing, default to the total invoice amount."),
  currency: z.string().describe("The currency of the transaction, e.g. USD or INR"),
});

type ExtractionResult = z.infer<typeof extractionSchema>;

// ─────────────────────────────────────────────────────────
// Utility: Extract workspace ID from the "To" address
//
// CloudMailin addresses follow the pattern:
//   hash+workspaceId@cloudmailin.net
//
// e.g. ac863b2208948441ba11+workspace123@cloudmailin.net
//      → extracts "workspace123"
// ─────────────────────────────────────────────────────────

function extractWorkspaceId(toAddress: string): string | null {
  const match = toAddress.match(/\+([^@]+)@/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────
// POST /api/webhooks/inbound
//
// Receives inbound emails from CloudMailin, extracts workspace,
// runs Gemini extraction (PDF attachment vision or text fallback),
// upserts into database using Prisma, and records in EmailLog.
// ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Webhook Secret Security Gate (Step 11)
    const { searchParams } = request.nextUrl;
    const secret = searchParams.get("secret");

    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      console.error("❌ Unauthorized webhook access: secret token mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload: CloudMailinPayload = await request.json();

    // Extract fields from CloudMailin's normalized JSON
    const from = payload.headers?.from ?? "";
    const to = payload.headers?.to ?? payload.envelope?.to ?? "";
    const subject = payload.headers?.subject ?? "(no subject)";
    const textBody = payload.plain ?? "";

    // Extract workspace ID from the "To" address
    const workspaceId = extractWorkspaceId(to);

    // Filter for PDF attachments
    const pdfAttachment = payload.attachments?.find(
      (att) => att.content_type === "application/pdf"
    );

    // Validate: we need either text body or a PDF attachment for AI extraction
    if (!textBody.trim() && !pdfAttachment) {
      console.warn("⚠️  Webhook received email with empty body and no PDF attachment");
      return NextResponse.json(
        { error: "Email body and PDF attachments are empty — nothing to process" },
        { status: 400 }
      );
    }

    // Log the extracted raw data for inspection
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

    // Workspace Validation (Step 8)
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

    // Authenticate Gemini API Key
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is not defined in the environment");
      return NextResponse.json(
        { error: "Gemini API key is not configured" },
        { status: 500 }
      );
    }

    let extractedData: ExtractionResult | null = null;
    let source = "TEXT";
    let attachmentName: string | null = null;

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
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                vendorName: { type: SchemaType.STRING, description: "The name of the vendor/merchant in uppercase, e.g., FIGMA" },
                primaryBilledSeats: { type: SchemaType.INTEGER, description: "Locate the explicit line item for 'Figma Design (seats)' or 'Professional plan'. Extract ONLY the value from the Quantity column for this row. Ignore Dev Mode quantities, subtotals, taxes, or total dollar balances. For non-seat-based invoices (e.g. AWS) or if seat details are missing, default to 1." },
                seatUnitPrice: { type: SchemaType.NUMBER, description: "The unit price per seat, e.g. 15.00. For non-seat-based invoices (e.g. AWS) or if seat details are missing, default to the total invoice amount." },
                currency: { type: SchemaType.STRING, description: "The currency of the transaction, e.g. USD or INR" }
              },
              required: ["vendorName", "primaryBilledSeats", "seatUnitPrice", "currency"]
            } as any
          }
        });

        // CloudMailin provides attachments as base64 content
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
                  mimeType: "application/pdf"
                }
              },
              "You are a highly accurate financial extraction AI. Analyze this PDF invoice/receipt and extract the vendorName, primaryBilledSeats, seatUnitPrice, and currency. Locate the explicit line item for 'Figma Design (seats)' or 'Professional plan'. Extract ONLY the value from the Quantity column for this row. Ignore Dev Mode quantities, subtotals, taxes, or total dollar balances."
            ]);
            break; // Success
          } catch (err) {
            console.warn(`⚠️ Gemini PDF extraction attempt ${attempts} failed:`, err);
            if (attempts >= maxAttempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1500)); // wait 1.5s
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
          "You are a highly accurate financial extraction AI. Analyze the following email text.\n\n" +
          "Extract the vendorName, primaryBilledSeats, seatUnitPrice, and currency. Locate the explicit line item for 'Figma Design (seats)' or 'Professional plan'. Extract ONLY the value from the Quantity column for this row. Ignore Dev Mode quantities, subtotals, taxes, or total dollar balances.\n\n" +
          "Email text:\n{emailText}"
        );

        const chain = prompt.pipe(structuredModel);
        extractedData = (await chain.invoke({ emailText: textBody })) as ExtractionResult;
      } catch (textError) {
        console.error("❌ Gemini text extraction failed:", textError);
      }
    }

    let subscriptionId: string | null = null;
    const bodyPreview = textBody.substring(0, 300);

    // 3. Database Upsert & Logging
    if (extractedData && extractedData.primaryBilledSeats > 0) {
      console.log("Gemini Extraction Success:", extractedData);

      // Calculate nextRenewalDate
      const nextRenewalDate = new Date();
      const isAnnual = textBody.toLowerCase().includes("annual") || 
                       textBody.toLowerCase().includes("year") || 
                       subject.toLowerCase().includes("annual") || 
                       subject.toLowerCase().includes("year");
      const billingCycle = isAnnual ? "ANNUAL" : "MONTHLY";

      if (billingCycle === "MONTHLY") {
        nextRenewalDate.setDate(nextRenewalDate.getDate() + 30);
      } else {
        nextRenewalDate.setDate(nextRenewalDate.getDate() + 365);
      }

      // Check if a subscription already exists (case-insensitive merchantName match)
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
            amount: amount,
            billingCycle: billingCycle,
            currency: extractedData.currency,
            confidenceScore: 0.95,
            nextRenewalDate,
            status: "ACTIVE", // Re-activate if it was cancelled
            billedSeats: extractedData.primaryBilledSeats,
            seatUnitPrice: extractedData.seatUnitPrice,
          },
        });
        subscriptionId = updated.id;
        console.log(`✅ Updated existing subscription for "${extractedData.vendorName}" in workspace ${workspace.id}`);
      } else {
        const created = await prisma.subscription.create({
          data: {
            workspaceId: workspace.id,
            merchantName: extractedData.vendorName,
            amount: amount,
            currency: extractedData.currency,
            billingCycle: billingCycle,
            confidenceScore: 0.95,
            nextRenewalDate,
            status: "ACTIVE",
            billedSeats: extractedData.primaryBilledSeats,
            seatUnitPrice: extractedData.seatUnitPrice,
          },
        });
        subscriptionId = created.id;
        console.log(`✅ Created new subscription for "${extractedData.vendorName}" in workspace ${workspace.id}`);
      }
    } else {
      console.log("ℹ️  Not identified as a subscription receipt:", extractedData);
    }

    // Record the operation in EmailLog table
    await prisma.emailLog.create({
      data: {
        senderEmail: from,
        subject: subject,
        bodyPreview: bodyPreview,
        source: source,
        attachmentName: attachmentName,
        wasReceipt: extractedData ? (extractedData.primaryBilledSeats > 0) : false,
        merchantName: extractedData?.vendorName ?? null,
        amount: extractedData ? (extractedData.primaryBilledSeats * extractedData.seatUnitPrice) : null,
        confidenceScore: 0.95,
        rawExtraction: extractedData ? JSON.stringify(extractedData) : null,
        workspaceId: workspace.id,
        subscriptionId: subscriptionId,
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
