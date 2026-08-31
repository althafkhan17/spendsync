# SpendSync ⚡
### Autonomous SaaS Cost Optimization with Adversarial Verification

> **micro1 Agentic Workflows Hackathon Submission**  
> **Repository:** [althafkhan17/spendsync](https://github.com/althafkhan17/spendsync)  
> **Benchmark Command:** `npm run eval:benchmark`

---

## 01. What SpendSync Does & Who It's For

### Who It's For
**FinOps teams, IT administrators, and engineering managers** who manage hundreds of SaaS seats across tools like GitHub Copilot, Figma, Slack, Zoom, and Notion.

### The Problem
Growing tech companies waste **15% to 30% of their SaaS budget** every year due to silent license sprawl:
1. **Dormant Seats:** Offboarded contractors, interns, and inactive teammates keep consuming enterprise licenses ($15–$50/seat/month).
2. **Contract Traps:** Enterprise agreements often specify contract floors (e.g. "minimum 15 seats"). Deprovisioning below that floor can trigger penalties or breach terms.
3. **The Single-Prompt LLM Trap:** If you ask a single LLM prompt to find seats to cut, it makes dangerous mistakes:
   - It flags **CI/CD runners, deploy bots (`github-actions-bot`), and security integrations** as dormant because they don't commit code like humans.
   - It hallucinates arithmetic when taxes, prorations, and mixed tiers appear on the same invoice.
   - It offers no audit trail, so IT teams can't trust its recommendations.

### The Solution
SpendSync solves this with a **3-agent pipeline backed by an adversarial rule verifier**. It extracts invoice terms, audits user activity, blocks dangerous cuts with hard rules, and gives admins a safe sandbox to simulate changes before any seat is touched.

---

## 02. Pre-Existing Code vs. Hackathon Additions

To comply with **Hackathon Ground Rule 02**, here is the exact breakdown of what existed before versus what was built during the hackathon:

| Component | Status | Description |
| :--- | :--- | :--- |
| **Next.js 16 + Tailwind Foundation** | *Pre-Existing* | Base Next.js App Router boilerplate, Tailwind CSS, and Clerk auth session setup. |
| **CloudMailin Inbound Hook** | *Pre-Existing* | Inbound email webhook endpoint receiving forwarded invoice emails. |
| **Database Schema** | *Pre-Existing* | Prisma schema with core models (`Workspace`, `Subscription`, `EmailLog`, `Integration`). |
| **Multi-Agent Pipeline (`src/lib/agents/`)** | 🚀 **Built in Hackathon** | Modular 3-stage agent pipeline: `InvoiceAgent` + `TelemetryAgent` + `VerifierAgent` + `Orchestrator`. |
| **Adversarial Verifier Engine** | 🚀 **Built in Hackathon** | Hard-rule verification layer enforcing math integrity, bot shielding, contract floors, and borderline activity flags. |
| **HITL & Sandbox Simulation (`src/app/actions/sandbox.ts`)** | 🚀 **Built in Hackathon** | Interactive user-prune checklist, live ROI impact calculator, zero-risk simulation, and 14-day rollback safety flag. |
| **16-Case Benchmark Engine (`benchmarks/`, `scripts/evaluate.ts`)** | 🚀 **Built in Hackathon** | Complete evaluation suite comparing the Single-Prompt Baseline against the Multi-Agent Pipeline across 16 scenarios. |
| **Agent Trajectory UI (`AgentInvestigationTrace.tsx`)** | 🚀 **Built in Hackathon** | Step-by-step visual audit trail displaying agent findings, execution time, and flagged safety issues. |
| **Live Benchmark Dashboard (`/dashboard/benchmarks`)** | 🚀 **Built in Hackathon** | Web UI allowing anyone to run the 16-case benchmark and view live comparison metrics. |

---

## 03. The 3-Agent Architecture

SpendSync uses a sequential multi-agent pipeline where each agent has a focused job, and an adversarial verifier catches mistakes before recommendations reach a human.

```
                  ┌───────────────────────────────────────────────────────────┐
                  │                 INCOMING AUDIT REQUEST                    │
                  │        (Invoice Document + User Telemetry Ledger)         │
                  └─────────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 1: InvoiceAgent                                                               │
     │ • Extracts itemized line items, seat unit price, and currency                       │
     │ • Identifies contract minimums (e.g., "10-seat commitment floor")                   │
     │ • Catches renewal lock-in dates and cancellation terms                              │
     │ • Output: Structured invoice data with source citations                             │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 2: TelemetryAgent                                                             │
     │ • Audits last-activity timestamps against inactivity thresholds (default: 30 days)   │
     │ • Identifies service accounts, CI/CD runners, and bots (`github-actions-bot`, etc.) │
     │ • Flags borderline activity (e.g., active 31 days ago) for extra review             │
     │ • Output: Enriched user list with dormancy and safety tags                          │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 3: VerifierAgent (Adversarial Rule Checker)                                   │
     │ • Rule 1 (Math Integrity): Ensures verifiedCuts × unitPrice === verifiedSavings     │
     │ • Rule 2 (Bot Shielding): Blocks deprovisioning of CI/CD runners and service bots   │
     │ • Rule 3 (Contract Floor): Clamps cuts so remaining seats never drop below baseline │
     │ • Rule 4 (Borderline Flag): Sends ambiguous cases to human review instead of cutting│
     │ • Output: Verified cuts, mathematically guaranteed savings, and safety warnings     │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 4: Orchestrator & Governance Package                                          │
     │ • Computes confidence score based on severity of any flagged issues                 │
     │ • Generates an audit trail and human-readable action plan                           │
     │ • Passes the package to the Human-in-the-Loop sandbox                               │
     └─────────────────────────────────────────────────────────────────────────────────────┘
```

### Why Deterministic Verification Matters
- **LLMs are unreliable at multi-step math:** When taxes, discounts, and seat counts mix together, generative models often hallucinate totals. Our `VerifierAgent` cross-checks every number with hard arithmetic.
- **Bot cuts break production:** Cutting `github-actions-bot` can take down an entire company's deployment pipeline. Hard pattern-matching rules ensure automated infrastructure accounts are never cut just because an LLM assumed zero commits meant inactive.

---

## 04. Human-in-the-Loop & Sandbox Simulation (Ground Rules 04 & 05)

No changes are made to upstream accounts automatically. Everything flows through a safe, two-step review process:

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                         HUMAN-IN-THE-LOOP WORKFLOW                                     │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │                                                                                        │
 │  1. Interactive Pruning Checklist                                                      │
 │     Admins review suggested seat cuts and can toggle individual users on/off.          │
 │     The dynamic impact meter recalculates monthly savings in real time.                │
 │                                                                                        │
 │  2. Zero-Risk Sandbox Simulation (Ground Rule 04)                                      │
 │     Clicking "Run Sandbox Simulation" models the full financial impact                 │
 │     (Current Spend, Projected Spend, Annual ROI, Retained Seats)                       │
 │     without modifying any real accounts.                                              │
 │                                                                                        │
 │  3. Human Confirmation (Ground Rule 05)                                                │
 │     An authorized admin approves the plan and can attach review notes.                 │
 │                                                                                        │
 │  4. Staged Action with 14-Day Rollback                                                 │
 │     Approved changes are staged with a 14-day rollback window, so any cut can be       │
 │     restored with a single click.                                                      │
 │                                                                                        │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 05. Measured Benchmark Results (16 Test Cases)

We ran both the **Single-Prompt Baseline** and the **SpendSync Multi-Agent Pipeline** across a 16-case benchmark suite (`benchmarks/dataset.ts`) spanning straightforward, difficult, and edge-case scenarios:

| Metric | Single-Prompt Baseline | Multi-Agent Pipeline | Improvement |
| :--- | :---: | :---: | :---: |
| **Recommendation Precision** | `90.6%` | **`100.0%`** | **`+9.4%`** |
| **Recall (Dormancy Catch Rate)** | `100.0%` | **`100.0%`** | `Tied (100%)` |
| **Dangerous Cuts (Bots / Service Accounts)** | `4 accounts cut` | **`0 accounts cut`** | **`100% Safe (0 Cuts)`** |
| **Contract Minimum Adherence** | `93.8%` | **`100.0%`** | **`+6.2% (Zero Violations)`** |
| **Evidence Traceability** | `18.0%` | **`100.0%`** | **`+82.0%`** |
| **Evaluation Latency** | `12ms` | **`8ms`** | **Instant** |

---

## 06. The Challenging Case: Protecting CI/CD Bots & Contract Floors

### Case #6: `case-06-bot-shielding` (GitHub Copilot Enterprise)

#### The Setup
An engineering team bills **6 GitHub Copilot seats at $19/seat ($114/month)**:
- 3 engineers are actively writing code.
- 1 former engineer (`gamma@corp.com`) left the company and has 0 commits in 95 days.
- 2 accounts (`github-actions-bot@corp.com` and `ci-security-runner@corp.com`) show 0 IDE commits because they are automated backend CI/CD runners.

#### What the Baseline Did (and Why It Failed)
The single-prompt LLM saw 3 accounts with 0 activity and recommended **cutting all 3 seats ($57/mo savings)**. It would have deleted both CI/CD runner accounts, breaking the automated deploy pipeline.
- **Baseline Precision:** `33.3%`
- **Dangerous Bot Cuts:** `2 accounts`

#### How SpendSync Handled It
1. `InvoiceAgent` parsed the $19/seat rate and 6 total seats.
2. `TelemetryAgent` recognized `github-actions-bot` and `ci-security-runner` as protected service accounts.
3. `VerifierAgent` rejected deprovisioning the 2 bot accounts, issued a high-severity warning, and approved cutting only the 1 genuine dormant seat (`gamma@corp.com` for $19/mo).
- **Multi-Agent Precision:** `100.0%`
- **Dangerous Bot Cuts:** `0 accounts`

---

## 07. The 5-Stage Improvement Changelog

| Stage | What We Changed | What Broke Before | Result |
| :--- | :--- | :--- | :--- |
| **0. Baseline** | Single-prompt LLM doing extraction + recommendations in one shot. | Mistook sales tax for seats; cut CI/CD bots; broke contract minimums. | **Precision: 90.6%**<br>Dangerous Cuts: 4<br>Contract Adherence: 93.8% |
| **1. Iteration 1** | Split extraction into `InvoiceAgent` and `TelemetryAgent`. | Better parsing, but still cut service bots due to lack of hard safety rules. | **Precision: 92.1%**<br>Dangerous Cuts: 3<br>Contract Adherence: 93.8% |
| **2. Iteration 2** | Added `VerifierAgent` with 4 deterministic rules (math, bots, contract floor, borderline). | Eliminated all bot cuts and clamped cuts to contract minimums. | **Precision: 100.0%**<br>Dangerous Cuts: 0<br>Contract Adherence: 100.0% |
| **3. Iteration 3** | Added Interactive Sandbox Simulation and HITL approval with 14-day rollback. | Admins can now test financial ROI before staging any changes. | **Governance: Fully Enforced**<br>Rollback Window: 14 Days |
| **4. Final System** | Built 16-case benchmark suite and live web dashboard (`/dashboard/benchmarks`). | Validated across 16 scenarios (Straightforward, Difficult, Edge Cases). | **Precision: 100.0%**<br>Recall: 100.0%<br>Evidence Traceability: 100.0% |

---

## 08. Reproduction Guide (Under 30 Seconds)

### Prerequisites
- Node.js `v20.x` or higher
- npm `v10.x` or higher

### Step 1: Clone and Install
```bash
git clone https://github.com/althafkhan17/spendsync.git
cd spendsync
npm install
```

### Step 2: Run the Benchmark Suite (No API Keys Needed)
```bash
npm run eval:benchmark
```
*Runs all 16 cases in under 1 second, prints the comparison table, and writes results to `benchmarks/results.json`.*

### Step 3: Run the Web App
```bash
npm run dev
```
1. Open [http://localhost:3000](http://localhost:3000).
2. Go to **Benchmarks** ([http://localhost:3000/dashboard/benchmarks](http://localhost:3000/dashboard/benchmarks)) to run evaluations from the UI.
3. Go to **Subscriptions** ([http://localhost:3000/dashboard/subscriptions](http://localhost:3000/dashboard/subscriptions)) and click **✨ Sparkles (Run Agent Investigation)** on any subscription to inspect the step-by-step trace and test the Human Approval Sandbox.

---

## 09. The Hot Take

> **"Don't try to fix bad LLM math with more LLM prompts. Use deterministic rule verification for safety and numbers, and let LLMs do what they are actually good at: reading unstructured text."**

When building autonomous agents for critical workflows (billing, user permissions, infrastructure), asking an LLM to "double check its work" often produces confident hallucinations. 

By combining **Gemini 2.5 Flash for document parsing** with a **deterministic, rule-based Verifier Agent** for safety checks, SpendSync gets the best of both worlds: flexible natural language understanding with zero hallucinated math and complete safety for production environments.

---

*Built for the micro1 Agentic Workflows Hackathon.*
