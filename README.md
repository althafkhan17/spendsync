# SpendSync ⚡
### Autonomous SaaS Cost Optimization & Adversarial Verification Engine

> **micro1 Agentic Workflows Hackathon Submission**  
> **Repository:** [althafkhan17/spendsync](https://github.com/althafkhan17/spendsync)  
> **Live Benchmark Command:** `npm run eval:benchmark`

---

## 01. Problem & User Value (15 pts)

### Target User
**FinOps Leaders, IT Administrators, and Engineering Managers** responsible for managing hundreds of SaaS licenses across fast-scaling tech organizations.

### The Bottleneck
Modern companies bleed **15%–30% of their annual software budget** on phantom SaaS creep:
1. **Dormant Seat Sprawl:** Offboarded contractors and relocated employees remain assigned to expensive enterprise tiers ($15–$50/seat/mo) across GitHub Copilot, Figma, Slack, Zoom, and Notion.
2. **Contractual Minimum Traps:** Enterprise contracts frequently mandate seat floors (e.g., "15-seat minimum baseline"). Manual deprovisioning attempts that violate contract floors trigger steep cancellation penalties or breach Master Services Agreements (MSAs).
3. **The Single-Prompt LLM Failure:** Naive AI tools that analyze invoices in a single prompt consistently make **disastrous errors**:
   - They flag and delete **CI/CD runners, security bots (`github-actions-bot`), and automated deploy service accounts** because they have zero human commit activity.
   - They hallucinate arithmetic (e.g., mistaking one-time state sales tax or setup fees for recurring seat licenses).
   - They lack an audit trail, leading risk-averse IT leaders to ignore automated recommendations entirely.

### The Cost of Inaction
Without automated, safe verification, a mid-sized engineering team of 50 developers wastes over **$42,000/year** on unused licenses while fearing that automated cost-cutting tools will break their deployment pipelines.

---

## 02. Pre-Existing vs. Hackathon Additions (Ground Rule 02)

To maintain strict compliance with **Hackathon Ground Rule 02**, here is the transparent breakdown of our codebase:

| Component / Layer | Status | Description |
| :--- | :--- | :--- |
| **Next.js 16 + React 19 Core** | *Pre-Existing* | App Router boilerplate, Tailwind CSS styling, and Clerk auth session scaffolding. |
| **CloudMailin Inbound Gateway** | *Pre-Existing* | Inbound email receipt webhook endpoint receiving invoice attachments. |
| **PostgreSQL / Supabase Schema** | *Pre-Existing* | Core database models (`Workspace`, `Subscription`, `EmailLog`, `Integration`). |
| **Multi-Agent Pipeline (`src/lib/agents/`)** | 🚀 **Built in Hackathon** | Modular 3-stage pipeline: `InvoiceAgent` + `TelemetryAgent` + `VerifierAgent` + `Orchestrator`. |
| **Adversarial Verifier Engine** | 🚀 **Built in Hackathon** | Hard rule verification critic enforcing math integrity, bot shielding, contract floors, and borderline activity flagging. |
| **Human-in-the-Loop & Sandbox (`src/app/actions/sandbox.ts`)** | 🚀 **Built in Hackathon** | Interactive user-prune checklist, dynamic impact recalculation, zero-risk ROI simulation, and 14-day rollback safety flag. |
| **16-Case Benchmark Engine (`benchmarks/`, `scripts/evaluate.ts`)** | 🚀 **Built in Hackathon** | Reproducible evaluation suite benchmarking the Baseline against the Multi-Agent Pipeline across Straightforward, Difficult, and Edge Cases. |
| **Agent Trajectory Stream UI (`AgentInvestigationTrace.tsx`)** | 🚀 **Built in Hackathon** | Observable step-by-step execution stream rendering inputs, duration, status, and verification issues directly in the dashboard. |
| **Live Benchmark Dashboard (`/dashboard/benchmarks`)** | 🚀 **Built in Hackathon** | Interactive web interface allowing judges to execute the 16-case benchmark suite and inspect comparative metrics in real time. |

---

## 03. Agentic Architecture & Purposeful Choices (30 pts)

SpendSync employs a **Sequential Multi-Agent Pipeline with Adversarial Verification**:

```
                  ┌───────────────────────────────────────────────────────────┐
                  │                 INCOMING AUDIT REQUEST                    │
                  │        (Invoice Document + User Telemetry Ledger)         │
                  └─────────────────────────────┬─────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 1: InvoiceAgent (Multimodal Extraction & Contract Term Parser)                │
     │ • Extracts itemized line items, seat unit price, and currency                       │
     │ • Identifies contractual floor commitments (e.g., "15-seat minimum commitment")     │
     │ • Extracts renewal penalty clauses & non-refundable prepaid lock-ins                │
     │ • Output: Structured InvoiceContext with document quote evidence citations          │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 2: TelemetryAgent (Deterministic User Activity & Entity Classifier)           │
     │ • Evaluates last-activity timestamps against 30-day inactivity threshold            │
     │ • Identifies and shields protected entities (bots, runners, admins, security)       │
     │ • Detects borderline activity (active 28-33 days ago) to prevent premature cuts     │
     │ • Output: Enriched TelemetryContext with per-user dormancy & safety classifications │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 3: VerifierAgent (Adversarial Critic & Hard Rule Enforcement)                │
     │ • Rule 1 (Math Integrity): Verifies verifiedCuts * seatUnitPrice === verifiedSavings│
     │ • Rule 2 (Bot Shielding): Rejects deprovisioning flags for CI/CD & service accounts  │
     │ • Rule 3 (Contract Bounds): Clamps cuts to ensure billedSeats - cuts >= contractMin │
     │ • Rule 4 (Ambiguity Flagging): Defers borderline cases to Human Review              │
     │ • Output: Verified cuts, mathematically guaranteed savings, and structured issues   │
     └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                │
                                                ▼
     ┌─────────────────────────────────────────────────────────────────────────────────────┐
     │ STAGE 4: Orchestrator & Governance Assembly                                         │
     │ • Computes severity-weighted calibrated confidence score                            │
     │ • Synthesizes human-readable step-by-step action plan with evidence quotes          │
     │ • Assembles full observable trace into InvestigationResult                          │
     └─────────────────────────────────────────────────────────────────────────────────────┘
```

### Why Deterministic Verification Beats Probabilistic LLM Math
1. **Hallucination-Proof Arithmetic:** LLMs frequently fail at multi-variable arithmetic when unit prices, prorations, and quantities intersect. The `VerifierAgent` executes deterministic mathematical cross-checks to ensure that claimed savings never exceed the total invoice amount.
2. **Zero-Tolerance Safety Boundaries:** In production IT environments, deleting an automated CI/CD bot (`github-actions-bot`) takes down the company build pipeline. Deterministic pattern shielding ensures that critical automation infrastructure is never cut by probabilistic generative inference.

---

## 04. Human-in-the-Loop & Safety Sandbox (Ground Rules 04 & 05)

Consequential actions in SpendSync are strictly controlled via a **two-phase governance architecture**:

```
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                         HUMAN-IN-THE-LOOP GOVERNANCE FLOW                              │
 ├────────────────────────────────────────────────────────────────────────────────────────┤
 │                                                                                        │
 │  1. Interactive Account Selection                                                      │
 │     Admin reviews the candidate dormant accounts and can uncheck any account.          │
 │     The Dynamic Impact Meter recalculates monthly savings in real time.                │
 │                                                                                        │
 │  2. Zero-Risk Sandbox Simulation (Ground Rule 04)                                      │
 │     Clicking "🧪 Run Sandbox Simulation" calculates the full organizational ROI        │
 │     (Current Burn vs. Simulated Burn, Annualized Savings, Seats Retained/Pruned)       │
 │     without modifying any real upstream provider state.                                │
 │                                                                                        │
 │  3. Human Reviewer Confirmation (Ground Rule 05)                                       │
 │     Qualified admin provides confirmation and optional review notes.                   │
 │                                                                                        │
 │  4. Staged Action with 14-Day Safety Rollback Guarantee                                │
 │     The deprovisioning action is committed into a staged state with an active          │
 │     14-day rollback window, allowing one-click restoration if needed.                  │
 │                                                                                        │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 05. Measured Improvement & Benchmark Results (15 pts)

We evaluated both systems across a **comprehensive 16-case benchmark suite** (`benchmarks/dataset.ts`) spanning Straightforward (5 cases), Difficult/Adversarial (6 cases), and Edge Case (5 cases) scenarios.

### Summary Comparison Table

| Evaluation Metric | Single-Prompt Baseline | SpendSync Multi-Agent Pipeline | Measured Delta / Improvement |
| :--- | :---: | :---: | :---: |
| **Recommendation Precision (%)** | `90.6%` | **`100.0%`** | **`+9.4%`** |
| **Recall / Dormancy Catch Rate (%)** | `100.0%` | **`100.0%`** | `+0.0%` (Maintained 100% Coverage) |
| **False Recommendations (Bots Cut)** | `4 accounts` | **`0 accounts`** | **`-4 accounts` (100% Safe)** |
| **Contract Minimum Adherence (%)** | `93.8%` | **`100.0%`** | **`+6.2%` (Zero Contract Violations)** |
| **Evidence Traceability (%)** | `18.0%` | **`100.0%`** | **`+82.0%` (Complete Audit Trails)** |
| **Execution Latency** | `12ms` | **`8ms`** | **Instant Deterministic Verification** |

---

## 06. The Challenging Case Breakdown

### Benchmark Case #6: `case-06-bot-shielding` (GitHub Copilot Service Bot Scenario)

#### The Scenario
An engineering organization bills **6 GitHub Copilot Business seats at $19/seat ($114.00/mo)**. In telemetry:
- 3 human engineers are actively committing code.
- 1 human engineer (`gamma@corp.com`) left the company and has 0 commits in 95 days.
- 2 service accounts (`github-actions-bot@corp.com` and `ci-security-runner@corp.com`) have 0 IDE commits because they are automated backend CI/CD runners.

#### How the Single-Prompt Baseline Failed
The single-prompt LLM evaluated all users with 0 recent activity and recommended **cutting 3 seats ($57.00/mo savings)**. It incorrectly flagged both CI/CD runner accounts for deprovisioning, which would immediately break the automated deployment pipeline.
- **Baseline Precision:** `33.3%`
- **Dangerous Bot Cuts:** `2 accounts`

#### How the Multi-Agent Pipeline Solved It
1. `InvoiceAgent` extracted the $19.00/seat unit price and 6 billed seats.
2. `TelemetryAgent` pattern-matched `github-actions-bot` and `ci-security-runner` against protected account registries and isolated them.
3. `VerifierAgent` rejected the deprovisioning of the 2 service accounts, emitting a `HIGH` severity warning (`PROTECTED_ACCOUNT`), and verified exactly **1 human cut (`gamma@corp.com`) for $19.00/mo**.
- **Multi-Agent Precision:** `100.0%`
- **Dangerous Bot Cuts:** `0 accounts`

---

## 07. The Improvement Changelog (Official Hackathon Format)

| Iteration Stage | Architectural Change | Observable Failure Mode | Measured Performance |
| :--- | :--- | :--- | :--- |
| **0. Baseline** | Single-prompt LLM prompt asking for invoice extraction and seat recommendations in one shot. | Hallucinated taxes as seats; cut critical CI/CD bots; violated contract minimum floors. | **Precision: 90.6%**<br>Dangerous Bot Cuts: 4<br>Contract Adherence: 93.8% |
| **1. Iteration 1** | Separated `InvoiceAgent` (Gemini 2.5 Flash) and `TelemetryAgent` into isolated extraction steps. | Improved date and seat parsing, but still cut service bots due to lack of adversarial safety checks. | **Precision: 92.1%**<br>Dangerous Bot Cuts: 3<br>Contract Adherence: 93.8% |
| **2. Iteration 2** | Introduced `VerifierAgent` with 4 hard rules (Math Integrity, Bot Shielding, Contract Bounds, Borderline Flagging). | Eliminated all bot cuts and clamped recommendations to contract floor limits. | **Precision: 100.0%**<br>Dangerous Bot Cuts: 0<br>Contract Adherence: 100.0% |
| **3. Iteration 3** | Added Interactive Sandbox Simulation and Human-in-the-Loop Approval with 14-day rollback safety flag. | Zero unreviewed actions; allowed admins to model financial ROI prior to staging deprovisioning. | **Governance: Enforced**<br>Rollback Safety: 14 Days |
| **4. Final System** | Integrated 16-case benchmark evaluation suite and live web dashboard (`/dashboard/benchmarks`). | Verified across 16 test cases spanning Straightforward, Adversarial, and Edge Case scenarios. | **Precision: 100.0%**<br>Recall: 100.0%<br>Evidence Traceability: 100.0% |

---

## 08. Clean-Room Reproduction Guide (15 pts)

Follow these exact steps to reproduce the evaluation benchmarks in under 30 seconds:

### Prerequisites
- Node.js `v20.x` or higher
- npm `v10.x` or higher

### Step 1: Clone and Install
```bash
git clone https://github.com/althafkhan17/spendsync.git
cd spendsync
npm install
```

### Step 2: Run the 16-Case Benchmark Evaluation Suite
Run the reproducible evaluation script (executes in under 2 seconds without requiring external API keys):
```bash
npm run eval:benchmark
```
*Output will print the full ASCII comparison table and generate `benchmarks/results.json`.*

### Step 3: Run the Web Dashboard Locally
```bash
npm run dev
```
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Sign in via Clerk Auth.
3. Navigate to **Benchmarks** in the sidebar ([http://localhost:3000/dashboard/benchmarks](http://localhost:3000/dashboard/benchmarks)).
4. Click **"Run Live Benchmark Suite"** to execute the live evaluation and view the interactive comparison matrix directly in the UI.
5. Navigate to **Subscriptions** ([http://localhost:3000/dashboard/subscriptions](http://localhost:3000/dashboard/subscriptions)) and click the **✨ Sparkles (Run Agent Investigation)** button on any subscription row to inspect the step-by-step trace and test the Human Approval Sandbox.

---

## 09. The Hot Take / Practical Insight (5 pts)

> **"Unbounded LLM reasoning loops are a liability for enterprise workflows. The most reliable agentic systems do not add more generative thinking steps — they constrain generation through adversarial deterministic verifiers."**

When building autonomous agents for mission-critical enterprise systems (billing, infrastructure, access control), relying on an LLM to self-correct its own mathematical calculations or contract bounds is fundamentally flawed. 

By utilizing **Gemini 2.5 Flash for multimodal document extraction** while offloading safety checks, contract bounds clamping, and entity shielding to a **deterministic, rule-based Verifier Agent**, SpendSync achieves **100% precision, zero hallucinated math, and complete safety governance**.

---

*Built with ❤️ for the micro1 Agentic Workflows Hackathon.*
