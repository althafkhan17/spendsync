"use client";

import React, { useState } from "react";
import { IntegrationCard, PROVIDERS } from "@/components/dashboard/IntegrationCard";
import type { IntegrationRow } from "@/app/actions/integrations";
import { Plug, ShieldCheck, Zap, Search } from "lucide-react";

const PROVIDER_KEYS = Object.keys(PROVIDERS);

export function IntegrationsList({
  activeIntegrations,
}: {
  activeIntegrations: IntegrationRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // Stats (computed on all data, keeping metrics stable)
  const connectedCount = activeIntegrations.filter((i) => i.isActive).length;
  const pendingAuditCount = activeIntegrations.filter(
    (i) => i.isActive && !i.lastAuditAt
  ).length;

  // Filter keys based on search
  const filteredKeys = PROVIDER_KEYS.filter((key) => {
    const meta = PROVIDERS[key];
    if (!meta) return false;
    const query = searchQuery.toLowerCase().trim();
    return (
      meta.name.toLowerCase().includes(query) ||
      meta.description.toLowerCase().includes(query)
    );
  });

  const activeKeys = filteredKeys.filter((key) =>
    activeIntegrations.some((i) => i.provider === key && i.isActive)
  );

  const availableKeys = filteredKeys.filter(
    (key) => !activeIntegrations.some((i) => i.provider === key && i.isActive)
  );

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search integrations by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-full border border-hairline bg-white text-sm text-ink placeholder-ink-tertiary focus:border-[#00ed64] focus:ring-1 focus:ring-[#00ed64] focus:outline-none transition-all shadow-sm"
          />
        </div>

        {/* Stats pills */}
        <div className="flex flex-wrap gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-hairline bg-white px-3.5 py-2 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-3 border border-hairline">
              <Plug className="h-3.5 w-3.5 text-ink-muted" />
            </div>
            <div>
              <p className="text-[10px] text-ink-tertiary font-bold uppercase tracking-wider">Available</p>
              <p className="text-xs font-bold text-ink">
                {PROVIDER_KEYS.length} Platforms
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-[#00ed64]/20 bg-[#c3f0d2]/70 px-3.5 py-2 shadow-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#c3f0d2] border border-[#00ed64]/30">
              <Zap className="h-3.5 w-3.5 text-[#00684a]" />
            </div>
            <div>
              <p className="text-[10px] text-[#00684a]/85 font-bold uppercase tracking-wider">Connected</p>
              <p className="text-xs font-bold text-[#00684a]">
                {connectedCount} Active
              </p>
            </div>
          </div>

          {pendingAuditCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 border border-amber-200/30">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-amber-600/80 font-bold uppercase tracking-wider">Pending</p>
                <p className="text-xs font-bold text-amber-600">
                  {pendingAuditCount} Awaiting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main grids */}
      {filteredKeys.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-hairline bg-white p-8 text-center shadow-sm animate-in fade-in duration-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 mb-4 border border-hairline">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-ink">No integrations found</h3>
          <p className="mt-1.5 text-xs text-ink-subtle max-w-sm leading-normal">
            No connectors match &quot;{searchQuery}&quot;. Try searching for other platforms like Figma, GitHub, or Anthropic.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-4 rounded-full border border-hairline-strong px-4 py-1.5 text-xs font-bold text-ink hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-305">
          {/* Active Audits Section */}
          {activeKeys.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-[14px] font-bold text-ink flex items-center gap-2 tracking-tight">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Active Audits
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeKeys.map((key) => {
                  const match = activeIntegrations.find(
                    (i) => i.provider === key && i.isActive
                  );
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
          {availableKeys.length > 0 && (
            <div className="space-y-4 pt-2">
              <h2 className="text-[14px] font-bold text-ink tracking-tight">
                Available Platforms
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {availableKeys.map((key) => {
                  return <IntegrationCard key={key} providerKey={key} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
