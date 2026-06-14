"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Home,
  CreditCard,
  Receipt,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Subscriptions", href: "/dashboard/subscriptions", icon: CreditCard },
  { label: "Invoices", href: "/dashboard/invoices", icon: Receipt },
  { label: "Integrations", href: "/dashboard/integrations", icon: Plug },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        id="mobile-menu-toggle"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out",
          // Desktop: collapsed or expanded
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
          // Mobile: off-screen or visible
          mobileOpen
            ? "w-[280px] translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo / Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
          >
            {/* Logo icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 shadow-sm">
              <span className="text-xs font-bold text-white tracking-tight">
                S
              </span>
            </div>
            {!collapsed && (
              <span className="text-[15px] font-semibold tracking-tight text-slate-900 transition-opacity duration-200">
                SpendSync
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            id="mobile-menu-close"
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                id={`nav-${item.label.toLowerCase()}`}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden border-t border-slate-100 px-3 py-2 lg:block">
          <button
            id="sidebar-collapse-toggle"
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* User Profile — Clerk UserButton */}
        <div
          id="user-profile-section"
          className="border-t border-slate-100 px-3 py-3"
        >
          <div
            className={cn(
              "flex items-center overflow-hidden rounded-lg px-2 py-2",
              collapsed ? "justify-center" : "gap-3"
            )}
          >
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
              showName={!collapsed}
            />
            {!collapsed && (
              <p className="truncate text-xs text-slate-400">
                Manage account
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
