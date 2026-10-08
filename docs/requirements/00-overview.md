# Requirements Overview

## Vision

A household finance app that lets one or more people manage shared and
personal money: track accounts and transactions, budget by category, and
track investments and net worth over time — primarily through manual entry,
with optional Open Banking connections to automate account/transaction sync.

## Scope Decisions (confirmed with stakeholder)

These decisions were made explicitly and constrain everything below:

- **Core use cases in scope for this design:** personal budgeting & expense
  tracking, household/shared money management, investment & net-worth
  tracking. Small-business invoicing/accounting is **out of scope**.
- **Tenancy model:** household-based. Multiple users share a household with
  distinct roles/permissions (not a single-user-only model, not a generic
  multi-tenant SaaS/organizations model).
- **Data entry:** manual entry is the primary path for all data (accounts,
  transactions, investments). Open Banking integration is supported as a
  secondary, optional sync mechanism — not a hard dependency of the core
  loop.
- **Currency:** multi-currency is supported at the account/holding level
  (each account or holding has its own currency), and the system does
  **not automate** currency conversion or FX rate fetching anywhere. Net
  worth stays unblended, per currency (confirmed — see
  [OQ-3](05-assumptions-and-open-questions.md#oq-3-net-worth-aggregation-across-currencies)).
  **One deliberate, scoped exception:** Investment Goals *do* combine
  currencies into a single progress figure, using a manually-entered
  Currency Reference Rate — see OQ-13 and FR-9. "No automated FX" ≠ "no FX,
  ever"; the user can still manually reconcile currencies where it's useful.
- **Target market & locale:** Brazil (BRL) is the primary market; the app
  also supports US-based users (USD). Both pt-BR and en-US locales, and
  both currencies, are in scope from the start. This also means Open
  Banking must support at least two regional providers (Open Finance
  Brasil for BRL, a US-oriented provider for USD) behind one interface —
  see [OQ-4](05-assumptions-and-open-questions.md#oq-4-target-market-language-and-regulatory-framework).
  Exact regulatory scope (LGPD + applicable US rules) still needs legal
  review, but doesn't block architecture work.
- **Investments:** manually entered only for v1. No live market data feed in
  v1. Every Investment Holding lives under exactly one checking, savings,
  or investment Account (OQ-76) — not standalone (confirmed — see OQ-14) — so buy/sell/dividend/
  interest/redemption/tax all flow through that account like any other
  transaction. A **FII Portfolio Builder** (Brazilian real-estate-fund
  portfolio construction tool) ships in v1; a **Stock Portfolio Builder**
  follows in a later phase. External analysis/recommendation APIs (e.g.,
  "best FIIs to invest," stock graph analysis) are an explicit **future
  phase**, isolated behind a swappable boundary so they don't entangle with
  v1.
- **Investment Goals:** a user can define a goal (target amount,
  currency, due date) and fund it by allocating a percentage of one or more
  Investment Holdings to it, even across different currencies — contributions
  convert via a manually-maintained Currency Reference Rate and sum to one
  combined progress figure. A Holding can fund multiple Goals, but its
  allocated percentages must never sum past 100% (see CUC-10, FR-8, FR-9).
- **Historical tracking (added after the initial design pass):** a
  Holding's valuation is a **history** (Valuation Snapshot, FR-5.2), not a
  single mutable field — every update, manual or transaction-driven, is
  timestamped. This is what makes net worth by month (FR-5.4) and Goal
  progress by month (FR-8.7) possible for any past year, using the latest
  snapshot at or before each month's end. Account balance by month (FR-6.6)
  needed no equivalent addition — it was already derivable for free from
  the dated Transaction ledger. Budgets get their own historical-integrity
  mechanism: a **Budget Period** (FR-4.9) freezes the target amount that
  was actually in effect each month, so editing a Budget today never
  silently rewrites how past months are judged against it (confirmed).
- **Credit Cards:** a financial account (checking, savings, or credit card)
  can have any number of physical Credit Cards attached, each storing only
  network/brand, last 4 digits, and three distinct dates — closing date,
  bill due date, and expiration date — never the full card number or CVV,
  which keeps the system out of PCI-DSS scope by design (see CUC-3,
  FR-2.7–FR-2.9, NFR-SEC-7, NFR-COMP-3). Each Credit Card carries its own
  outstanding balance and its own **Card Transaction** ledger, kept fully
  separate from its parent account's transaction history — a card purchase
  accrues on the card's bill; only a Credit Card Bill Payment later touches
  the account's balance (confirmed — see OQ-15, OQ-16, FR-2.10,
  FR-3.7–FR-3.11). Installments are not tracked automatically — the user
  records each one manually (OQ-18). Partial bill payments and
  revolving-credit interest are explicitly out of scope for now (OQ-19).
- **Transactions:** one unified entry point covers every cash-flow event —
  withdrawals, deposits, boleto, Pix (sent/received), transfers, credit
  card bill payments, and investment activity (buy/sell/dividend/interest/
  redemption/tax) — modeled as reference-data **kinds** riding on top of a
  small, stable set of **effects** (simple movement, transfer, investment
  trade, investment cash event), so new payment methods are a data change,
  not a schema/logic change. Budgets count credit card charges as spend
  immediately (accrual basis), not when the bill is paid (see CUC-4, FR-3,
  FR-4.5).
- **Categories & Budgets:** a household maintains a shared, two-level
  Category → Subcategory taxonomy (predefined-or-custom, FR-10). A Budget
  targets one or more Categories and/or Subcategories in any mix; assigning
  a whole Category rolls up to include all its Subcategories automatically
  (confirmed — see OQ-20). Each Category/Subcategory can be claimed by at
  most one Budget per scope/period, so "actual spend" is never ambiguous
  between two Budgets (confirmed, enforced — see OQ-21). This overlap check
  is genuine Engine-level business logic, not UI validation.
- **Customizable Dashboard:** rather than one fixed summary screen, a
  user's Dashboard is composed of **Widgets** they add, remove, reorder,
  and configure themselves, drawn from a growing library (net worth trend,
  account balance by month, spending by Category/Subcategory, income vs.
  expense, budget status, Goal progress by month, and more over time
  — FR-6.7). New Widget types are a data addition, not a Dashboard rework
  — the same "grows as data, not code" discipline as Transaction Kind and
  Category. Dashboard layout is personal per user, not shared at the
  household level, even for Widgets showing shared data (confirmed — see
  OQ-22).
- **Platform:** web app now (React + Tailwind CSS with the project's own
  component kit, dark and light themes, responsive for desktop and mobile
  browsers — approved design in `docs/design/mockups/`). Native mobile is a later phase — the frontend decomposition
  (EBD) should keep Flows/Interactions reusable by a future native client
  rather than assuming web-only where it's free to avoid.
- **Security posture:** strong from day one — MFA required, audit logging of
  sensitive actions, and session/device management. This reflects the
  regulated nature of open-banking-adjacent data even though most data entry
  is manual.
- **Logging:** beyond the compliance-facing Audit Log, the system logs
  **all** application activity and **all errors**, tagged with the acting
  user's ID, so bugs can be traced and fixed. This is a distinct,
  broader, engineering-facing concern from the Audit Log — see
  "Application Log" in [04-glossary.md](04-glossary.md). Log destination
  uses Winston's own **Transport** mechanism (confirmed — see OQ-10):
  stdout/console for v1, more transports addable later as configuration,
  no custom abstraction needed.
- **Notifications:** in-app is the confirmed v1 minimum delivery channel.
  The delivery channel itself is a named volatility (more channels expected
  later) and must sit behind an abstraction from the start — see
  [OQ-5](05-assumptions-and-open-questions.md#oq-5-notification-delivery-channels).
- **Audit log retention:** indefinite for now — no automatic purge. Revisit
  if a future regulatory review mandates a cap.
- **Design horizon:** full long-term vision is designed now (all three core
  use case groups, plus the Open Banking and portfolio-builder concerns),
  with phasing/sequencing to be decided later in the **PD** (Project Design)
  step — designing everything up front does not mean building everything
  in v1.

## Document Map

| Document | Purpose |
|---|---|
| [01-core-use-cases.md](01-core-use-cases.md) | The primary user journeys that drive the design, with volatility notes |
| [02-functional-requirements.md](02-functional-requirements.md) | Concrete, testable functional requirements, grouped by use case |
| [03-non-functional-requirements.md](03-non-functional-requirements.md) | Security, compliance, performance, reliability, maintainability, testability, observability requirements |
| [04-glossary.md](04-glossary.md) | Shared vocabulary for the domain |
| [05-assumptions-and-open-questions.md](05-assumptions-and-open-questions.md) | Explicit assumptions made to keep moving, flagged for confirmation |

## How This Feeds Harmonic Design

Per VBD/EBD method, requirements are captured here *before* decomposition so
that the core use cases (below) can be analyzed for functional and
non-functional volatility in the next design step. Anything marked
**[volatile]** in the use cases is a strong candidate to become its own
Engine/Resource Accessor (backend) or Flow (frontend) rather than being
absorbed into a more stable component.
