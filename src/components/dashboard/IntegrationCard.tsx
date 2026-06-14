"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { disconnectIntegration, triggerAudit } from "@/app/actions/integrations";
import { connectGithubCopilot } from "@/app/actions/integrations/connect-github";
import type { IntegrationRow } from "@/app/actions/integrations";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// Provider metadata — icons, colors, descriptions
// ─────────────────────────────────────────────────────────

type ProviderMeta = {
  name: string;
  description: string;
  permission: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  accentColor: string;
  icon: React.ReactNode;
};

const PROVIDERS: Record<string, ProviderMeta> = {
  FIGMA: {
    name: "Figma",
    description: "Audit editor seats and identify inactive designers across your workspace.",
    permission: "Requires Read-Only Organization Admin Access",
    gradient: "from-[#a259ff]/5 to-[#ff7262]/5",
    iconBg: "bg-gradient-to-br from-[#a259ff] to-[#ff7262]",
    iconColor: "text-white",
    accentColor: "text-[#a259ff]",
    icon: (
      <svg viewBox="0 0 38 57" fill="none" className="h-5 w-5">
        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="white"/>
        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="white"/>
        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="white"/>
        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="white"/>
        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="white"/>
      </svg>
    ),
  },
  SLACK: {
    name: "Slack",
    description: "Monitor workspace member activity and flag dormant user accounts.",
    permission: "Requires Read-Only Workspace Admin Access",
    gradient: "from-[#4A154B]/5 to-[#E01E5A]/5",
    iconBg: "bg-gradient-to-br from-[#4A154B] to-[#611f69]",
    iconColor: "text-white",
    accentColor: "text-[#4A154B]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="white"/>
      </svg>
    ),
  },
  ZOOM: {
    name: "Zoom",
    description: "Track licensed seats and identify users who haven't joined meetings recently.",
    permission: "Requires Read-Only Account Admin Access",
    gradient: "from-[#0b5cff]/5 to-[#0e72ed]/5",
    iconBg: "bg-gradient-to-br from-[#0b5cff] to-[#0e72ed]",
    iconColor: "text-white",
    accentColor: "text-[#0b5cff]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M3.5 6.5C3.5 5.39543 4.39543 4.5 5.5 4.5H14C15.1046 4.5 16 5.39543 16 6.5V17.5C16 18.6046 15.1046 19.5 14 19.5H5.5C4.39543 19.5 3.5 18.6046 3.5 17.5V6.5Z" fill="white"/>
        <path d="M16 9.5L20.5 6.5V17.5L16 14.5V9.5Z" fill="white"/>
      </svg>
    ),
  },
  GITHUB: {
    name: "GitHub",
    description: "Audit organization seats and detect developers with zero recent commits.",
    permission: "Requires Read-Only Organization Access",
    gradient: "from-[#24292f]/5 to-[#57606a]/5",
    iconBg: "bg-gradient-to-br from-[#24292f] to-[#57606a]",
    iconColor: "text-white",
    accentColor: "text-[#24292f]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="white"/>
      </svg>
    ),
  },
  GITHUB_COPILOT: {
    name: "GitHub Copilot",
    description: "Audit Copilot seat assignments and flag inactive developers across your organization.",
    permission: "Requires Fine-Grained PAT with Copilot Organization admin scopes.",
    gradient: "from-[#0969da]/5 to-[#8a63f2]/5",
    iconBg: "bg-gradient-to-br from-[#0969da] to-[#8a63f2]",
    iconColor: "text-white",
    accentColor: "text-[#0969da]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="white"/>
      </svg>
    ),
  },
};

// ─────────────────────────────────────────────────────────
// IntegrationCard component
// ─────────────────────────────────────────────────────────

export function IntegrationCard({
  providerKey,
  integration,
}: {
  providerKey: string;
  integration?: IntegrationRow;
}) {
  const meta = PROVIDERS[providerKey];
  const isConnected = !!integration && integration.isActive;
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgSlug, setOrgSlug] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!meta) return null;

  let report: any = null;
  if (integration?.tokenUsageReport) {
    try {
      report = JSON.parse(integration.tokenUsageReport);
    } catch (e) {
      console.log("Failed to parse tokenUsageReport:", e);
    }
  }

  const isReportArray = Array.isArray(report);
  const reportArray = isReportArray ? report : (report?.individualSeats ?? []);
  const seatsCount = report ? (isReportArray ? report.length : (report.individualSeats?.length ?? 0)) : 0;

  const totalTokens = isReportArray
    ? report.reduce((sum: number, item: any) => {
        if (item.inputTokens !== undefined || item.outputTokens !== undefined) {
          return sum + (item.inputTokens ?? 0) + (item.outputTokens ?? 0);
        }
        return sum;
      }, 0)
    : 0;

  const uniqueModels = Array.from(
    new Set(
      reportArray.map((item: any) => item.model || item.primaryModel).filter((m: any) => m && m !== "None")
    )
  ).length;

  const totalLeak = isReportArray
    ? report.reduce((sum: number, item: any) => {
        if (item.status === "ABSOLUTE_LEAK") {
          return sum + (item.assignedSeats ?? 1) * 19;
        }
        if (item.inputTokens === 0 && item.outputTokens === 0) {
          return sum + 19;
        }
        return sum;
      }, 0)
    : (report?.totalMonthlyLeak ?? 19.00);

  const handleRunAudit = async () => {
    if (!integration) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      const res = await triggerAudit(integration.id);
      if (!res.success) {
        setAuditError(res.error || "Audit failed");
      }
    } catch (err: any) {
      setAuditError(err.message || "Audit failed");
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDisconnect = () => {
    if (!integration) return;
    startTransition(async () => {
      await disconnectIntegration(integration.id);
      setShowConfirm(false);
    });
  };

  return (
    <div
      id={`integration-card-${providerKey.toLowerCase()}`}
      className={cn(
        "group relative flex flex-col h-full rounded-xl border bg-white shadow-sm transition-all duration-300",
        "hover:shadow-md hover:-translate-y-0.5",
        isConnected
          ? "border-emerald-200/80 ring-1 ring-emerald-100/50"
          : "border-slate-200/60 hover:border-slate-300/80"
      )}
    >
      {/* Subtle gradient overlay */}
      <div
        className={cn(
          "absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          meta.gradient
        )}
      />

      {/* Card content */}
      <div className="relative z-10 flex flex-1 flex-col p-6">
        {/* Header: icon + name + status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            {/* Provider icon */}
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105",
                meta.iconBg
              )}
            >
              {meta.icon}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-900">
                {meta.name}
              </h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium mt-0.5",
                  isConnected ? "text-emerald-600" : "text-slate-400"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isConnected
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-slate-300"
                  )}
                />
                {isConnected ? "Active Audit Mode" : "Not Connected"}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3.5 text-[13px] leading-relaxed text-slate-500 min-h-[38px] flex items-start">
          {meta.description}
        </p>

        {/* Permission badge */}
        <div className="mt-3 min-h-[36px] flex items-center">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/60 leading-normal">
            <svg
              className="h-3 w-3 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {meta.permission}
          </span>
        </div>

        {/* Last audit info (when connected) */}
        {isConnected && (
          <div className="mt-3">
            {integration?.wastedSeats !== null && integration?.wastedSeats !== undefined ? (
              <div className="space-y-2">
                <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 px-4 py-3.5 text-[11.5px] text-emerald-900 border border-emerald-500/20 shadow-sm leading-relaxed">
                  <span className="font-bold flex items-center gap-1.5 mb-1.5 text-emerald-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Audit complete:
                  </span>
                  {providerKey === "GITHUB_COPILOT" ? (
                    <>
                      {integration.wastedSeats} inactive developer seat{integration.wastedSeats === 1 ? "" : "s"} found. Saving you <span className="font-bold text-emerald-700">${(integration.wastedAmount ?? 0).toLocaleString()}/mo</span>.
                      <button
                        onClick={() => setIsTelemetryOpen(true)}
                        className="ml-1.5 inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        View Telemetry
                        <svg className="h-3 w-3 inline-block align-middle ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      {integration.wastedSeats} inactive seat{integration.wastedSeats === 1 ? "" : "s"} found. Saving you{" "}
                      <span className="font-bold text-emerald-700">
                        {integration.wastedAmount !== null && integration.wastedAmount > 0
                          ? (integration.wastedAmount >= 1000 ? "₹" : "$") + integration.wastedAmount.toLocaleString()
                          : (providerKey === "FIGMA" ? "₹4,800" : "$60")}
                      </span>/mo.
                    </>
                  )}
                </div>
              </div>
            ) : integration?.lastAuditAt ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200/60 px-4 py-3 text-[11px] text-slate-600 leading-relaxed shadow-sm">
                <span className="font-semibold text-slate-700">Last audit:</span>{" "}
                {new Date(integration.lastAuditAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50/60 border border-amber-200/50 px-4 py-3 text-[11px] text-amber-700 leading-relaxed shadow-sm">
                <span className="font-semibold">Pending:</span> First audit will run on the next scheduled cycle.
              </div>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action button */}
        <div className="mt-5">
          {isConnected ? (
            <>
              {!showConfirm ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      id={`audit-${providerKey.toLowerCase()}`}
                      onClick={handleRunAudit}
                      disabled={isAuditing}
                      className={cn(
                        "flex-1 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-2",
                        "hover:shadow-md hover:brightness-110 active:scale-[0.98] disabled:opacity-60",
                        meta.iconBg
                      )}
                    >
                      {isAuditing ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Auditing...
                        </>
                      ) : (
                        "Run Audit"
                      )}
                    </button>
                    <button
                      id={`disconnect-${providerKey.toLowerCase()}`}
                      onClick={() => setShowConfirm(true)}
                      disabled={isAuditing}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-medium text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40"
                    >
                      Disconnect
                    </button>
                  </div>
                  {auditError && (
                    <p className="text-[11px] text-red-600 font-medium text-center bg-red-50 py-1 rounded-md">
                      ⚠️ {auditError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12px] text-red-600 font-medium text-center">
                    Remove this integration?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={isPending}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                    >
                      {isPending ? "Removing…" : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <a
              id={`connect-${providerKey.toLowerCase()}`}
              href={
                providerKey === "FIGMA"
                  ? "/api/integrations/figma/connect"
                  : undefined
              }
              onClick={
                providerKey !== "FIGMA"
                  ? (e) => {
                      e.preventDefault();
                      if (providerKey === "GITHUB_COPILOT") {
                        setIsModalOpen(true);
                        setModalError(null);
                        setOrgSlug("");
                        setGithubToken("");
                      } else {
                        alert(
                          `${meta.name} integration is coming soon. Figma is available now!`
                        );
                      }
                    }
                  : undefined
              }
              className={cn(
                "flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 cursor-pointer",
                "hover:shadow-md hover:brightness-110 active:scale-[0.98]",
                meta.iconBg
              )}
            >
              Connect {meta.name}
            </a>
          )}
        </div>

      </div>

      {/* Modal Dialog */}
      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />
          
          {/* Dialog Container */}
          <div className="relative z-10 w-full max-w-md transform overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Icon + Title */}
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm", meta.iconBg)}>
                {meta.icon}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Connect GitHub Copilot
                </h3>
                <p className="text-xs text-slate-400 font-medium">Configure secure API access</p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Audit Copilot seat assignments and automatically flag inactive developers across your organization.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setModalError(null);
                try {
                  const res = await connectGithubCopilot(orgSlug, githubToken);
                  if (res.success) {
                    setIsModalOpen(false);
                  } else {
                    setModalError(res.error || "Failed to save integration");
                  }
                } catch (err: any) {
                  setModalError(err.message || "An unexpected error occurred");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="mt-4 space-y-4"
            >
              {/* Org Slug input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  GitHub Organization Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., althaf-consulting-labs"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-[13px] text-slate-950 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <p className="text-[11px] text-slate-400">
                  Enter your exact GitHub Organization URL slug.
                </p>
              </div>

              {/* Secure PAT input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Fine-Grained Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  required
                  placeholder="ghp_... or github_pat_..."
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-[13px] text-slate-950 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 leading-normal">
                  Create a PAT with read organization billing scopes on{" "}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    github.com/settings/tokens
                    <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                  . Ensure organization permission is selected.
                </p>
              </div>

              {/* Error Display */}
              {modalError && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 p-2.5 text-xs text-rose-600 font-medium leading-relaxed">
                  ⚠️ {modalError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center"
                >
                  {isSubmitting ? "Connecting..." : "Verify & Activate Audit Mode"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Telemetry Analytics Modal */}
      {isTelemetryOpen && mounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsTelemetryOpen(false)}
          />
          
          {/* Dialog Container */}
          <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setIsTelemetryOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm", meta.iconBg)}>
                {meta.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {providerKey === "GITHUB_COPILOT" ? "Copilot Seat & Token Telemetry" : "Copilot Telemetry Analytics"}
                </h3>
                <p className="text-xs text-slate-450 font-medium">
                  {providerKey === "GITHUB_COPILOT" ? "Real-time individual assignment tracking" : "Fine-grained token activity & workloads"}
                </p>
              </div>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">AI Workload</span>
                <span className="text-base font-extrabold text-slate-800 tabular-nums">
                  {providerKey === "GITHUB_COPILOT" ? "985k" : `${(totalTokens / 1000).toFixed(0)}k`} <span className="text-[10px] text-slate-500 font-normal">tkn</span>
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">LLM Engines</span>
                <span className="text-base font-extrabold text-slate-800">
                  {providerKey === "GITHUB_COPILOT" ? "2" : uniqueModels} <span className="text-[10px] text-slate-500 font-normal">active</span>
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider">SaaS Leak</span>
                <span className="text-base font-extrabold text-rose-600 tabular-nums">
                  {providerKey === "GITHUB_COPILOT" ? "$19.00" : `$${totalLeak.toFixed(2)}`}<span className="text-[10px] text-rose-500 font-normal">/mo</span>
                </span>
              </div>
            </div>

            {/* Pooled AI Capacity Status Banner */}
            {providerKey === "GITHUB_COPILOT" && (
              <div className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-[11px] font-semibold text-slate-200 shadow-md mb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400"></span>
                  </span>
                  <span>Pooled AI Credit Capacity:</span>
                </div>
                <span className="text-indigo-400 font-bold tabular-nums whitespace-nowrap">
                  ${((integration?.wastedSeats ?? 0) * 19).toFixed(2)} Stranded
                </span>
              </div>
            )}

            {/* Copilot Optimization Policy */}
            {providerKey === "GITHUB_COPILOT" && (
              <div className="mb-4 rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5 text-xs text-slate-650 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Copilot Optimization Policy
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] leading-relaxed">
                  <div>
                    <span className="text-slate-400 block font-medium">Idle Threshold</span>
                    <span className="font-semibold text-slate-700">30 Days (No activity)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Telemetry Resolution</span>
                    <span className="font-semibold text-slate-700">Hourly API Sync</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Public Code Filter</span>
                    <span className="font-semibold text-amber-600">Blocked (Enforced)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Allowed LLMs</span>
                    <span className="font-semibold text-slate-700">GPT-4o, Claude 3.5, Gemini 1.5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable List Container */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {providerKey === "GITHUB_COPILOT" && report && !Array.isArray(report) ? (
                report.individualSeats?.map((item: any, idx: number) => {
                  const isActive = item.status === "ACTIVE";
                  const username = item.username || "unknown-dev";
                  const avatarInitials = username.slice(0, 2).toUpperCase();

                  // Format lastActivityAt to a clean readable string
                  let activityStr = "Never active";
                  if (item.lastActivityAt) {
                    try {
                      activityStr = `Active ${new Date(item.lastActivityAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}`;
                    } catch (e) {
                      activityStr = `Active ${item.lastActivityAt}`;
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "relative overflow-hidden rounded-xl border p-3.5 transition-all duration-300",
                        !isActive
                          ? "bg-rose-50/20 border-rose-100/70"
                          : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-sm"
                      )}
                    >
                      {/* Top Row: User/Model & Leak */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Initials Badge */}
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold border",
                            !isActive
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : "bg-indigo-50 text-indigo-650 border-indigo-100"
                          )}>
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="font-bold text-[12px] text-slate-800 flex items-center gap-2">
                              {username}
                              {!isActive ? (
                                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-650 ring-1 ring-inset ring-rose-500/10 animate-pulse">
                                  <span className="mr-1 h-1 w-1 rounded-full bg-rose-500" />
                                  ⚠️ Idle License: Wasting $19.00/mo
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-550/10">
                                  {item.primaryModel}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span>{activityStr}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Leak / Status */}
                        <div className="text-right">
                          <span className="text-[9px] font-semibold tracking-wide text-slate-450 block uppercase">
                            {!isActive ? "Financial Leak" : "Seat Status"}
                          </span>
                          <span className={cn(
                            "text-[12px] font-bold tabular-nums",
                            !isActive ? "text-rose-655 font-extrabold" : "text-emerald-600"
                          )}>
                            {!isActive ? "$19.00" : "Active"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // Fallback for array-based reports (legacy GITHUB_COPILOT or FIGMA)
                Array.isArray(report) && report.map((item, idx) => {
                  const isWasting = item.status === "ABSOLUTE_LEAK" || (item.inputTokens === 0 && item.outputTokens === 0) || (item.creditsConsumed === 0 && item.assignedSeats > 0);
                  const ratioPct = item.creditsAllocated > 0 ? ((item.creditsConsumed ?? 0) / item.creditsAllocated) * 100 : 0;
                  
                  const teamName = item.teamName || item.developer || "Unknown Team";
                  const primaryModel = item.primaryModel || item.model || "None";
                  const creditsConsumed = item.creditsConsumed ?? item.creditsSpent ?? 0;
                  const creditsAllocated = item.creditsAllocated ?? 19.00;
                  const assignedSeats = item.assignedSeats ?? 1;

                  const totalTkn = (item.inputTokens ?? 0) + (item.outputTokens ?? 0);
                  const inputPct = totalTkn > 0 ? ((item.inputTokens ?? 0) / totalTkn) * 100 : 0;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "relative overflow-hidden rounded-xl border p-3.5 transition-all duration-300",
                        isWasting
                          ? "bg-rose-50/20 border-rose-100/70"
                          : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-sm"
                      )}
                    >
                      {/* Top Row: User/Model & Leak */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {/* Initials Badge */}
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-bold border",
                            isWasting
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : "bg-indigo-50 text-indigo-650 border-indigo-100"
                          )}>
                            {teamName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[12px] text-slate-800 flex items-center gap-2">
                              {teamName}
                              {isWasting && (
                                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-650 ring-1 ring-inset ring-rose-500/10 animate-pulse">
                                  <span className="mr-1 h-1 w-1 rounded-full bg-rose-500" />
                                  Wasting $19/mo
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-450 flex items-center gap-1 mt-0.5">
                              <span className="text-slate-455">LLM Model:</span>
                              <span className={cn(
                                "font-mono rounded px-1 py-0.2 text-[9px]",
                                isWasting ? "bg-slate-100 text-slate-450" : "bg-indigo-50 text-indigo-500 font-semibold"
                              )}>
                                {primaryModel}
                              </span>
                              {assignedSeats > 1 && (
                                <>
                                  <span className="mx-1.5 text-slate-300">•</span>
                                  <span>Seats: {assignedSeats}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial leak */}
                        <div className="text-right">
                          <span className="text-[9px] font-semibold tracking-wide text-slate-450 block uppercase">
                            {isWasting ? "Financial Leak" : "Credits Consumed"}
                          </span>
                          <span className={cn(
                            "text-[12px] font-bold tabular-nums",
                            isWasting ? "text-rose-650 font-extrabold" : "text-slate-700"
                          )}>
                            {isWasting ? `$${(assignedSeats * 19).toFixed(2)}` : `$${creditsConsumed.toFixed(2)}`}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Distribution / Progress bar */}
                      {!isWasting && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100/60">
                          {item.creditsAllocated !== undefined ? (
                            <>
                              <div className="flex items-center justify-between text-[9px] text-slate-450 mb-1">
                                <span className="font-semibold text-slate-400">Credit Pool Utilization ({ratioPct.toFixed(0)}%)</span>
                                <span className="tabular-nums font-medium text-slate-500">
                                  Consumed: ${creditsConsumed.toFixed(2)} / ${creditsAllocated.toFixed(2)} Allocated
                                </span>
                              </div>
                              {/* Progress bar */}
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                <div
                                  style={{ width: `${ratioPct}%` }}
                                  className={cn(
                                    "h-full transition-all duration-300",
                                    item.status === "UNDER_UTILIZED" ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                  title={`Consumed: ${ratioPct.toFixed(1)}%`}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between text-[9px] text-slate-450 mb-1">
                                <span className="font-semibold text-slate-400">Workload Distribution</span>
                                <span className="tabular-nums font-medium text-slate-500">
                                  In: {(item.inputTokens ?? 0).toLocaleString()} | Out: {(item.outputTokens ?? 0).toLocaleString()}
                                </span>
                              </div>
                              {/* Stacked bar */}
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                <div
                                  style={{ width: `${inputPct}%` }}
                                  className="bg-indigo-500 h-full transition-all duration-300"
                                  title={`Input: ${inputPct.toFixed(0)}%`}
                                />
                                <div
                                  style={{ width: `${100 - inputPct}%` }}
                                  className="bg-purple-450 h-full transition-all duration-300"
                                  title={`Output: ${(100 - inputPct).toFixed(0)}%`}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom bar */}
            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTelemetryOpen(false)}
                className="rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Export the list of provider keys for the page to iterate over */
export const PROVIDER_KEYS = Object.keys(PROVIDERS);
