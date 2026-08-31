"use server";

import { auth } from "@clerk/nextjs/server";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { runBenchmarkSuite, type BenchmarkSuiteSummary } from "../../../scripts/evaluate";

/**
 * Server Action to run the live 16-case benchmark evaluation suite
 * directly from the authenticated web dashboard.
 */
export async function runLiveBenchmarkSuite(): Promise<BenchmarkSuiteSummary> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  await ensureUserAndWorkspace();

  console.log("📊 Running Live Benchmark Suite via Server Action...");
  const summary = await runBenchmarkSuite();
  return summary;
}
