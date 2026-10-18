import type { Metadata } from "next";
import React from "react";
import { IntegrationsList } from "@/components/dashboard/IntegrationsList";
import { getDemoIntegrations } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default function DemoIntegrationsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">App Integrations</h1>
        <p className="mt-1.5 text-[15px] text-ink-subtle max-w-2xl">
          Connect your workspace platforms to automatically audit inactive user seats and optimize costs.
        </p>
      </div>

      <IntegrationsList activeIntegrations={getDemoIntegrations()} readOnly />

      <div className="rounded-lg border border-hairline bg-white p-4 shadow-sm">
        <p className="text-xs text-ink-subtle leading-relaxed">
          <span className="font-semibold text-ink-muted">How it works:</span> When you connect a platform, SpendSync verifies
          the credential live, stores a read-only token encrypted in your workspace, and compares the seats on your latest
          invoice with the seats that are actually active. Cards marked{" "}
          <span className="font-semibold text-[#00684a]">Live data</span> were fetched from the vendor API; cards marked{" "}
          <span className="font-semibold text-amber-700">Simulated</span> explain exactly which permission or key would unlock
          live telemetry. In this demo every card is simulated. Click <span className="font-semibold">View seats</span> or{" "}
          <span className="font-semibold">View usage by model</span> to open the detail reports.
        </p>
      </div>
    </div>
  );
}
