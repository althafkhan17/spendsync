"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  /** Route prefix for the sidebar navigation. Defaults to the real dashboard. */
  basePath?: string;
  /** Public demo: no Clerk user section, links stay inside the demo. */
  demo?: boolean;
}

export function AppLayout({ children, basePath = "/dashboard", demo = false }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-ink">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} basePath={basePath} demo={demo} />
      {/* Main content area — offset by sidebar width on desktop */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 ease-in-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
