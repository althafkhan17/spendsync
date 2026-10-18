"use client";

import React, { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { Key, ShieldAlert, Eye, EyeOff, Clock, Sparkles, X, Users, Gauge } from "lucide-react";
import { disconnectIntegration, triggerAudit } from "@/app/actions/integrations";
import { connectGithubCopilot } from "@/app/actions/integrations/connect-github";
import { connectAnthropic } from "@/app/actions/integrations/connect-anthropic";
import type { IntegrationRow } from "@/app/actions/integrations";
import { cn } from "@/lib/utils";
import { parseAuditReport, isSeatReport, isTokenReport } from "@/lib/audit-report";
import { formatMoney, relativeTime } from "@/lib/format";
import { DataSourceBadge } from "@/components/dashboard/DataSourceBadge";
import { SeatAuditModal } from "@/components/dashboard/SeatAuditModal";
import { TokenSpendModal, budgetTone } from "@/components/dashboard/TokenSpendModal";

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

export const PROVIDERS: Record<string, ProviderMeta> = {
  FIGMA: {
    name: "Figma",
    description: "Audit editor seats and identify inactive designers across your workspace.",
    permission: "Requires Read-Only Organization Admin Access",
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
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
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
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
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
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
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
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
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" fill="white"/>
      </svg>
    ),
  },
  ANTHROPIC: {
    name: "Anthropic Claude",
    description: "Track real-time token consumption, monitor usage spikes, and set a safety budget threshold.",
    permission: "Requires API Key and Safety Threshold (USD)",
    gradient: "from-[#00ed64]/4 to-transparent",
    iconBg: "bg-[#001e2b]",
    iconColor: "text-white",
    accentColor: "text-[#00684a]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
};

/** Providers with a working connect flow. Everything else shows "Coming soon". */
const CONNECTABLE = new Set(["FIGMA", "GITHUB_COPILOT", "ANTHROPIC"]);

const DEMO_GITHUB = { org: "acme-labs", token: "mock_demo_github_token" };
const DEMO_ANTHROPIC_KEY = "sk-ant-test-mock";

type Notice = { type: "success" | "error" | "info"; text: string };

// ─────────────────────────────────────────────────────────
// IntegrationCard component
// ─────────────────────────────────────────────────────────

export function IntegrationCard({
  providerKey,
  integration,
  readOnly = false,
}: {
  providerKey: string;
  integration?: IntegrationRow;
  /** Public demo: actions that would write to the database are disabled. */
  readOnly?: boolean;
}) {
  const meta = PROVIDERS[providerKey];
  const isConnected = !!integration && integration.isActive;
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgSlug, setOrgSlug] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [threshold, setThreshold] = useState("50.00");
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  // Portals are only rendered after a user click, so `document` is always available by then.
  const canPortal = typeof document !== "undefined";

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 12_000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!meta) return null;

  const report = parseAuditReport(integration?.tokenUsageReport);
  const seatReport = isSeatReport(report) ? report : null;
  const tokenReport = isTokenReport(report) ? report : null;

  const handleRunAudit = async () => {
    if (!integration) return;
    setIsAuditing(true);
    setNotice(null);
    try {
      const res = await triggerAudit(integration.id);
      if (!res.success) {
        setNotice({ type: "error", text: res.error || "Audit failed" });
      } else {
        setNotice({
          type: "success",
          text: `${res.summary ?? "Audit complete"}${res.dataSource === "SIMULATED" ? " (simulated data)" : ""}`,
        });
      }
    } catch (err) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Audit failed" });
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

  const openConnect = () => {
    setIsModalOpen(true);
    setModalError(null);
    setOrgSlug("");
    setGithubToken("");
    setApiKey("");
    setThreshold("50.00");
    setShowKey(false);
  };

  const connectable = CONNECTABLE.has(providerKey);

  return (
    <div
      id={`integration-card-${providerKey.toLowerCase()}`}
      className={cn(
        "group relative flex h-full flex-col rounded-lg border bg-white shadow-sm transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-md",
        isConnected ? "border-[#00ed64]/30" : "border-hairline"
      )}
    >
      <div className={cn("absolute inset-0 rounded-lg bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100", meta.gradient)} />

      <div className="relative z-10 flex flex-1 flex-col p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3.5">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105", meta.iconBg)}>
              {meta.icon}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-ink">{meta.name}</h3>
              <span className={cn("mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium", isConnected ? "text-semantic-success" : "text-ink-subtle")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "animate-pulse bg-[#00ed64]" : "bg-slate-400")} />
                {isConnected ? (providerKey === "ANTHROPIC" ? "Monitoring" : "Active audit") : connectable ? "Not connected" : "Coming soon"}
              </span>
            </div>
          </div>
          {report && <DataSourceBadge dataSource={report.dataSource} reason={report.simulationReason} />}
        </div>

        <p className="mt-3.5 flex min-h-[38px] items-start text-[13px] leading-relaxed text-ink-muted">{meta.description}</p>

        <div className="mt-3 flex min-h-[36px] items-center">
          <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium leading-normal text-ink-subtle">
            <svg className="h-3 w-3 text-ink-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {meta.permission}
          </span>
        </div>

        {/* Findings */}
        {isConnected && (
          <div className="mt-3">
            {tokenReport ? (
              <TokenSummary report={tokenReport} onOpen={() => setIsDetailOpen(true)} />
            ) : seatReport ? (
              <SeatSummary report={seatReport} onOpen={() => setIsDetailOpen(true)} />
            ) : integration?.wastedSeats !== null && integration?.wastedSeats !== undefined ? (
              <div className="rounded-lg border border-hairline bg-surface-3 px-4 py-3 text-[11.5px] leading-relaxed text-ink-muted shadow-sm">
                <span className="font-semibold text-ink">Older audit:</span> {integration.wastedSeats} idle seat{integration.wastedSeats === 1 ? "" : "s"},{" "}
                {formatMoney(integration.wastedAmount ?? 0, "USD")}/mo. Run the audit again for seat-level detail.
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-700 shadow-sm">
                <span className="font-semibold">Pending:</span> no audit yet. Click Run Audit or wait for the daily cycle.
              </div>
            )}
            {integration?.lastAuditAt && (
              <div className="mt-2 flex items-center gap-1 text-[10.5px] text-ink-tertiary">
                <Clock className="h-3 w-3" /> Last audit {relativeTime(integration.lastAuditAt)}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

        {notice && (
          <div
            className={cn(
              "mt-4 rounded-md border px-3 py-2 text-[11px] font-medium leading-relaxed",
              notice.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : notice.type === "success"
                  ? "border-[#00ed64]/30 bg-[#e3fcef] text-[#00684a]"
                  : "border-amber-200 bg-amber-50 text-amber-800"
            )}
          >
            {notice.text}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4">
          {readOnly ? (
            <button
              type="button"
              disabled
              title="Disabled in demo mode. Create your own workspace to connect real integrations."
              className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-full border border-dashed border-hairline-strong bg-surface-3 px-5 text-center text-[13px] font-semibold text-ink-subtle"
            >
              {isConnected ? "Run Audit (demo)" : connectable ? `Connect ${meta.name} (demo)` : "Coming soon"}
            </button>
          ) : isConnected ? (
            !showConfirm ? (
              <div className="flex gap-2">
                <button
                  id={`audit-${providerKey.toLowerCase()}`}
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#00ed64] px-5 text-center text-[13px] font-semibold text-[#001e2b] shadow-sm transition-all duration-200 hover:bg-[#00b545] hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {isAuditing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
                      {providerKey === "ANTHROPIC" ? "Syncing..." : "Auditing..."}
                    </>
                  ) : providerKey === "ANTHROPIC" ? (
                    "Sync usage"
                  ) : (
                    "Run Audit"
                  )}
                </button>
                <button
                  id={`disconnect-${providerKey.toLowerCase()}`}
                  onClick={() => setShowConfirm(true)}
                  disabled={isAuditing}
                  className="flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 text-[13px] font-medium text-slate-600 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-[12px] font-medium text-red-600">Remove this integration?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={isPending}
                    className="flex h-10 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="flex h-10 flex-1 items-center justify-center rounded-full bg-red-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                  >
                    {isPending ? "Removing…" : "Confirm"}
                  </button>
                </div>
              </div>
            )
          ) : providerKey === "FIGMA" ? (
            <a
              id="connect-figma"
              href="/api/integrations/figma/connect"
              className={cn(
                "flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-5 text-center text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.98]",
                meta.iconBg
              )}
            >
              Connect {meta.name}
            </a>
          ) : connectable ? (
            <button
              id={`connect-${providerKey.toLowerCase()}`}
              onClick={openConnect}
              className={cn(
                "flex h-10 w-full cursor-pointer items-center justify-center rounded-full px-5 text-center text-[13px] font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.98]",
                meta.iconBg
              )}
            >
              Connect {meta.name}
            </button>
          ) : (
            <button
              id={`connect-${providerKey.toLowerCase()}`}
              disabled
              title="This connector is on the roadmap."
              className="flex h-10 w-full cursor-not-allowed items-center justify-center rounded-full border border-dashed border-hairline-strong bg-surface-3 px-5 text-center text-[13px] font-semibold text-ink-subtle"
            >
              Coming soon
            </button>
          )}
        </div>
      </div>

      {/* Detail modals */}
      {seatReport && (
        <SeatAuditModal open={isDetailOpen} onClose={() => setIsDetailOpen(false)} report={seatReport} providerName={meta.name} icon={meta.icon} iconBg={meta.iconBg} />
      )}
      {tokenReport && <TokenSpendModal open={isDetailOpen} onClose={() => setIsDetailOpen(false)} report={tokenReport} icon={meta.icon} iconBg={meta.iconBg} />}

      {/* Connect modals */}
      {isModalOpen &&
        canPortal &&
        createPortal(
          providerKey === "ANTHROPIC" ? (
            <ModalShell dark onClose={() => setIsModalOpen(false)}>
              <ModalHeader
                dark
                icon={meta.icon}
                iconBg={meta.iconBg}
                title="Connect Anthropic Claude"
                subtitle="Verify your key and set a monthly safety budget"
              />
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                SpendSync verifies the key against the Anthropic API without spending tokens. Live organization spend needs an{" "}
                <span className="font-semibold text-slate-200">Admin API key</span> (starts with <code className="font-mono text-[11px]">sk-ant-admin</code>); a
                standard key is verified but its telemetry is simulated.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSubmitting(true);
                  setModalError(null);
                  try {
                    const res = await connectAnthropic(apiKey, threshold);
                    if (res.success) {
                      setIsModalOpen(false);
                      setNotice({ type: res.warning ? "info" : "success", text: res.warning ?? "Anthropic connected and first sync complete." });
                    } else {
                      setModalError(res.error || "Failed to save integration");
                    }
                  } catch (err) {
                    setModalError(err instanceof Error ? err.message : "An unexpected error occurred");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="mt-4 space-y-4 text-left"
              >
                <div className="space-y-1.5">
                  <label htmlFor="modal-claude-api-key" className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Key className="h-3.5 w-3.5 text-slate-400" /> Anthropic API key
                  </label>
                  <div className="relative">
                    <input
                      id="modal-claude-api-key"
                      type={showKey ? "text" : "password"}
                      required
                      autoComplete="off"
                      placeholder="sk-ant-admin01-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-11 w-full rounded-md border border-[#1c2d38] bg-[#003d4f]/20 px-3 pr-10 font-mono text-[13px] text-white placeholder-slate-500 transition-all focus:border-[#00ed64] focus:outline-none focus:ring-1 focus:ring-[#00ed64]"
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-white" aria-label="Toggle key visibility">
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button type="button" onClick={() => setApiKey(DEMO_ANTHROPIC_KEY)} className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#00ed64]/80 hover:text-[#00ed64]">
                    <Sparkles className="h-3 w-3" /> Use demo key (simulated telemetry)
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="modal-claude-threshold" className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <ShieldAlert className="h-3.5 w-3.5 text-slate-400" /> Monthly safety budget (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-semibold text-slate-400">$</span>
                    <input
                      id="modal-claude-threshold"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                      className="h-11 w-full rounded-md border border-[#1c2d38] bg-[#003d4f]/20 pl-7 pr-3 text-[13px] font-semibold tabular-nums text-white placeholder-slate-500 transition-all focus:border-[#00ed64] focus:outline-none focus:ring-1 focus:ring-[#00ed64]"
                    />
                  </div>
                  <p className="text-[10px] leading-normal text-slate-400">The workspace owner is emailed once per month when spend crosses this amount.</p>
                </div>
                {modalError && (
                  <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-950/40 p-3 text-xs font-medium text-red-400">
                    <span className="mt-0.5 shrink-0">⚠️</span>
                    <span>{modalError}</span>
                  </div>
                )}
                <div className="flex gap-2.5 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex h-10 flex-1 items-center justify-center rounded-full border border-[#1c2d38] bg-transparent px-4 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[#00ed64] px-4 text-[13px] font-semibold text-[#001e2b] shadow-sm transition-all duration-200 hover:bg-[#00b545] active:scale-[0.98] disabled:opacity-60">
                    {isSubmitting ? "Verifying key..." : "Verify & connect"}
                  </button>
                </div>
              </form>
            </ModalShell>
          ) : (
            <ModalShell onClose={() => setIsModalOpen(false)}>
              <ModalHeader icon={meta.icon} iconBg={meta.iconBg} title="Connect GitHub Copilot" subtitle="Verified live against the GitHub API" />
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                SpendSync reads your Copilot seat list and billing summary to find developers with no IDE activity in 30 days. The token is checked before anything is saved.
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
                      setNotice({ type: res.warning ? "info" : "success", text: res.warning ?? "GitHub Copilot connected and first audit complete." });
                    } else {
                      setModalError(res.error || "Failed to save integration");
                    }
                  } catch (err) {
                    setModalError(err instanceof Error ? err.message : "An unexpected error occurred");
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="mt-4 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">GitHub organization slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. acme-labs"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    className="w-full rounded-md border border-hairline-strong bg-white px-3 py-2.5 text-[13px] text-ink placeholder-ink-tertiary transition-all focus:border-[#00684a] focus:outline-none focus:ring-[#00684a]"
                  />
                  <p className="text-[11px] text-ink-tertiary">The name after github.com/ in your organization URL.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">Fine-grained personal access token</label>
                  <input
                    type="password"
                    required
                    autoComplete="off"
                    placeholder="github_pat_..."
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="w-full rounded-md border border-hairline-strong bg-white px-3 py-2.5 text-[13px] text-ink placeholder-ink-tertiary transition-all focus:border-[#00684a] focus:outline-none focus:ring-[#00684a]"
                  />
                  <p className="text-[11px] leading-normal text-ink-tertiary">
                    Create one at{" "}
                    <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="text-[#00684a] hover:underline">
                      github.com/settings/personal-access-tokens
                    </a>{" "}
                    with the organization permission <span className="font-semibold">GitHub Copilot Business: read</span>. Org owner access is required.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOrgSlug(DEMO_GITHUB.org);
                      setGithubToken(DEMO_GITHUB.token);
                    }}
                    className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#00684a] hover:underline"
                  >
                    <Sparkles className="h-3 w-3" /> Use demo credentials (simulated seats)
                  </button>
                </div>
                {modalError && <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs font-medium leading-relaxed text-red-600">⚠️ {modalError}</div>}
                <div className="flex gap-2.5 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex h-10 flex-1 items-center justify-center rounded-full border border-hairline-strong bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-slate-100 disabled:opacity-40">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full border border-transparent bg-[#00ed64] px-4 text-[13px] font-semibold text-[#001e2b] shadow-sm transition-all duration-200 hover:bg-[#00b545] active:scale-[0.98] disabled:opacity-60">
                    {isSubmitting ? "Verifying token..." : "Verify & connect"}
                  </button>
                </div>
              </form>
            </ModalShell>
          ),
          document.body
        )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Summaries shown on the card
// ─────────────────────────────────────────────────────────

function SeatSummary({ report, onOpen }: { report: ReturnType<typeof parseAuditReport> & { kind: "SEATS" }; onOpen: () => void }) {
  const leak = report.idleSeats * report.seatUnitPrice;
  const hasLeak = leak > 0;
  return (
    <div className={cn("rounded-lg border px-4 py-3.5 text-[11.5px] leading-relaxed shadow-sm", hasLeak ? "border-rose-200 bg-rose-50/70 text-rose-800" : "border-[#00ed64]/20 bg-[#c3f0d2]/70 text-[#00684a]")}>
      <span className="mb-1.5 flex items-center gap-1.5 font-bold">
        <Users className="h-3.5 w-3.5" />
        {hasLeak ? "Idle seats found" : "No idle seats"}
      </span>
      <span className="font-semibold">{report.idleSeats}</span> of <span className="font-semibold">{report.billedSeats}</span> billed seats inactive for {report.idleThresholdDays}+ days.
      {hasLeak && (
        <>
          {" "}
          Recoverable: <span className="font-bold">{formatMoney(leak, report.currency)}/mo</span>.
        </>
      )}
      <button onClick={onOpen} className="ml-1.5 inline-flex cursor-pointer items-center gap-1 font-bold underline hover:opacity-80">
        View seats
      </button>
    </div>
  );
}

function TokenSummary({ report, onOpen }: { report: ReturnType<typeof parseAuditReport> & { kind: "TOKENS" }; onOpen: () => void }) {
  const pct = Math.round((report.totalCostUsd / Math.max(report.thresholdUsd, 0.01)) * 100);
  const tone = budgetTone(pct);
  return (
    <div className="rounded-lg border border-hairline bg-surface-3/70 px-4 py-3.5 text-[11.5px] leading-relaxed text-ink-muted shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-bold text-ink">
          <Gauge className="h-3.5 w-3.5 text-[#00684a]" /> Month-to-date spend
        </span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.soft)}>{pct}% of budget</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn("text-lg font-extrabold tabular-nums", tone.text)}>{formatMoney(report.totalCostUsd, "USD")}</span>
        <span className="text-[11px] text-ink-subtle">of {formatMoney(report.thresholdUsd, "USD")} budget</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <button onClick={onOpen} className="mt-2 inline-flex cursor-pointer items-center gap-1 font-bold text-[#00684a] underline hover:opacity-80">
        View usage by model
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Modal chrome
// ─────────────────────────────────────────────────────────

function ModalShell({ children, onClose, dark = false }: { children: React.ReactNode; onClose: () => void; dark?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-md transform overflow-hidden rounded-lg border p-6 shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200",
          dark ? "border-[#1c2d38] bg-[#001e2b] text-white" : "border-hairline bg-white text-ink"
        )}
      >
        <button
          onClick={onClose}
          className={cn("absolute right-4 top-4 cursor-pointer rounded-lg p-1.5 transition-colors", dark ? "text-slate-400 hover:bg-[#003d4f]/30 hover:text-white" : "text-ink-subtle hover:bg-slate-100 hover:text-ink")}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ icon, iconBg, title, subtitle, dark = false }: { icon: React.ReactNode; iconBg: string; title: string; subtitle: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm", iconBg)}>{icon}</div>
      <div>
        <h3 className={cn("text-lg font-bold tracking-tight", dark ? "text-white" : "text-ink")}>{title}</h3>
        <p className={cn("text-xs font-medium", dark ? "text-slate-400" : "text-[#5c6c7a]")}>{subtitle}</p>
      </div>
    </div>
  );
}
