import type { Metadata } from "next";
import React, { Suspense } from "react";
import { getIntegrations } from "@/app/actions/integrations";
import { IntegrationsList } from "@/components/dashboard/IntegrationsList";
import { OAuthStatusBanner } from "@/components/dashboard/OAuthStatusBanner";

export const metadata: Metadata = { title: "Integrations", description: "Connect vendor platforms to audit idle seats and token spend." };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
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
          When you connect a platform, SpendSync verifies the credential live, stores a read-only token scoped to your workspace, and compares the seats on your latest invoice with the seats that are actually active. Cards marked{" "}
          <span className="font-semibold text-[#00684a]">Live data</span> were fetched from the vendor API; cards marked{" "}
          <span className="font-semibold text-amber-700">Simulated</span> explain exactly which permission or key would unlock live telemetry.
        </p>
      </div>
    </div>
  );
}
