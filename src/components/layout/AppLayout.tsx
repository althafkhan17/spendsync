"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-ink">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
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
