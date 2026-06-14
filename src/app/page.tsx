import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, ShieldCheck, Mail, Cpu, Calendar } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 h-[600px] w-[600px] translate-x-1/2 rounded-full bg-rose-500/5 blur-[150px] pointer-events-none" />

      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <span className="text-sm font-extrabold text-white tracking-tight">S</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-100 group-hover:text-white transition-colors duration-150">
              SpendSync
            </span>
          </Link>

          {/* Navigation/Sign In */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="relative group overflow-hidden rounded-xl bg-slate-900 p-[1px] font-medium text-white transition-transform active:scale-95 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-80 group-hover:opacity-100 transition-opacity" />
              <span className="relative block px-4 py-2 rounded-[11px] bg-slate-950 text-sm font-semibold transition-colors group-hover:bg-slate-950/40">
                Go to Dashboard
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:px-8 text-center">
        {/* Sparkle Tag */}
        <div className="mx-auto mb-6 flex max-w-fit items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/5 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Intelligent SaaS Spend Auditing</span>
        </div>

        {/* Hero Title */}
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-slate-100 sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.15]">
          AI-Powered SaaS Spend Tracking for{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Agencies & Teams
          </span>
        </h1>

        {/* Hero Description */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 md:text-xl">
          Automate SaaS receipt collection and get beautiful, structured spend auditing. Forward your receipts, and let Gemini handle the rest.
        </p>

        {/* CTA Actions */}
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/dashboard"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-900 hover:text-slate-100 hover:border-slate-700 transition-all backdrop-blur-sm"
          >
            Learn How It Works
          </Link>
        </div>

        {/* Mock Interface Wrapper */}
        <div className="relative mt-20 mx-auto max-w-5xl rounded-2xl border border-slate-800 bg-slate-900/20 p-2 shadow-2xl shadow-indigo-500/5 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/5 rounded-2xl pointer-events-none" />
          <div className="rounded-xl border border-slate-900 bg-slate-950 p-6 sm:p-10 text-left">
            <div className="flex flex-col md:flex-row items-start justify-between gap-6 border-b border-slate-900 pb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-100">SpendSync Analytics</h3>
                <p className="text-sm text-slate-400 mt-1">Real-time SaaS metrics computed from inbound receipt emails.</p>
              </div>
              <div className="flex h-10 w-28 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-400">
                Live Audits Active
              </div>
            </div>
            
            <div className="grid gap-6 mt-8 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-5">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Monthly Burn</span>
                <p className="text-2xl font-bold mt-2 text-slate-100">$2,418.50</p>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1.5">
                  Synced from 18 sources
                </span>
              </div>
              <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-5">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Subscriptions</span>
                <p className="text-2xl font-bold mt-2 text-slate-100">14</p>
                <span className="text-[11px] text-slate-400 mt-1.5 block">Across all teams</span>
              </div>
              <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-5">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Upcoming Renewals</span>
                <p className="text-2xl font-bold mt-2 text-slate-100">3</p>
                <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-1.5">
                  Alerts scheduled next 30 days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Sections */}
        <section className="mt-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
              Fully Automated Spend Intelligence
            </h2>
            <p className="mt-4 text-slate-400">
              No manual form filling. SpendSync integrates with email ingestion, AI models, and real-time alerts.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3 text-left">
            {/* Card 1 */}
            <div className="rounded-2xl border border-slate-900 bg-slate-950 p-6 hover:border-slate-800 transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                <Mail className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-100">1. Email Inbound Ingestion</h4>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Send invoice emails to your workspace address. CloudMailin parses payloads and forwards them to our webhooks instantly.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-slate-900 bg-slate-950 p-6 hover:border-slate-800 transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                <Cpu className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-100">2. Gemini AI Structured Data</h4>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Gemini 2.5 Flash processes the email body to extract merchant, exact cost, currency, and cycle with high confidence scores.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-slate-900 bg-slate-950 p-6 hover:border-slate-800 transition-colors group">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 mb-4 group-hover:scale-110 transition-transform">
                <Calendar className="h-5 w-5" />
              </div>
              <h4 className="text-base font-bold text-slate-100">3. Proactive Renewal Alerts</h4>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Vercel Cron triggers daily checks to notify your team via Resend exactly 7 days before any SaaS subscription renews.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/40 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} SpendSync Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-slate-300">Dashboard</Link>
            <Link href="/dashboard/settings" className="hover:text-slate-300">Settings</Link>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Secured with Clerk & Supabase
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
