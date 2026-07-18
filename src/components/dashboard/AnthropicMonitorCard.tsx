"use client";

import React, { useState, useTransition } from "react";
import { Key, ShieldAlert, Eye, EyeOff, Cpu, Check, AlertCircle } from "lucide-react";

export function AnthropicMonitorCard() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [threshold, setThreshold] = useState("50.00");
  const [isPending, startTransition] = useTransition();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!apiKey.trim()) {
      setError("Anthropic API key is required.");
      return;
    }

    if (!apiKey.startsWith("sk-ant-")) {
      setError("Invalid API key format. Must start with 'sk-ant-'.");
      return;
    }

    const numericThreshold = parseFloat(threshold);
    if (isNaN(numericThreshold) || numericThreshold <= 0) {
      setError("Monthly threshold must be a positive number.");
      return;
    }

    startTransition(async () => {
      // Simulate verification api call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsConnected(true);
      setIsEnabled(true);
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsConnected(false);
      setIsEnabled(false);
      setApiKey("");
      setError(null);
    });
  };

  return (
    <div
      id="anthropic-claude-monitor"
      className="relative overflow-hidden rounded-lg border border-[#1c2d38] bg-[#001e2b] p-6 text-white shadow-md transition-all hover:shadow-lg"
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#00ed64]/5 via-transparent to-transparent pointer-events-none" />

      {/* Header section with Toggle */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#1c2d38] mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00ed64]/10 border border-[#00ed64]/20 text-[#00ed64]">
              <Cpu className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Anthropic Claude API Monitor
            </h3>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#c3f0d2] text-[#00684a] px-2.5 py-0.5 text-[10px] font-semibold border border-[#00ed64]/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00a35c]" />
                Active Monitor
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1c2d38] text-slate-300 px-2.5 py-0.5 text-[10px] font-semibold border border-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                Disconnected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-normal max-w-xl">
            Track real-time token consumption balances, monitor anomalous spikes, and prevent rogue developer loops from draining your cloud budget.
          </p>
        </div>

        {/* Custom Toggle Switch */}
        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {isEnabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={() => {
              if (isConnected) {
                setIsEnabled(!isEnabled);
              } else {
                setError("Please connect your API engine before enabling monitoring.");
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEnabled ? "bg-[#00ed64]" : "bg-slate-700"
            }`}
            aria-label="Toggle Claude Monitor"
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isEnabled ? "translate-x-5 bg-[#001e2b]" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Form Fields */}
      <form onSubmit={handleConnect} className="relative z-10 space-y-5">
        {isConnected ? (
          /* Active Connected State View */
          <div className="bg-[#003d4f]/30 border border-[#1c2d38] rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Configured Key</span>
                <span className="font-mono text-slate-200 block text-[13px]">
                  sk-ant-••••••••••••••••••••{apiKey.slice(-6)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 block font-medium">Active Safety Limit</span>
                <span className="font-semibold text-[#00ed64] block text-[13px]">
                  ${parseFloat(threshold).toFixed(2)} USD / month
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#c3f0d2] leading-normal">
              ✓ Auditing is fully active. Spent logs will be evaluated every 15 minutes. Warning notifications will route via Resend if spending exceeds limit.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isPending}
                className="h-9 px-4 rounded-full border border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10 transition-colors text-xs font-semibold flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Disconnecting..." : "Disconnect Engine"}
              </button>
            </div>
          </div>
        ) : (
          /* Input Configuration Fields */
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* API Key */}
              <div className="space-y-1.5">
                <LabelWithIcon htmlFor="claude-api-key" icon={Key} label="Anthropic API Key" />
                <div className="relative">
                  <input
                    id="claude-api-key"
                    type={showKey ? "text" : "password"}
                    required
                    placeholder="sk-ant-api53-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full h-11 rounded-md border border-[#1c2d38] bg-[#003d4f]/20 px-3 pr-10 text-[13px] text-white placeholder-slate-500 focus:border-[#00ed64] focus:ring-1 focus:ring-[#00ed64] focus:outline-none transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Threshold */}
              <div className="space-y-1.5">
                <LabelWithIcon
                  htmlFor="claude-threshold"
                  icon={ShieldAlert}
                  label="Monthly Burn Safety Threshold (USD)"
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold select-none">
                    $
                  </span>
                  <input
                    id="claude-threshold"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="100.00"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full h-11 rounded-md border border-[#1c2d38] bg-[#003d4f]/20 pl-7 pr-3 text-[13px] text-white placeholder-slate-500 focus:border-[#00ed64] focus:ring-1 focus:ring-[#00ed64] focus:outline-none transition-all font-semibold tabular-nums"
                  />
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  We will alert you instantly if your workspace spend surpasses this custom dollar amount.
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-950/40 border border-red-500/30 p-3 text-xs text-red-400 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Control */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="h-10 px-6 rounded-full bg-[#00ed64] hover:bg-[#00b545] text-[#001e2b] font-semibold text-[13px] shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer border border-transparent"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Connect Engine
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/* Local Label helper to ensure Lucide alignment */
function LabelWithIcon({
  htmlFor,
  icon: Icon,
  label,
}: {
  htmlFor: string;
  icon: any;
  label: string;
}) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </label>
  );
}
