import React, { Suspense } from "react";
import { getIntegrations } from "@/app/actions/integrations";
import { IntegrationsList } from "@/components/dashboard/IntegrationsList";
import { OAuthStatusBanner } from "@/components/dashboard/OAuthStatusBanner";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  try {
    const activeIntegrations = await getIntegrations();

    return (
      <div className="space-y-6 max-w-6xl">
        {/* OAuth redirect feedback banner */}
        <Suspense fallback={null}>
          <OAuthStatusBanner />
        </Suspense>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            App Integrations
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-subtle max-w-2xl">
            Connect your workspace platforms to automatically audit inactive
            user seats and optimize costs.
          </p>
        </div>

        {/* Client-side Integrations List with Search and Stats */}
        <IntegrationsList activeIntegrations={activeIntegrations} />

        {/* Footer note */}
        <div className="rounded-lg border border-hairline bg-white p-4 shadow-sm">
          <p className="text-xs text-ink-subtle leading-relaxed">
            <span className="font-semibold text-ink-muted">
              How it works:
            </span>{" "}
            When you connect a platform, SpendSync securely stores a read-only
            API token scoped to your workspace. Our optimization engine then
            periodically queries the platform&apos;s user directory to identify
            inactive seats, cross-references them against your billing data, and
            surfaces concrete savings recommendations on your dashboard.
          </p>
        </div>
      </div>
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Dynamic server usage") ||
        (error as any).digest === "DYNAMIC_SERVER_USAGE")
    ) {
      throw error;
    }

    console.error("❌ Failed to load integrations page:", error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 mb-4 font-bold">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Unable to load integrations
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          There was an error communicating with the database. Please try
          reloading the page.
        </p>
      </div>
    );
  }
}
