// ─────────────────────────────────────────────────────────
// Baseline Single-Prompt Audit
//
// A naive, un-orchestrated LLM call that receives both the
// invoice text AND user activity list in a single prompt.
// Used as a comparison benchmark against the multi-agent
// pipeline to demonstrate agentic advantages.
// ─────────────────────────────────────────────────────────

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";

const baselineOutputSchema = z.object({
  recommendedSeatCuts: z
    .number()
    .int()
    .nonnegative()
    .describe("Number of seats the model recommends removing."),
  estimatedSavings: z
    .number()
    .nonnegative()
    .describe("Estimated monthly dollar savings from cutting those seats."),
  rawSummary: z
    .string()
    .describe(
      "A short 2-4 sentence plain-English summary of the recommendation " +
      "including which users or seat types should be reviewed."
    ),
});

type BaselineResult = z.infer<typeof baselineOutputSchema>;

const BASELINE_PROMPT = PromptTemplate.fromTemplate(`You are a SaaS cost-optimization auditor. You are given an invoice/billing document and a list of user accounts with their last-activity timestamps.

Your job:
1. Determine how many seats are currently billed.
2. Identify users who have not been active in the last 30 days.
3. Recommend how many seats to cut and estimate the monthly savings.

Be conservative — do NOT recommend cutting admin, service-account, or bot users.

--- INVOICE DATA ---
{invoiceText}

--- USER ACTIVITY DATA ---
{userActivityData}

Respond with ONLY the structured JSON — no commentary.`);

/**
 * Runs a single-prompt baseline audit that sends both invoice
 * and user data to Gemini in one shot. No orchestration, no
 * verification, no adversarial checks.
 */
export async function runBaselineAudit(
  invoiceText: string,
  userActivityData: any
): Promise<BaselineResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }

  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
    apiKey,
  });

  const structuredModel = model.withStructuredOutput(baselineOutputSchema);

  const chain = BASELINE_PROMPT.pipe(structuredModel);

  const activityString =
    typeof userActivityData === "string"
      ? userActivityData
      : JSON.stringify(userActivityData, null, 2);

  try {
    const result = (await chain.invoke({
      invoiceText: invoiceText || "(No invoice text provided)",
      userActivityData: activityString,
    })) as BaselineResult;

    return {
      recommendedSeatCuts: result.recommendedSeatCuts,
      estimatedSavings: Math.round(result.estimatedSavings * 100) / 100,
      rawSummary: result.rawSummary,
    };
  } catch (error) {
    console.error("❌ Baseline audit LLM call failed:", error);
    return {
      recommendedSeatCuts: 0,
      estimatedSavings: 0,
      rawSummary:
        "Baseline audit failed due to an LLM error. " +
        "No recommendations could be generated.",
    };
  }
}
