"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Mail, Cpu, Calendar, Receipt, Check } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white text-[#001e2b] selection:bg-[#00ed64]/30 selection:text-[#001e2b] antialiased font-sans">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-[#e1e5e8] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo with Receipt styling */}
          <Link
            href="/"
            onClick={(e) => {
              if (typeof window !== "undefined" && window.location.pathname === "/") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
                window.history.pushState(null, "", "/");
              }
            }}
            className="flex items-center gap-2.5 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00ed64] shadow-sm group-hover:scale-105 transition-transform duration-200">
              <Receipt className="h-4.5 w-4.5 text-[#001e2b]" />
            </div>
            <span className="text-base font-semibold tracking-tight text-[#001e2b] group-hover:text-[#00684a] transition-colors duration-150">
              SpendSync
            </span>
          </Link>

          {/* Navigation Links & Sign In */}
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-[#5c6c7a] hover:text-[#001e2b] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-full bg-[#00ed64] hover:bg-[#00b545] px-5 text-sm font-semibold text-[#001e2b] transition-colors shadow-sm"
            >
              Try Free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Brand Teal Deep with Green CTA */}
      <section className="bg-[#001e2b] text-white pt-20 pb-28 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden border-b border-[#1c2d38]">
        {/* Subtle decorative glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#003d4f]/30 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl">
          {/* Eyebrow Tag */}
          <div className="mx-auto mb-6 flex max-w-fit items-center gap-2 rounded-full border border-[#1c2d38] bg-[#001e2b] px-3.5 py-1 text-xs font-semibold text-[#00ed64] tracking-wider uppercase">
            <Sparkles className="h-3 w-3 text-[#00ed64]" />
            <span>Automated SaaS Spend Auditing</span>
          </div>

          {/* Hero Headline */}
          <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.10] tracking-[-1.5px] text-white">
            One spend platform.<br />
            <span className="text-[#00ed64]">Zero subscription waste.</span>
          </h1>

          {/* Hero Subhead */}
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-[#a8b3bc] leading-relaxed font-normal">
            Automate SaaS invoice tracking and subscription auditing. Forward your billing emails, and our secure parsing engine will extract costs, cycles, and renewals instantly.
          </p>

          {/* Action Row */}
          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href="/dashboard"
              className="flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-full bg-[#00ed64] hover:bg-[#00b545] px-6 text-sm font-semibold text-[#001e2b] shadow-md transition-all active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="flex w-full sm:w-auto h-11 items-center justify-center gap-2 rounded-full border border-[#5c6c7a] bg-transparent hover:bg-white/5 hover:border-white px-6 text-sm font-semibold text-white transition-all cursor-pointer"
            >
              Learn How It Works
            </a>
          </div>

          {/* Mock Dashboard UI - Realistic SaaS Dashboard Mockup */}
          <div className="relative mt-20 mx-auto max-w-4xl rounded-lg border border-[#e1e5e8] bg-white p-6 text-left shadow-2xl text-[#001e2b]">
            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e1e5e8] pb-5 mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#001e2b]">SpendSync Analytics</h3>
                <p className="text-xs text-[#5c6c7a] mt-1">Real-time SaaS spend overview and automated audit recommendations.</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-semibold bg-[#e3fcef] text-[#00a35c] px-3 py-1 rounded-full border border-[#00ed64]/20">
                Audits Active
              </span>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-[#f4f7f6] border border-[#e1e5e8] rounded-lg p-4">
                <span className="text-[9px] font-bold text-[#5c6c7a] uppercase tracking-wider block mb-1">Monthly SaaS Burn</span>
                <span className="text-xl font-extrabold text-[#001e2b]">$2,418.50</span>
                <span className="text-[11px] text-[#00a35c] block mt-1">✓ Synced from 14 sources</span>
              </div>
              <div className="bg-[#f4f7f6] border border-[#e1e5e8] rounded-lg p-4">
                <span className="text-[9px] font-bold text-[#5c6c7a] uppercase tracking-wider block mb-1">Active Seats Audited</span>
                <span className="text-xl font-extrabold text-[#001e2b]">84 Users</span>
                <span className="text-[11px] text-[#00a35c] block mt-1">11 Inactive flagged</span>
              </div>
              <div className="bg-[#f4f7f6] border border-[#e1e5e8] rounded-lg p-4">
                <span className="text-[9px] font-bold text-[#5c6c7a] uppercase tracking-wider block mb-1">Monthly Optimization Potential</span>
                <span className="text-xl font-extrabold text-red-600">$380.00</span>
                <span className="text-[11px] text-[#5c6c7a] block mt-1">3 active savings recommendations</span>
              </div>
            </div>

            {/* Subscriptions Table */}
            <div className="border border-[#e1e5e8] rounded-lg overflow-hidden bg-white">
              <div className="bg-[#f9fbfa] px-4 py-2.5 border-b border-[#e1e5e8] text-[10px] font-bold text-[#5c6c7a] uppercase tracking-wider grid grid-cols-4 gap-4">
                <span>Merchant</span>
                <span>Monthly Cost</span>
                <span>Billing Cycle</span>
                <span>Audit Status</span>
              </div>
              <div className="divide-y divide-[#e1e5e8]">
                <div className="px-4 py-3 grid grid-cols-4 gap-4 text-xs items-center">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="h-6 w-6 rounded bg-[#001e2b] text-white flex items-center justify-center font-mono text-[10px]">V</span>
                    <span>Vercel Enterprise</span>
                  </div>
                  <span className="font-semibold">$1,200.00</span>
                  <span className="text-[#5c6c7a]">Monthly</span>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c3f0d2] text-[#00684a] px-2 py-0.5 text-[10px] font-semibold border border-[#00ed64]/10">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00a35c]" />
                      Active
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 grid grid-cols-4 gap-4 text-xs items-center">
                  <div className="font-semibold flex items-center gap-2">
                    <span className="h-6 w-6 rounded bg-[#001e2b] text-white flex items-center justify-center font-mono text-[10px]">F</span>
                    <span>Figma Pro</span>
                  </div>
                  <span className="font-semibold">$450.00</span>
                  <span className="text-[#5c6c7a]">Monthly</span>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-600 px-2 py-0.5 text-[10px] font-semibold border border-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      11 Inactive Seats
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grids - Stark White Canvas & Soft Green Surface */}
      <section id="how-it-works" className="bg-[#f4f7f6] py-24 px-4 sm:px-6 lg:px-8 border-t border-[#e1e5e8]">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#001e2b]">
              Continuous Subscription Optimization
            </h2>
            <p className="mt-4 text-base text-[#5c6c7a] leading-relaxed max-w-lg mx-auto">
              No manual spreadsheets or custom trackers. Forward your invoice emails and let our background engine compile your active spend.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature Card 1 */}
            <div className="rounded-lg border border-[#e1e5e8] bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e3fcef] text-[#00a35c] mb-6">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#001e2b]">1. Email Ingestion</h3>
              <p className="mt-3 text-sm text-[#5c6c7a] leading-relaxed">
                Forward invoice PDFs or billing emails directly to your private workspace address. We parse and process the attachments instantly.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="rounded-lg border border-[#e1e5e8] bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e3fcef] text-[#00a35c] mb-6">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#001e2b]">2. Intelligent Ingestion</h3>
              <p className="mt-3 text-sm text-[#5c6c7a] leading-relaxed">
                Our parsing engine extracts exact line-item costs, billing frequencies, and merchant details from email text and PDFs.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="rounded-lg border border-[#e1e5e8] bg-white p-8 shadow-sm transition-all hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e3fcef] text-[#00a35c] mb-6">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[#001e2b]">3. Renewal Alerts</h3>
              <p className="mt-3 text-sm text-[#5c6c7a] leading-relaxed">
                Receive automated alerts exactly 7 days before any subscription renews, giving you ample time to cancel or downscale seats.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Brand Teal Deep */}
      <footer className="bg-[#001e2b] text-[#a8b3bc] py-16 px-4 sm:px-6 lg:px-8 border-t border-[#1c2d38]">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00ed64]">
              <Receipt className="h-4 w-4 text-[#001e2b]" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              SpendSync
            </span>
          </div>

          <p className="text-xs sm:text-sm">© {new Date().getFullYear()} SpendSync Inc. All rights reserved.</p>

          <div className="flex gap-6 items-center text-xs sm:text-sm">
            <span className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="h-4.5 w-4.5 text-[#00ed64]" />
              Secured with Clerk
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
