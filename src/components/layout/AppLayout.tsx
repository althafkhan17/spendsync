"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* Main content area — offset by sidebar width on desktop */}
      <main className="flex-1 lg:pl-[260px] transition-all duration-300">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
