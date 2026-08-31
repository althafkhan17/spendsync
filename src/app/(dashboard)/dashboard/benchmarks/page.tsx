import React from "react";
import fs from "fs";
import path from "path";
import { BenchmarkViewer } from "@/components/dashboard/BenchmarkViewer";
import type { BenchmarkSuiteSummary } from "../../../../../scripts/evaluate";

export const dynamic = "force-dynamic";

export default async function BenchmarksPage() {
  let initialSummary: BenchmarkSuiteSummary | null = null;

  try {
    const resultsPath = path.resolve(process.cwd(), "benchmarks", "results.json");
    if (fs.existsSync(resultsPath)) {
      const content = fs.readFileSync(resultsPath, "utf-8");
      initialSummary = JSON.parse(content);
    }
  } catch (error) {
    console.warn("⚠️ Could not load cached benchmark results.json:", error);
  }

  return <BenchmarkViewer initialSummary={initialSummary} />;
}
