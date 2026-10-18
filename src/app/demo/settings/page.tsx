import type { Metadata } from "next";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { DisabledAction } from "@/components/demo/DisabledAction";
import { getDemoWorkspace } from "@/lib/demo-data";
import { Info, Mail, ShieldAlert } from "lucide-react";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default function DemoSettingsPage() {
  const workspace = getDemoWorkspace();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-[15px] text-ink-subtle">Configure your workspace, routing email, and integrations.</p>
      </div>

      <Card className="border border-hairline bg-white shadow-sm rounded-lg">
        <CardHeader className="border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-ink-subtle" />
            <div>
              <CardTitle className="text-base font-semibold text-ink">Workspace Information</CardTitle>
              <CardDescription className="text-xs text-ink-tertiary mt-0.5">
                General settings and metadata for your active workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Workspace Name</span>
              <p className="text-sm text-ink font-medium">{workspace.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Workspace ID</span>
              <div className="flex items-center gap-1.5">
                <code className="text-sm font-mono bg-surface-3 px-2 py-0.5 rounded border border-[#c1ccd6] text-ink-muted">
                  {workspace.id}
                </code>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Owner Email</span>
              <p className="text-sm text-ink font-medium">{workspace.ownerEmail}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Created Date</span>
              <p className="text-sm text-ink-muted font-medium">
                {new Date(workspace.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-hairline bg-white shadow-sm rounded-lg">
        <CardHeader className="border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-ink-subtle" />
            <div>
              <CardTitle className="text-base font-semibold text-ink">Email Ingestion Routing</CardTitle>
              <CardDescription className="text-xs text-ink-tertiary mt-0.5">
                Every workspace gets a unique address. Forward receipts to it and they are parsed automatically.
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
              Forward receipts from Gmail, Outlook, or directly from Stripe and other billing services to this address.
              SpendSync parses PDFs and plain text, extracts the vendor, seats, price, currency and renewal date, and updates
              the dashboard. This demo address belongs to a fictional workspace, so anything sent to it is discarded.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-red-200 bg-red-50/50 shadow-sm rounded-lg">
        <CardHeader className="border-b border-red-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <div>
              <CardTitle className="text-base font-semibold text-red-650">Danger Zone</CardTitle>
              <CardDescription className="text-xs text-red-600/80 mt-0.5">Irreversible actions. Please handle with care.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">Delete all subscriptions</p>
              <p className="text-xs text-ink-subtle">Permanently remove all SaaS subscriptions tracked in this workspace.</p>
            </div>
            <DisabledAction label="Delete all" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
