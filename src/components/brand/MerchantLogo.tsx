"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/**
 * Real brand logos for merchants and providers, fetched from Google's favicon
 * service (no API key, cached by the browser). Unknown merchants fall back to
 * initials so nothing ever renders as a broken image.
 */

const DOMAINS: Record<string, string> = {
  figma: "figma.com",
  "github copilot": "github.com",
  github: "github.com",
  copilot: "github.com",
  anthropic: "anthropic.com",
  "anthropic claude": "anthropic.com",
  claude: "anthropic.com",
  openai: "openai.com",
  chatgpt: "openai.com",
  slack: "slack.com",
  zoom: "zoom.us",
  notion: "notion.so",
  linear: "linear.app",
  vercel: "vercel.com",
  aws: "aws.amazon.com",
  "amazon web services": "aws.amazon.com",
  "google workspace": "workspace.google.com",
  "google cloud": "cloud.google.com",
  gcp: "cloud.google.com",
  razorpay: "razorpay.com",
  stripe: "stripe.com",
  loom: "loom.com",
  miro: "miro.com",
  jira: "atlassian.com",
  confluence: "atlassian.com",
  atlassian: "atlassian.com",
  hubspot: "hubspot.com",
  intercom: "intercom.com",
  asana: "asana.com",
  "monday.com": "monday.com",
  monday: "monday.com",
  trello: "trello.com",
  dropbox: "dropbox.com",
  box: "box.com",
  canva: "canva.com",
  adobe: "adobe.com",
  "adobe creative cloud": "adobe.com",
  webflow: "webflow.com",
  framer: "framer.com",
  mailchimp: "mailchimp.com",
  sendgrid: "sendgrid.com",
  resend: "resend.com",
  twilio: "twilio.com",
  datadog: "datadoghq.com",
  sentry: "sentry.io",
  postman: "postman.com",
  "1password": "1password.com",
  lastpass: "lastpass.com",
  okta: "okta.com",
  "microsoft 365": "microsoft.com",
  microsoft: "microsoft.com",
  office: "microsoft.com",
  salesforce: "salesforce.com",
  zendesk: "zendesk.com",
  airtable: "airtable.com",
  clickup: "clickup.com",
  calendly: "calendly.com",
  docusign: "docusign.com",
  supabase: "supabase.com",
  cloudflare: "cloudflare.com",
  heroku: "heroku.com",
  digitalocean: "digitalocean.com",
  shopify: "shopify.com",
  quickbooks: "quickbooks.intuit.com",
  xero: "xero.com",
  gusto: "gusto.com",
  rippling: "rippling.com",
  deel: "deel.com",
  grammarly: "grammarly.com",
  cursor: "cursor.com",
  perplexity: "perplexity.ai",
  midjourney: "midjourney.com",
};

/** Resolves a merchant name (or provider key such as GITHUB_COPILOT) to a domain. */
export function merchantDomain(name: string): string | null {
  const key = name.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (DOMAINS[key]) return DOMAINS[key];
  if (/\.[a-z]{2,}$/.test(key) && !key.includes(" ")) return key; // already a domain
  const hit = Object.keys(DOMAINS).find((k) => key.startsWith(k + " ") || key.endsWith(" " + k));
  return hit ? DOMAINS[hit] : null;
}

export function MerchantLogo({
  name,
  domain,
  size = 32,
  className,
  rounded = "rounded-lg",
}: {
  name: string;
  domain?: string | null;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const resolved = domain ?? merchantDomain(name);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center border border-hairline bg-surface-3 font-bold text-ink",
          rounded,
          className
        )}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
        aria-label={name}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-hairline bg-white", rounded, className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny third-party favicon, not worth the image optimizer */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(resolved)}&sz=128`}
        alt={`${name} logo`}
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="object-contain"
      />
    </div>
  );
}
