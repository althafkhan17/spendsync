import type { Metadata } from "next";
import React from "react";
import { currentUser } from "@clerk/nextjs/server";
import { AddSubscriptionModal } from "@/components/dashboard/AddSubscriptionModal";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { getSubscriptions } from "@/app/actions/subscriptions";
import { getIntegrations } from "@/app/actions/integrations";

export const metadata: Metadata = { title: "Dashboard", description: "Overview of your SaaS spend, renewals and detected seat leaks." };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  const firstName = user?.firstName || "there";

  const [subscriptions, integrations] = await Promise.all([getSubscriptions(), getIntegrations()]);

  return (
    <DashboardOverview
      firstName={firstName}
      subscriptions={subscriptions}
      integrations={integrations}
      headerAction={<AddSubscriptionModal />}
    />
  );
}
