"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
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

export interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        id="mobile-menu-toggle"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar shadow-sm lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5 text-sidebar-foreground/80" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          // Desktop: collapsed or expanded
          collapsed ? "lg:w-[72px]" : "lg:w-[260px]",
          // Mobile: off-screen or visible
          mobileOpen
            ? "w-[280px] translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Floating collapse toggle (desktop only, positioned in the middle of the right border) */}
        <button
          id="sidebar-collapse-toggle"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-50 h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/70 hover:text-sidebar-foreground shadow-md hover:bg-sidebar-accent hover:scale-105 transition-all cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
        {/* Logo / Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden group"
          >
            {/* Logo icon */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Receipt className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground transition-opacity duration-200 group-hover:text-primary">
                SpendSync
              </span>
            )}
          </Link>

          {/* Mobile close button */}
          <button
            id="mobile-menu-close"
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
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
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 border border-transparent",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-foreground border-sidebar-border shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Divider above user profile */}
        <div className="hidden border-t border-sidebar-border lg:block" />

        {/* User Profile — Clerk UserButton */}
        <div
          id="user-profile-section"
          className="border-t border-sidebar-border px-3 py-3"
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
                  avatarBox: "h-8 w-8 shrink-0",
                  userButtonOuterIdentifier: "hidden",
                },
              }}
            />
            {!collapsed && user && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate text-xs font-semibold text-sidebar-foreground leading-tight">
                  {user.fullName || user.primaryEmailAddress?.emailAddress.split("@")[0]}
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/60 font-medium mt-0.5">
                  Manage account
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
