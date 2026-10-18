import type { Metadata } from "next";
import React from "react";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DisabledAction } from "@/components/demo/DisabledAction";
import { DEMO_FIRST_NAME, getDemoIntegrations, getDemoSubscriptions } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function DemoDashboardPage() {
  return (
    <DashboardOverview
      firstName={DEMO_FIRST_NAME}
      subscriptions={getDemoSubscriptions()}
      integrations={getDemoIntegrations()}
      headerAction={<DisabledAction label="Add Subscription" />}
      integrationsHref="/demo/integrations"
    />
  );
}
