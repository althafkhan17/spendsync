import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceNameEditor } from "@/components/dashboard/WorkspaceNameEditor";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { DangerZone } from "@/components/dashboard/DangerZone";
import { getWorkspaceDetails } from "@/app/actions/workspace";
import { Info, Mail, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  try {
    const workspace = await getWorkspaceDetails();

    return (
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Settings
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-subtle">
            Configure your workspace, routing email, and integrations.
          </p>
        </div>

        {/* 1. Workspace Information Card */}
        <Card className="border border-hairline bg-white shadow-sm rounded-lg">
          <CardHeader className="border-b border-hairline px-6 py-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-ink-subtle" />
              <div>
                <CardTitle className="text-base font-semibold text-ink">
                  Workspace Information
                </CardTitle>
                <CardDescription className="text-xs text-ink-tertiary mt-0.5">
                  General settings and metadata for your active workspace.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Workspace Name
                </span>
                <div>
                  <WorkspaceNameEditor initialName={workspace.name} />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Workspace ID
                </span>
                <div className="flex items-center gap-1.5">
                  <code className="text-sm font-mono bg-surface-3 px-2 py-0.5 rounded border border-[#c1ccd6] text-ink-muted">
                    {workspace.id}
                  </code>
                  <CopyButton text={workspace.id} className="h-7 w-7 border border-[#c1ccd6] bg-white" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Owner Email
                </span>
                <p className="text-sm text-ink font-medium">
                  {workspace.ownerEmail}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Created Date
                </span>
                <p className="text-sm text-ink-muted font-medium">
                  {new Date(workspace.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Email Ingestion (CloudMailin Routing) */}
        <Card className="border border-hairline bg-white shadow-sm rounded-lg">
          <CardHeader className="border-b border-hairline px-6 py-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-ink-subtle" />
              <div>
                <CardTitle className="text-base font-semibold text-ink">
                  Email Ingestion Routing
                </CardTitle>
                <CardDescription className="text-xs text-ink-tertiary mt-0.5">
                  Use this address to automatically forward and sync your SaaS receipts.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-hairline bg-surface-3 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle block mb-1.5">
                Your Unique SpendSync Email
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-sm font-mono break-all bg-white border border-[#c1ccd6] px-3 py-1.5 rounded-lg text-ink font-semibold shadow-sm select-all">
                  {workspace.routingEmail}
                </code>
                <CopyButton text={workspace.routingEmail} className="h-9 w-9 border border-[#c1ccd6] bg-white shadow-sm" />
              </div>
              <p className="mt-3 text-xs text-[#5c6c7a] leading-relaxed">
                Forward your receipts from Gmail, Outlook, or directly from Stripe/billing services to this routing address. SpendSync uses advanced AI parsing engines to automatically parse the receipts (PDFs &amp; plain text) and update your dashboard instantly.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. Danger Zone */}
        <Card className="border border-red-200 bg-red-50/50 shadow-sm rounded-lg">
          <CardHeader className="border-b border-red-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <div>
                <CardTitle className="text-base font-semibold text-red-650">
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-xs text-red-600/80 mt-0.5">
                  Irreversible actions. Please handle with care.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-ink">
                  Delete all subscriptions
                </p>
                <p className="text-xs text-ink-subtle">
                  Permanently remove all SaaS subscriptions tracked in this workspace.
                </p>
              </div>
              <div>
                <DangerZone />
              </div>
            </div>
          </CardContent>
        </Card>
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

    console.error("❌ Failed to load settings page data:", error);
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500 mb-4 font-bold">
          ⚠️
        </div>
        <h3 className="text-base font-semibold text-slate-900">
          Unable to load settings
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          There was an error communicating with the database. Please try reloading the page.
        </p>
      </div>
    );
  }
}
