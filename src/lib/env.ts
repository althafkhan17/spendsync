/**
 * Centralised environment helpers.
 *
 * Every optional external dependency (Resend sender, CloudMailin inbound
 * address, public app URL) is resolved here so routes and actions never
 * hard-code vendor specifics.
 */

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Sender used for all outbound alerts. Override with RESEND_FROM_EMAIL once a domain is verified. */
export function getResendFrom(): string {
  return process.env.RESEND_FROM_EMAIL || "SpendSync Alerts <onboarding@resend.dev>";
}

/** True when a real Resend key is configured (not a placeholder). */
export function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  return !(key === "mock" || key.startsWith("re_mock") || key === "YOUR_RESEND_KEY");
}

/**
 * Builds the per-workspace inbound address. CloudMailin delivers anything sent to
 * `<local>+<tag>@<domain>` to the same webhook, and the tag carries the workspace id.
 */
export function getWorkspaceRoutingEmail(workspaceId: string): string {
  const base = process.env.CLOUDMAILIN_INBOUND_ADDRESS || "ac863b2208948441ba11@cloudmailin.net";
  const [local, domain] = base.split("@");
  if (!local || !domain) return base;
  return `${local}+${workspaceId}@${domain}`;
}

/**
 * Validates a cron / manual trigger request. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; that header is the only accepted
 * credential so the secret never lands in URL access logs.
 * In development the guard is relaxed so engines can be triggered locally.
 */
export function isAuthorizedCronRequest(headers: Headers): boolean {
  if (isDevelopment()) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return headers.get("Authorization") === `Bearer ${secret}`;
}
