# EBD review — October 2026

Re-decomposition of the frontend (`frontend/01-ebd-decomposition.md`)
against the approved design (`docs/design/mockups/`) and the reviewed requirements and
use cases (OQ-55 – OQ-87). **Confirmed (Q1–Q4 all yes) and applied.** No frontend code exists yet, so this is a
design-mode pass checked against design artifacts, not a code audit. The
stakeholder expected large divergence — the design round didn't follow
the EBD doc.

## 1. Findings — where the design diverged

| # | Finding | Severity |
|---|---|---|
| F1 | **Investments became a first-class destination** (Overview / Holdings by account / Rates, Value history drawer). The EBD doc spread it across Account Setup (Holding Management Flow) and Review Insights. Holdings are no longer *set up* (created only by transactions, OQ-53); what remains is tracking and maintenance — a distinct purpose and cadence. | High |
| F2 | **Profile is its own page and purpose** (personal info, preferences, password, sessions, invitations to me, delete account). The EBD doc split these between Authenticate (Security Maintenance Flow) and Manage Household (Edit Profile, Delete Account). "Look after *my* account" ≠ "run *the household*". | High |
| F3 | **App-wide chrome now hosts journey entry points**: the nav drawer's household switcher (+ Create household) and the header's notification bell, whose items act on *other* Experiences (accept invitation → Manage Household; archive holding → Investments). The EBD doc had the inbox as a Review Insights Interaction and no switcher at all. | High |
| F4 | **Transaction Correction Flow is gone**: the design has no search-and-pick step — correction happens on an expanded row of the all-transactions ledger (OQ-61), and the ledger itself is browsed and filtered. | Medium |
| F5 | **The period overview is part of Transactions** (time bar → in/out/total, balances, budgets, goals — FR-6.11). It has real state (selected year/month, currency) — a Flow, in Manage Finances, not Review Insights. | Medium |
| F6 | **Review Insights shrank**: Dashboard customization is v3 (OQ-67), Reporting is v2 (OQ-71), notifications moved to the shell (F3), and **Audit Log Flow's "browse + filter entries" Interaction contradicts FR-7.2** (export only — there is no browse endpoint). v1 = a fixed Dashboard view + audit export dialog. | Medium |
| F7 | **Onboard must also run for an additional household** (OQ-81) — from the switcher, already signed in, so Registration and MFA Enrollment must be skippable by configuration; the first-account step is mandatory (no Skip, FR-1.22). | Medium |
| F8 | **New Interactions with no home yet**: goal exchange-rate calculator (FR-9), icon + colour picker, claim-aware category picker, credit-card entry with live preview, payout holding multi-select, market value entry + history editing, index rate entry. | Low (placement) |
| F9 | **Utilities missing**: Theme (dark/light/system tokens, category palette), i18n/Message catalog (notifications by type, errors by code — NFR-I18N-3), Money/Number formatting (`Intl`, minor units, × 10,000 rates, whole percent). | Medium |

## 2. Proposed decomposition (8 Experiences + App Shell)

**App Shell** *(not an Experience — a layout that hosts every
Experience)*: header, nav drawer, notification bell, active household.
Holds no journey state; routes events to the owning Experience
(configuration: event type → Experience).

| Experience | Purpose | Flows | Standalone Interactions |
|---|---|---|---|
| **Authenticate** | Get in, get out | Sign In (credentials → MFA code / backup code), Account Recovery (request → new password) | Sign Out |
| **Onboard** | Set up a household from nothing | Registration, MFA Enrollment (method → QR + verify → backup codes), Household Setup, Guided Setup (composes Account & Card [mandatory], Category, Budget Flows from Account Setup) — Registration/MFA skipped by config when already signed in | — |
| **Manage Profile** *(new — F2)* | Look after my own account | Security (change password; sessions incl. sign out all others), Delete Account (ownership check → consequences → type-to-confirm) | Edit Personal Info, Edit Preferences (theme, language), Respond to Invitation |
| **Manage Household** | Run the household | Membership Management (members, role menu, invite, pending invitations, transfer ownership), Household Deletion | Leave Household, **Switch Household** (from the shell) |
| **Account Setup** | Configure containers and rules | Account & Card Management (4 types, card entry with live preview), Category Management (icon + colour, inline subcategories), Budget Management (claim-aware picker), Goal Management (create/edit/complete/reopen/delete, exchange-rate calculator) | — |
| **Manage Finances** | Record and review day-to-day money | Record Transaction (kind group → kind → fields; investment buy: asset, rate, goal allocations), **Browse Transactions** (filter, lazy ledger, expanded row → edit reuses Record entry, delete confirm), **Month Overview** (period bar, $/R$, balances, budgets, goals) | — |
| **Track Investments** *(new — F1)* | Follow and maintain investments | **Portfolio Overview** (net worth, payout this month + payout chart with holding selection, allocations, coming due), **Holding Maintenance** (by-account table, expanded row: allocations, market value + Value history), **Rates Maintenance** (index cards, update, history) | Archive Matured Holding (from a notification) |
| **Review Insights** | See the state of things | **Dashboard** (fixed panels, payout holding selection) — widgets v3, Reporting v2 | Export Audit Log (date-range dialog, Owner/Admin), Notification Inbox (hosted by the shell) |

**Removed / moved:** Holding Management Flow (Account Setup → Track
Investments as Holding Maintenance), Transaction Correction Flow (→ Browse
Transactions), Security Maintenance Flow (Authenticate → Manage Profile),
Edit Profile + Delete Account (Manage Household → Manage Profile),
Reporting Flow + Widget Interactions (deferred), Audit Log browsing
(contradicted FR-7.2).

**Utilities:** Validation, Alert/Toast, Password Strength, **Theme**
(tokens, dark/light/system, category palette), **i18n** (ICU catalog;
renders notifications by `type` and errors by `code`), **Formatting**
(money in minor units, rates × 10,000, whole percent, dates — `Intl`).

**Flow count:** 15 → **21** (Authenticate 2, Onboard 4, Manage Profile 2,
Manage Household 2, Account Setup 4, Manage Finances 3, Track Investments
3, Review Insights 1). Sequences get redrawn for every Flow (21), plus the
shell's cross-Experience notification routing (1) = **22 EBD sequences**.

## 3. Validation against core journeys (EBD Step 7)

- *Record a Pix payment, then see this month's budget move* — Record
  Transaction completes → Manage Finances refreshes Month Overview; no
  Flow touches its sibling.
- *Accept an invitation from the bell* — shell routes the event to Manage
  Household (or Manage Profile's Respond to Invitation); the inbox never
  calls the backend for the accept itself.
- *Add a new locale string for a notification type* — touches only the
  i18n catalog; no Flow or Experience changes (NFR-I18N-3).
- *Create a second household* — Onboard runs with Registration/MFA
  skipped by configuration; no new Flow.

## 4. Questions

- **Q1** Split **Manage Profile** out of Authenticate + Manage Household?
  *(recommend yes — F2)*
- **Q2** New **Track Investments** Experience? *(recommend yes — F1)*
- **Q3** **App Shell** as a non-Experience layout that hosts the bell and
  switcher and routes their events to the owning Experience?
  *(recommend yes — F3)*
- **Q4** Month Overview as a **Manage Finances** Flow (not Review
  Insights)? *(recommend yes — F5; it shares the page and the period
  state with the ledger)*

## Applied

- `frontend/01-ebd-decomposition.md` rewritten: the October 2026
  decomposition on top (tier tables generated from the same data as the
  diagrams), the original six-Experience version kept below as history
  (its old diagram file names no longer exist).
- `docs/design/diagrams/ebd-tiers/`: 8 Experiences + `app-shell.html` (new:
  `manage-profile.html`, `track-investments.html`, `app-shell.html`).
- `docs/design/diagrams/ebd-sequences/`: the 15 old sequences replaced by **22**
  (21 Flows + shell notification routing).
- Generator: `docs/design/diagrams/scripts/gen_ebd_oct2026.py` (single source for
  tiers, sequences and the doc's tables).
