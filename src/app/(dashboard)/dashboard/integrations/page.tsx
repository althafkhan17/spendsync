import React, { Suspense } from "react";
import { getIntegrations } from "@/app/actions/integrations";
import { IntegrationCard } from "@/components/dashboard/IntegrationCard";
import { OAuthStatusBanner } from "@/components/dashboard/OAuthStatusBanner";
import { Plug, ShieldCheck, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

/** Hardcoded list of supported providers — rendered as cards */
const PROVIDER_KEYS = ["FIGMA", "SLACK", "ZOOM", "GITHUB", "GITHUB_COPILOT"];

export default async function IntegrationsPage() {
  try {
    const activeIntegrations = await getIntegrations();

    // Quick stats
    const connectedCount = activeIntegrations.filter((i) => i.isActive).length;
    const pendingAuditCount = activeIntegrations.filter(
      (i) => i.isActive && !i.lastAuditAt
    ).length;

    return (
      <div className="space-y-6 max-w-6xl">
        {/* OAuth redirect feedback banner */}
        <Suspense fallback={null}>
          <OAuthStatusBanner />
        </Suspense>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            App Integrations
          </h1>
          <p className="mt-1.5 text-[15px] text-slate-500 max-w-2xl">
            Connect your workspace platforms to automatically audit inactive
            user seats and optimize costs.
          </p>
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100">
              <Plug className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Available</p>
              <p className="text-sm font-semibold text-slate-900">
                {PROVIDER_KEYS.length} Platforms
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/30 px-4 py-2.5 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100">
              <Zap className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-emerald-600/70 font-medium">
                Connected
              </p>
              <p className="text-sm font-semibold text-emerald-800">
                {connectedCount} Active
              </p>
            </div>
          </div>

          {pendingAuditCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/30 px-4 py-2.5 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-amber-600/70 font-medium">
                  Pending Audit
                </p>
                <p className="text-sm font-semibold text-amber-800">
                  {pendingAuditCount} Awaiting
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Active Audits Section */}
        {activeIntegrations.filter(i => i.isActive).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Active Audits
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROVIDER_KEYS.filter(key => activeIntegrations.some(i => i.provider === key && i.isActive)).map((key) => {
                const match = activeIntegrations.find((i) => i.provider === key && i.isActive);
                return (
                  <IntegrationCard
                    key={key}
                    providerKey={key}
                    integration={match}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Available Platforms Section */}
        {PROVIDER_KEYS.filter(key => !activeIntegrations.some(i => i.provider === key && i.isActive)).length > 0 && (
          <div className="space-y-4 pt-2">
            <h2 className="text-base font-bold text-slate-800">
              Available Platforms
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROVIDER_KEYS.filter(key => !activeIntegrations.some(i => i.provider === key && i.isActive)).map((key) => {
                return (
                  <IntegrationCard
                    key={key}
                    providerKey={key}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">
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
