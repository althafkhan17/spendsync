# SpendSync

SaaS spend and renewal tracker for small teams. SpendSync ingests invoices by email, tracks subscriptions and renewals, audits idle vendor seats (GitHub Copilot, Figma) and monitors Anthropic token spend against a monthly budget. Alerts go out by email.

Built with Next.js 16 (App Router), Clerk, Prisma + Postgres, Gemini, Resend and Tailwind.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values (see below)
npx prisma generate
npx prisma migrate deploy     # or `npx prisma migrate dev` against a dev database
npm run dev                   # http://localhost:3000
```

Optional demo data for your own workspace:

```bash
npm run seed:demo -- --email you@example.com   # add --reset to wipe first
```

## Environment variables

See [.env.example](.env.example) for the full list with comments. Required for the dashboard to run: the Clerk keys and `DATABASE_URL` / `DIRECT_URL`. Everything else degrades gracefully:

| Variable | Needed for |
| --- | --- |
| `GEMINI_API_KEY` | Parsing inbound invoices on the email webhook |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Sending alert emails (unset = emails are logged, not sent) |
| `CRON_SECRET` | Authorising Vercel Cron calls to `/api/cron/*` |
| `WEBHOOK_SECRET` | Authorising CloudMailin posts to `/api/webhooks/inbound` |
| `INTEGRATION_ENCRYPTION_KEY` | Encrypting vendor API keys and OAuth tokens at rest |
| `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `FIGMA_REDIRECT_URI` | Figma OAuth |
| `CLOUDMAILIN_INBOUND_ADDRESS` | Base inbound address shown in Settings |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails and OAuth redirects (falls back to `VERCEL_URL`) |

`INTEGRATION_ENCRYPTION_KEY` must be the same value in every environment that shares a database, otherwise credentials written by one environment cannot be read by another.

## Public demo

`/demo` is a read-only sample workspace ("Northwind Studio") that shows the whole dashboard without sign-up. It is excluded from Clerk in `src/proxy.ts`, renders entirely from `src/lib/demo-data.ts`, never touches the database, and every write action is inert. The data is fictional and intentionally unlabelled apart from the "Sample workspace" pill in the sidebar, so it records cleanly for videos; share it with prospects.

## How it works

**Email ingestion.** Each workspace gets a routing address like `<inbox>+<workspaceId>@cloudmailin.net` (shown in Settings). CloudMailin posts the email as JSON to `POST /api/webhooks/inbound?secret=<WEBHOOK_SECRET>`. Gemini extracts the vendor, seat count, unit price, currency, billing cycle and renewal date from the PDF attachment (or the text body as a fallback) and the subscription is created or updated. Every email is recorded on the Invoices page.

**Integrations.** Connecting GitHub Copilot or Anthropic verifies the credential live and runs the first audit immediately. Figma uses OAuth. Reports are labelled `LIVE` when the numbers came from the vendor API and `SIMULATED` when the token lacks the required scope; the card explains what would unlock live data.

**Scheduled engines** (`vercel.json`, all UTC):

| Route | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/sync-anthropic` | 06:00 | Pull month-to-date Anthropic spend; email when over budget (once per month) |
| `/api/cron/optimize-seats` | 07:00 | Compare billed seats with active seats for every seat-based integration |
| `/api/cron/evaluate-leaks` | 07:30 | Email owners about seat leaks whose renewal is within 7 days (throttled to every 5 days) |
| `/api/cron/renewals` | 08:00 | Email owners about subscriptions renewing in 7 days (`?days=` overrides) |

Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. In development the guard is relaxed so you can hit the routes directly.

## Project layout

```
src/app/(dashboard)/dashboard   Dashboard pages (server components)
src/app/actions                 Server actions (subscriptions, integrations, workspace, emails)
src/app/api/cron                Cron entry points — thin wrappers around src/lib/engines
src/app/api/webhooks/inbound    CloudMailin webhook + Gemini extraction
src/lib/engines                 Seat audit, Anthropic sync, leak evaluation, renewal alerts
src/lib/providers               Vendor API clients (GitHub Copilot, Anthropic, Figma)
src/lib/crypto.ts               AES-256-GCM encryption for stored credentials
src/lib/simulation.ts           Deterministic simulated data, always labelled as such
src/emails                      HTML email templates
prisma/                         Schema and migrations
scripts/                        Demo seeding and ad hoc maintenance scripts
```

## Scripts

```bash
npm run dev          # start the dev server
npm run build        # prisma generate + next build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run seed:demo    # seed curated demo data into a workspace
```
