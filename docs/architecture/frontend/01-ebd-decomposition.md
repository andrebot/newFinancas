# Frontend EBD Decomposition

**Current version: October 2026 re-decomposition** — derived from the
approved design (`docs/design/mockups/`) and the reviewed requirements and use cases
(OQ-55 – OQ-87). Review record and findings F1–F9:
`docs/architecture/11-ebd-review-2026-10.md`. The tier tables below are
generated from the same data as the diagrams
(`docs/design/diagrams/scripts/gen_ebd_oct2026.py`), so they can't drift apart.

**8 Experiences + the App Shell, 21 Flows, 22 sequences** (one per Flow
plus the shell's notification routing). Stack: React + Tailwind + the
project's own component kit (NFR-UX-1).

## Experiences

| Experience | Purpose |
|---|---|
| **Authenticate** | Get in, get out — the entry gate |
| **Onboard** | Set up a household from nothing |
| **Manage Profile** | Look after my own account |
| **Manage Household** | Run the household |
| **Account Setup** | Configure the containers and rules everything else runs on |
| **Manage Finances** | Record and review day-to-day money |
| **Track Investments** | Follow and maintain investments |
| **Review Insights** | See the state of things |

**What changed from the original six** (stakeholder decisions Q1–Q4):
**Manage Profile** is new (Security from Authenticate; Edit Profile and
Delete Account from Manage Household); **Track Investments** is new
(Holding Management left Account Setup; portfolio views left Review
Insights); Transaction Correction became **Browse Transactions**; **Month
Overview** is a Manage Finances Flow; Review Insights is a fixed Dashboard
+ audit export (widgets v3, reporting v2; audit browsing removed — FR-7.2
is export only).

## App Shell (layout, not an Experience)

Hosts the header (logo, **notification bell**), the nav drawer (identity,
**household switcher** + Create household, main nav, Export audit log,
Profile / Sign out) and the active household. It holds no journey state.
Chrome events are **routed by configuration** to the Experience that owns
them: `invitation.received` → Manage Profile (Respond to Invitation),
`holding.matured` → Track Investments (Archive Matured Holding), Switch
Household → Manage Household, Create household → Onboard. A new
notification type needs one routing entry and one catalog string.
Diagram: `docs/design/diagrams/ebd-tiers/app-shell.html`; sequence:
`docs/design/diagrams/ebd-sequences/app-shell-notification-routing.html`.

## Tiers per Experience

### Authenticate

**Purpose:** Get in, get out — the entry gate. Security Maintenance moved to Manage Profile (Q1). 'Remember me' removed (OQ-62).

| Flow | Interactions | Sequence |
|---|---|---|
| Sign In | Credential Entry, MFA Code Entry, Backup Code Entry | `docs/design/diagrams/ebd-sequences/authenticate-sign-in.html` |
| Account Recovery | Recovery Request, New Password Entry | `docs/design/diagrams/ebd-sequences/authenticate-account-recovery.html` |
| *(standalone)* | Sign Out | — |

**Utilities:** ValidationUtility, PasswordStrengthUtility, AlertUtility, I18nUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/authenticate.html`.

### Onboard

**Purpose:** Set up a household from nothing. Guided Setup composes Account Setup's Account & Card (mandatory, no Skip — FR-1.22), Category and Budget Flows. Registration + MFA Enrollment are skipped by configuration when the user is already signed in (additional household, OQ-81).

| Flow | Interactions | Sequence |
|---|---|---|
| Registration | Registration Form Entry | `docs/design/diagrams/ebd-sequences/onboard-registration.html` |
| MFA Enrollment | MFA Method Selection, MFA Setup Verification, Backup Codes Acknowledgement | `docs/design/diagrams/ebd-sequences/onboard-mfa-enrollment.html` |
| Household Setup | Household Name Entry | `docs/design/diagrams/ebd-sequences/onboard-household-setup.html` |
| Guided Setup | Wizard Navigation, Setup Complete Summary | `docs/design/diagrams/ebd-sequences/onboard-guided-setup.html` |

**Utilities:** ValidationUtility, PasswordStrengthUtility, AlertUtility, I18nUtility, FormattingUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/onboard.html`.

### Manage Profile

**Purpose:** Look after my own account. New Experience (Q1): split out of Authenticate (Security) and Manage Household (Edit Profile, Delete Account).

| Flow | Interactions | Sequence |
|---|---|---|
| Security | Password Change, Session List, Sign Out All Others | `docs/design/diagrams/ebd-sequences/manage-profile-security.html` |
| Delete Account | Ownership Check, Consequences Review, Type-to-Confirm | `docs/design/diagrams/ebd-sequences/manage-profile-delete-account.html` |
| *(standalone)* | Edit Personal Info, Edit Preferences, Respond to Invitation | — |

**Utilities:** ValidationUtility, PasswordStrengthUtility, AlertUtility, ThemeUtility, I18nUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/manage-profile.html`.

### Manage Household

**Purpose:** Run the household. Switch Household is hosted by the App Shell's household switcher; 'Create household' there starts Onboard (Q3).

| Flow | Interactions | Sequence |
|---|---|---|
| Membership Management | Member List, Role Menu, Invite Member, Pending Invitations, Remove Member Confirm, Transfer Ownership | `docs/design/diagrams/ebd-sequences/manage-household-membership-management.html` |
| Household Deletion | Consequences Review, Type-to-Confirm | `docs/design/diagrams/ebd-sequences/manage-household-household-deletion.html` |
| *(standalone)* | Leave Household, Switch Household | — |

**Utilities:** ValidationUtility, AlertUtility, I18nUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/manage-household.html`.

### Account Setup

**Purpose:** Configure the containers and rules everything else runs on. Holding Management left this Experience (holdings are created by transactions, maintained in Track Investments). The Exchange-Rate Calculator is client-side only (FR-9).

| Flow | Interactions | Sequence |
|---|---|---|
| Account & Card Management | Account Form, Card Entry with Live Preview, Archive Confirm | `docs/design/diagrams/ebd-sequences/account-setup-account-card-management.html` |
| Category Management | Category Card, Icon & Colour Picker, Inline Subcategory Entry, Archive Confirm | `docs/design/diagrams/ebd-sequences/account-setup-category-management.html` |
| Budget Management | Budget Form, Claim-Aware Category Picker, Delete Confirm | `docs/design/diagrams/ebd-sequences/account-setup-budget-management.html` |
| Goal Management | Goal Form, Goal Progress Card, Exchange-Rate Calculator, Complete / Reopen Confirm | `docs/design/diagrams/ebd-sequences/account-setup-goal-management.html` |

**Utilities:** ValidationUtility, AlertUtility, ThemeUtility, I18nUtility, FormattingUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/account-setup.html`.

### Manage Finances

**Purpose:** Record and review day-to-day money. Transaction Correction Flow removed — editing reuses Record Transaction's entry Interactions from an expanded ledger row. Month Overview stays here (Q4): same page, same period state.

| Flow | Interactions | Sequence |
|---|---|---|
| Record Transaction | Kind Group & Kind Selection, Transaction Entry, Investment Buy Entry, Goal Allocation Entry | `docs/design/diagrams/ebd-sequences/manage-finances-record-transaction.html` |
| Browse Transactions | Filter Panel, Ledger (lazy, grouped by month/day), Expanded Row, Delete Confirm | `docs/design/diagrams/ebd-sequences/manage-finances-browse-transactions.html` |
| Month Overview | Period Bar, Currency Switch, Balance Rail, Budget Rail, Goal Rail | `docs/design/diagrams/ebd-sequences/manage-finances-month-overview.html` |

**Utilities:** ValidationUtility, AlertUtility, ThemeUtility, I18nUtility, FormattingUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/manage-finances.html`.

### Track Investments

**Purpose:** Follow and maintain investments. New Experience (Q2). Portfolio Builders stay disabled (v2).

| Flow | Interactions | Sequence |
|---|---|---|
| Portfolio Overview | Net Worth Cards, Payout This Month, Payout Holding Selector, Payout Chart, Allocation Cards, Coming Due | `docs/design/diagrams/ebd-sequences/track-investments-portfolio-overview.html` |
| Holding Maintenance | Account Picker, Holdings Table, Goal Allocation Editor, Market Value Entry, Value History Editor | `docs/design/diagrams/ebd-sequences/track-investments-holding-maintenance.html` |
| Rates Maintenance | Rate Card, Rate Update Entry, Rate History Editor | `docs/design/diagrams/ebd-sequences/track-investments-rates-maintenance.html` |
| *(standalone)* | Archive Matured Holding | — |

**Utilities:** ValidationUtility, AlertUtility, ThemeUtility, I18nUtility, FormattingUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/track-investments.html`.

### Review Insights

**Purpose:** See the state of things. v1 Dashboard is fixed (widgets v3); Reporting v2. Notification Inbox is hosted by the App Shell's bell. Audit log browsing removed — FR-7.2 is export only.

| Flow | Interactions | Sequence |
|---|---|---|
| Dashboard | Net Worth Cards, Coming Due, Payout Holding Selector, Payout Chart, Balance / Budget / Goal Rails | `docs/design/diagrams/ebd-sequences/review-insights-dashboard.html` |
| *(standalone)* | Export Audit Log, Notification Inbox | — |

**Utilities:** AlertUtility, ThemeUtility, I18nUtility, FormattingUtility. Tier diagram: `docs/design/diagrams/ebd-tiers/review-insights.html`.


## Utilities

| Utility | Role |
|---|---|
| `ValidationUtility` | Field rules shared by every form (email, password ≥ 12, money, dates) |
| `PasswordStrengthUtility` | Strength meter for register / reset / change password |
| `AlertUtility` | Toasts and inline banners |
| `ThemeUtility` | Design tokens, dark / light / system, category palette tokens (OQ-85, NFR-UX-2) |
| `I18nUtility` | Shared ICU catalog — renders notifications by type and errors by code (NFR-I18N-3) |
| `FormattingUtility` | Intl formatting — money in minor units, rates × 10,000, whole percent, dates (NFR-I18N-2) |

## Communication rules (unchanged principles, applied to the new shape)

- State flows down (Experience → Flow → Interaction); results flow up as
  events. Only Experiences call the backend.
- No Flow talks to a sibling: after Record Transaction completes, the
  **Experience** refreshes Browse Transactions and Month Overview; "edit"
  from a ledger row is a request to the Experience, which opens Record
  Transaction pre-filled; "See in Transactions" from a holding is a
  request routed to Manage Finances with a `holdingId` filter.
- A composed Flow's backend calls go through whichever Experience hosts it
  (Guided Setup → Onboard).
- Purely client-side state stays in the Flow (the goal exchange-rate
  calculator, the $/R$ switch, payout top-5 grouping).

## Configuration points

Onboard's step list and skip rules (Registration/MFA skipped when signed
in; account step not skippable); the shell's notification routing table;
the MFA method list; transaction kind groups; the category palette and
icon set; report types; the payout chart's top-N.

## Validation against core journeys

- *Record a Pix payment, see the budget move* — only Record Transaction
  and the Experience are touched; Month Overview is refreshed by the
  Experience.
- *Accept an invitation from the bell* — the inbox emits; the shell
  routes; Manage Profile calls the backend.
- *New notification string* — catalog only (NFR-I18N-3).
- *Second household* — Onboard runs with Registration/MFA skipped by
  configuration; no new Flow.

---

# Superseded: original decomposition (pre-October 2026)

Kept for history. It describes the original six Experiences and 15
Flows; the October 2026 version above replaces it.


Experience-Based Decomposition of the New Finance App frontend. Started
after the backend's Round 7 VBD decomposition and full call-chain
validation pass (see `docs/architecture/backend/01-vbd-decomposition.md`
and `docs/architecture/00-core-process-patterns.md`) were both complete —
this document picks up `ebd-decompose`'s Design mode at Step 1.

**Starting point, deliberately not from scratch:** rather than re-deriving
core user journeys, this decomposition maps the 45 already-isolated
backend use cases (`docs/requirements/01-core-use-cases.md`,
`docs/design/diagrams/use-cases/`) onto EBD's Experience/Flow/Interaction/Utility
tiers. The explicit discipline applied: **Experience boundaries follow
user *purpose*, not backend Manager boundaries** — VBD's Managers are
grouped by *trigger pattern* (why/when something fires), which is a
different axis from *what the user is trying to accomplish*. Mirroring
the four Managers onto four Experiences 1:1 would be a mistake — the same
"functional decomposition wearing the framework's vocabulary" error VBD
caught and corrected on the backend side (Round 1's Manager sprawl).

## Step 1: Core Experiences — confirmed (revised — 6, not 5)

Identified by asking "what is the user actually trying to accomplish" for
each cluster of use cases, not by which CUC area or Manager they trace
to. The original pass found 5; a second look (prompted by the user
noticing "Manage Finances" was hiding a real split) found that Experience
was actually two:

| Experience | Purpose | Backend use cases it draws from |
|---|---|---|
| **Authenticate** | Prove and maintain identity — the entry gate, temporally distinct from everything else (happens *before* any in-app journey, not a task done *within* the app) | Login, Logout, Reset/Change Password, MFA Recovery, View/Revoke Sessions (Identity & Household set, UC-14–17, 19–20) |
| **Onboard** | First-time setup. Genuinely has accumulated *progression* state ("have I done step N yet") — a real Experience shape, not a grouping of convenience. Composes Account Setup's own Flows for its early steps rather than duplicating them (see note below) | Register + MFA enrollment (UC-11), Create Household (UC-1) |
| **Manage Household** | Ongoing administration of who's in the household and my own account — recurring maintenance, distinct from Onboard's one-time setup | Invite/Accept/Decline/Revoke (UC-3–6), Remove/Leave (UC-7–8), Change role (UC-9), Transfer ownership (UC-10), Edit profile (UC-13), Delete account (UC-12), Delete household (UC-2) |
| **Account Setup** *(new, split out)* | Configure the containers and rules everything else runs on — occasional, not day-to-day | Create/Edit/Archive Financial Accounts + Credit Cards (Financial Accounts, all 3), Categories (FR-10), Create/Edit/Delete Budgets (all 3), Add/Edit/Archive Investment Holdings (Track Investments UC-1–3), Create/Edit/Archive/Unarchive/Delete Objectives (all 5) |
| **Manage Finances** *(narrowed)* | Day-to-day cash-flow recording — high frequency, distinct cadence from Account Setup | Record/Edit/Delete Transaction, Account + Card (Record Transactions, all 3) |
| **Review Insights** | Look at current/past state; changes nothing | Dashboard (UC-1–2), Reports (UC-3), Export CSV (UC-4), Notifications (UC-5–6), Audit Log export (Audit set, UC-1) |

**Why the split, precisely:** the use cases originally bundled into
"Manage Finances" split into two different cadences — *occasional
configuration* (accounts, cards, categories, budgets, objectives,
holdings) versus *high-frequency recording* (transactions). The user's
own framing was the tell: "he needs to setup things first" describes a
**prerequisite relationship**, not one continuous purpose at two speeds —
Account Setup has to exist before Manage Finances' day-to-day recording
is meaningful.

**This sharpens, not undoes, the earlier Objective-progress insight:**
Objective *setup* (create it, adjust its target, archive it) is now an
occasional Account Setup action. Objective *progress-viewing* — the
emotional payoff — still belongs inline in Manage Finances, right where
the funding transaction gets recorded. Setup and payoff are different
moments for the user; they now correctly land in different Experiences.
The Objectives Flow's write operations go through `AccountManager`
(Account Setup Experience); its progress *display*, read inline from
Manage Finances, is `InsightsManager`/`ReportingEngine` — same
one-Flow-two-backend-Managers shape as before, just attached to the
right Experience on each side now.

**Worth naming honestly:** this split lands close to the backend's own
`AccountManager` (setup/containers) vs. `TransactionManager` (cash-flow)
boundary — a *different* grouping axis (trigger pattern, not user
purpose). Not a smell: two independent analyses converging on the same
line is a *stronger* signal the boundary is real, not evidence of
backend-mirroring. It would only be a mistake if the boundary had been
copied from VBD without re-deriving it from user intent, which isn't
what happened here.

**Open follow-up, not yet resolved:** Onboard should compose the same
underlying Create-Account/Add-Holding Flows that Account Setup defines,
for its early wizard steps, rather than owning parallel duplicate logic —
same principle as two backend Managers both calling the same Resource
Accessor (normal, not a violation). This needs to be made concrete once
Account Setup's own Flows are actually defined (Step 2/3, not done yet).

## Step 2/3, rough pass — done for all 6 Experiences

A rough Flow-level pass (not full detail) across all six, to get a
high-level shape before drilling into any one. Judgment calls made along
the way are marked confirmed.

**Authenticate:** superseded by the full Step 2/3 detail below — see
"Authenticate — full detail."

**Onboard:** superseded by the full Step 2/3 detail below — see
"Onboard — full detail."

**Manage Household:** superseded by the full Step 2/3 detail below — see
"Manage Household — full detail."

**Account Setup:** superseded by the full Step 2/3 detail below — see
"Account Setup — full detail."

**Manage Finances:** superseded by the full Step 2/3 detail below — see
"Manage Finances — full detail."

**Review Insights:** superseded by the full Step 2/3 detail below — see
"Review Insights — full detail."

### Gap found and closed: Category management

This rough pass surfaced a real gap, not a frontend-only one: Category
management (FR-10) never got its own use case on the backend side either
— `CategoryAccessor` existed in the Round 7 component list, but no
Create/Edit/Archive Category use case was ever isolated or call-chain
validated. **Closed:** 3 use cases added (Create Category, Edit Category
incl. Subcategories, Archive Category/Subcategory), matching Financial
Accounts' exact shape — see `docs/design/diagrams/use-cases/categories/` and
`docs/design/diagrams/call-chains/categories/`. Closing this also surfaced a second,
independent finding: creating a Household needs to seed default
Categories (FR-10.1), which is `AccountManager`'s job, not
`IdentityManager`'s (who creates the Household) — the fix is the VBD
decomposition's first real Manager↔Manager pub/sub example (see
`docs/architecture/backend/01-vbd-decomposition.md` §3.1b). Account
Setup's Category Management Flow can now be designed for real against
validated backend use cases, same as every other Flow in this document.

## Authenticate — full detail (Step 2/3)

The first Experience taken to full depth, per the plan above.

### Step 2: Volatility axes

- **Functional:** MFA method set expanding (TOTP → WebAuthn/passkeys,
  SMS) — the evidenced backend volatility (`AuthenticationUtility`,
  NFR-SEC-1's "at minimum") has a direct frontend echo: which
  challenge-entry UI to render must be data-driven, not hardcoded to
  TOTP.
- **Non-functional:** none significant found — no conditional/
  audience-specific routing through this journey today (no SSO, no
  "remember this device" skip-MFA policy currently in scope).
- **Cross-cutting:** locale (all copy, pt-BR/en-US per NFR-I18N-1),
  validation conventions (email format, password rules), and
  error-message formatting need to be *consistent* across every Flow in
  this Experience.
- **Environmental:** the backend API shape — already fully known; this
  is exactly what the Login/Logout/Reset/Change-Password/Sessions
  call-chain diagrams already pinned down. Directly inherits OQ-30's
  confirmed JWT/OAuth2 mechanism.

### Step 3: Tiers

**Correction from the rough pass:** Sign Out is not its own Flow. It has
no accumulated state and one atomic action — exactly EBD's own test for
"this is an Interaction, not a Flow" (Flow Proliferation is the named
smell for getting this wrong). It's a standalone Interaction the
Experience hosts directly, not nested in any Flow.

**Authenticate Experience** owns: current auth state (unauthenticated →
authenticated), which Flow is active. Only tier that calls the backend.

- **Sign In Flow** — state: entered credentials, current step (credential
  entry vs. challenge), which challenge method is active. Exit: session
  established.
  - *Credential Entry Interaction* — email + password, submit
  - *MFA Code Entry Interaction* — 6-digit code, submit; carries a "use
    backup code instead" affordance that emits an event up to the Flow
    rather than branching internally
  - *Backup Code Entry Interaction* — sibling to the above, Flow decides
    which to render
- **Account Recovery Flow** — state: email entered, reset token (from
  URL), new password. Real multi-step progression, unlike Sign Out.
  - *Recovery Request Interaction* — enter email, submit
  - *New Password Entry Interaction* — new + confirm password, submit
- **Security Maintenance Flow** — state: which sub-view active, fetched
  sessions list.
  - *Password Change Interaction* — current + new password, submit
  - *Session Management Interaction* — view sessions list + revoke a
    specific one (merged into one — selecting a row to revoke isn't a
    meaningfully separate atomic action from viewing the list)
- **Sign Out** — standalone Interaction, hosted directly by the
  Experience, no Flow wrapper.

**Utilities** (cross-cutting, shared beyond this Experience too):
Validation (email/password format — also used by Onboard's Registration
Flow), Password Strength Indicator (shared with Onboard and Security
Maintenance), Alert/Toast, Locale.

**Step 5 (configuration point):** which MFA methods are offered, and
whether backup-code recovery is available at all, should be
config/reference-data the MFA Code Entry Interaction reads — not
hardcoded — mirroring `AuthenticationUtility`'s own backend shape.

**Step 6 (diagrams):** tier diagram —
`docs/design/diagrams/ebd-tiers/authenticate.html`; sequence diagram for Sign In Flow
(the richest, including the MFA-code-vs-backup-code branch) —
`docs/design/diagrams/ebd-sequences/authenticate-sign-in.html`.

## Onboard — full detail (Step 2/3)

Second Experience taken to full depth.

### Step 2: Volatility axes

- **Functional:** MFA method set expanding — same evidenced axis as
  Authenticate (`AuthenticationUtility`, NFR-SEC-1's "at minimum").
  Enrollment happens here first, so the method-setup UI needs the same
  data-driven method list as Sign In's challenge-entry UI. No other
  functional volatility is evidenced for this Experience — "which wizard
  steps are mandatory" is a design decision, not a volatility entry;
  nothing in the requirements docs signals that area as one of expected
  change.
- **Non-functional:** none evidenced.
- **Cross-cutting:** locale, validation conventions (email/password
  format — shared with Authenticate), password strength (shared with
  Authenticate).
- **Environmental:** backend API shape for Register (UC-11), MFA
  enrollment, and Create Household (UC-1) — already pinned down by their
  call-chain diagrams.

### Step 3: Tiers

**Onboard Experience** owns: onboarding progression state (which step
reached, so a drop-off can resume), and hands off to whichever Experience
owns "home" (Review Insights' Dashboard) once setup is complete or
skipped. Only tier that calls the backend.

- **Registration Flow** — state: form fields, validation errors,
  submission status. Exit: account created.
  - *Registration Form Entry Interaction* — name/email/password/confirm,
    submit.
- **MFA Enrollment Flow** — mandatory, no skip (UC-11 bundles this with
  registration on the backend, implying it isn't optional). State:
  selected method, secret/QR data, entered verification code, generated
  backup codes, acknowledgement flag.
  - *MFA Method Selection Interaction*
  - *MFA Setup Verification Interaction* (confirm the method with a live
    code)
  - *Backup Codes Acknowledgement Interaction* (view + confirm saved)
- **Household Setup Flow** — state: household name, submission status.
  Exit: household created (category-seeding happens server-side via the
  pub/sub path, §3.1b of the backend doc — transparent here).
  - *Household Name Entry Interaction*
- **Guided First Setup Flow** — state: current wizard step, per-step skip
  flags. Owns only wizard navigation directly; the actual data-entry
  steps are composed from Account Setup's own Flows rather than
  duplicated.
  - *Wizard Navigation Interaction* (Next / Back / Skip-this-step /
    Skip-all) — the only Interaction this Flow owns
  - Composes: Account Setup's **Account & Card Management Flow** (add
    first bank account), **Budget Management Flow** (set a first
    budget), and **Objective Management Flow** (set a first goal) — all
    three, individually skippable
  - **Holding Management Flow deliberately excluded** (confirmed):
    building out an investment portfolio can take a while and shouldn't
    block someone from starting to use the system day one, unlike Budget
    and Objective setup, which don't need any history to be meaningful —
    both can be set up fresh and tracked against from that point
    forward. Holding backfill remains reachable later directly from
    Account Setup.

**Validation check (not a gap):** confirmed Onboard doesn't need a
"join an existing household via invitation" path — the resolved
invitation-existing-user-only rule means invitations only ever target
users who already have an account, so a brand-new user's only path is
register → create their own household. Onboard's scope is complete as-is.

**Utilities:** ValidationUtility, PasswordStrengthUtility (both shared
with Authenticate), AlertUtility, LocaleUtility.

**Diagram convention (new, confirmed):** Guided First Setup Flow's
tier-diagram column shows the three composed Account Setup Flows as
dashed cross-Experience reference boxes rather than duplicating them —
same idea as Authenticate's dashed "no Flow" box for Sign Out, but for
cross-Experience reuse instead of a missing tier. These names anticipate
Account Setup's own full Step 2/3 detail (not done yet) — once Account
Setup gets its own tier diagram, check these three names/shapes against
it for a match.

**Step 6 (diagrams):** tier diagram — `docs/design/diagrams/ebd-tiers/onboard.html`;
sequence diagram for Guided First Setup Flow (the richest — it's the one
showing the composition-with-another-Experience's-Flow mechanic) —
`docs/design/diagrams/ebd-sequences/onboard-guided-setup.html`.

## Account Setup — full detail (Step 2/3)

Third Experience taken to full depth.

### Step 2: Volatility axes

- **Functional:** two evidenced volatilities from the core
  process-patterns list land in this Experience's domain: **Credit Card
  network** (Account & Card Management — network selection must be
  data-driven, not hardcoded to Visa/Mastercard) and **Instrument Type**
  (Holding Management — type-specific fields driven by reference data,
  mirroring the backend's `InvestmentProductEngine` handling type rules
  generically). No other evidenced functional volatility touches this
  Experience.
- **Non-functional:** none evidenced.
- **Cross-cutting:** locale (currency/amount/date formatting across every
  Flow here), validation conventions (numeric/amount format, date
  format).
- **Environmental:** backend API shape for all five domains — Financial
  Accounts (3 use cases), Categories (3), Budgets (3), Holdings (4),
  Objectives (5) — already pinned down by their call-chain diagrams.

### Step 3: Tiers

**Account Setup Experience** owns: which sub-area is active (a tab-level
nav state across Accounts, Categories, Budgets, Holdings, Objectives),
and shared read-only cross-Flow data — the Category list (written by
Category Management, read by Budget Management to associate a budget
with a category) and the Objective list (written by Objective
Management, read by Holding Management for allocation; OQ-48's
"Holding owns allocation" direction of control still holds — Objective
Management never writes allocation, only reads it back). Only tier that
calls the backend.

All five Flows reduce to the same shape — Create / Edit / Lifecycle
Transition, the same patterns the backend itself was built on:

1. **Account & Card Management Flow**
   - *Account Selection Interaction* (list, pick one or start create —
     same merge logic as Authenticate's Session Management: selecting a
     row isn't a separate atomic action from viewing the list)
   - *Create Account Interaction*
   - *Edit Account Interaction* (includes Credit Card fields — OQ-35
     fold-in, carried forward from the backend decision)
   - *Archive Account Interaction* (one-way, OQ-34)
2. **Category Management Flow**
   - *Category Selection Interaction* (tree view)
   - *Create Category Interaction*
   - *Edit Category Interaction* (includes Subcategory add/edit fold-in)
   - *Archive Category Interaction* (one-way)
3. **Budget Management Flow**
   - *Budget Selection Interaction*
   - *Create Budget Interaction*
   - *Edit Budget Interaction*
   - *Delete Budget Interaction* (hard delete only, OQ-40 — no archive
     exists for Budget)
4. **Holding Management Flow**
   - *Holding Selection Interaction*
   - *Add Holding (Backfill) Interaction*
   - *Edit Holding Interaction* (valuation/schedule edits, plus
     allocation-to-Objective editing — OQ-48 fold-in)
   - *Archive Holding Interaction* (one-way)
5. **Objective Management Flow**
   - *Objective Selection Interaction*
   - *Create Objective Interaction*
   - *Edit Objective Interaction*
   - *Objective Status Transition Interaction* (confirmed) — one
     Interaction handling Archive/Unarchive/Delete together, surfacing
     whichever action the current status allows, rather than three
     separate Interactions. Objective is the only entity here with two
     lifecycle directions (reversible archive + hard delete, OQ-47), so
     this mirrors the backend's Lifecycle Transition pattern directly
     (one generic operation, different target statuses) instead of
     hardcoding three UI actions.

**Configuration points (Step 5):** Credit Card network list and
Instrument Type list should both be config/reference data the relevant
Interaction reads, not hardcoded — same "kind is reference data"
discipline as the backend.

**Utilities:** ValidationUtility, LocaleUtility (both shared with
Authenticate/Onboard).

**Worth naming honestly:** all five Flows reducing to the same
Create/Edit/Lifecycle-Transition shape is a strong validation of the
process-pattern discovery holding up on the frontend side too — not a
reason to build a shared abstraction between them, since nothing
evidences that need yet.

**Step 6 (diagrams):** tier diagram —
`docs/design/diagrams/ebd-tiers/account-setup.html`. Sequence diagram(s) deliberately
deferred — see the sequencing decision in "Not yet done" below.

## Manage Household — full detail (Step 2/3)

Fourth Experience taken to full depth. This one surfaced more Flow-vs-
Interaction corrections than any prior Experience — several of its
rough-pass "Flows" turned out to be single atomic actions once checked
against the same litmus test that demoted Authenticate's Sign Out.

### Step 2: Volatility axes

- **Functional:** **Role set** is an evidenced volatility (already
  tagged in the requirements docs) — the role list used by Invite Member
  and Change Role must be data-driven, not hardcoded to Owner/Admin/
  Member.
- **Non-functional:** none evidenced. GDPR hard-delete is a fixed
  requirement, not a tracked alternative — not volatility.
- **Cross-cutting:** locale, validation (email format for invites),
  AlertUtility (confirmation dialogs — this Experience is the heaviest
  user of it so far, given how many destructive actions live here).
- **Environmental:** backend API shape for all the Identity & Household
  use cases involved — already pinned down by their call-chain diagrams.

### Step 3: Tiers

**Manage Household Experience** owns: the active household's member
list, pending invitations, and the user's own profile data. No real
"exit condition" — this is an ongoing home base, not a wizard — except
Leave/Delete Household/Delete Account, which hand off elsewhere. Only
tier that calls the backend.

**Corrections from the rough pass** (same litmus test as Sign Out —
single atomic action, no accumulated state → Interaction, not Flow):

- **Invitation Response — demoted to a standalone Interaction.** Accept/
  decline is one atomic action on one screen; no multi-step progression
  to justify a Flow.
- **Leave Household — demoted to a standalone Interaction.** A confirm
  dialog whose message varies by role (Owner sees who gets auto-promoted)
  — conditional rendering on already-known context, not accumulated
  state.
- **Profile & Account Flow — split in two,** for the same reason
  Household Deletion was originally split from Membership Management
  (high-stakes/rare deserves its own Flow):
  - **Edit Profile** — demoted to a standalone Interaction (simple form,
    atomic).
  - **Delete Account Flow** — promoted to its own Flow. Real accumulated
    state: check for households you own (must transfer ownership first),
    review what gets hard-deleted (GDPR), then type-to-confirm — the same
    multi-step shape Household Deletion already has.

Three real Flows remain, plus three standalone Interactions:

1. **Membership Management Flow** — Owner/Admin acting on others.
   - *Member Selection Interaction* (unified list: active members +
     pending invites, pick a row)
   - *Invite Member Interaction* (email + role, send)
   - *Remove/Revoke Interaction* (confirmed) — one Interaction handling
     both "remove an active member" and "revoke a pending invite,"
     dispatching to the right backend target based on the selected row's
     type. Same merge logic as Account Setup's Objective Status
     Transition — different backend entity, same UI gesture.
   - *Change Role Interaction* (active Memberships only)
   - *Transfer Ownership Interaction* (pick new Owner from current
     Admins, confirm — auto-demotes current Owner). Kept as one
     Interaction, not its own Flow — less destructive than deletion (no
     data loss), so it doesn't clear the same bar.
2. **Delete Account Flow**
   - *Ownership Check Interaction* (surfaces any households you must
     transfer first, blocks progress until resolved)
   - *Review Consequences Interaction*
   - *Confirm Deletion Interaction* (type-to-confirm)
3. **Household Deletion Flow** (confirmed separate, per the original
   rough pass) — now decomposed:
   - *Review Consequences Interaction*
   - *Confirm Deletion Interaction* (type-to-confirm)

**Standalone Interactions** (hosted directly by the Experience, no Flow
wrapper): *Invitation Response*, *Leave Household*, *Edit Profile*.

**Configuration point (Step 5):** the Role list (Invite Member, Change
Role) should be config/reference data, not hardcoded.

**Utilities:** ValidationUtility, AlertUtility, LocaleUtility.

**Step 6 (diagrams):** tier diagram —
`docs/design/diagrams/ebd-tiers/manage-household.html`. Sequence diagram(s)
deliberately deferred — see the sequencing decision below.

## Manage Finances — full detail (Step 2/3)

Fifth Experience taken to full depth. Smaller than Manage Household (2
Flows instead of 5-6), but where the unified-entry-point decision (OQ-39)
and the earlier Objective-progress insight from Step 1 actually get built
out.

### Step 2: Volatility axes

- **Functional:** **Transaction Kind** is the evidenced volatility here
  (same "kind is reference data" pattern already applied to Category/
  Instrument Type/Role/etc.) — exactly why OQ-39 chose one unified entry
  point instead of per-kind flows: the field set must be data-driven off
  the selected Kind, not hardcoded branching.
- **Non-functional:** none evidenced.
- **Cross-cutting:** locale (currency/amount/date formatting — heavier
  here than anywhere else, since every transaction has all three),
  validation (amount/date format).
- **Environmental:** backend API shape for Record/Edit/Delete Transaction
  — already pinned down by their call-chain diagrams, including the
  investment-buy sub-case (confirmed as legitimately complex, the widest
  fan-out in the whole architecture — `TransactionManager` +
  `InvestmentProductEngine`).

### Step 3: Tiers

**Manage Finances Experience** owns: which sub-view is active (Record
vs. Correct). It independently reads (not owns) reference data written
elsewhere — Account list, Category list, Objective list, all owned by
Account Setup — the same "shared data via the Experience, not sideways
coordination" pattern already established for Budget Management reading
Categories.

- **Record Transaction Flow** — state: selected Kind, entered fields,
  submission status.
  - *Transaction Kind Selection Interaction* — drives which entry
    Interaction renders next
  - *Transaction Entry Interaction* — general case (expense/income/
    transfer/credit-card charge); amount, date, category, account/card,
    notes
  - *Investment Trade Entry Interaction* (confirmed) — sibling to the
    above rather than a variant of it, chosen by Kind Selection exactly
    the way Authenticate's Sign In Flow chose between MFA Code Entry and
    Backup Code Entry. Justified by the same backend evidence that made
    investment-buy the widest fan-out chain — genuinely different fields
    (instrument, quantity, price, fees), not a minor variation. A buy
    here creates/adds-to a Holding as a side effect (via
    `TransactionManager`+`InvestmentProductEngine`) — the "buy new
    holdings stays in Manage Finances" boundary from Step 1, now
    concrete.
  - *Objective Progress Feedback Interaction* — read-only, shown inline
    right after a funding transaction is recorded. The Step 1 "one Flow,
    two backend Managers" insight made concrete: `TransactionManager`
    records the transaction, but this Interaction's data comes from
    `InsightsManager`/`ReportingEngine`.
- **Transaction Correction Flow** — state: search/filter criteria, the
  selected transaction. Real accumulated state (found item persists into
  the edit/delete action), clearing the Flow bar the same way Membership
  Management did.
  - *Transaction Search/Selection Interaction* (find + pick one)
  - **Reuses** Record Transaction Flow's *Transaction Entry* /
    *Investment Trade Entry* Interactions, pre-filled (confirmed) — two
    sibling Flows in the same Experience sharing a child Interaction, not
    Flow-to-Flow coordination (which stays prohibited) — the same
    relationship as two Managers calling the same Accessor.
  - *Delete Transaction Interaction* — plain one-way confirm, no
    multi-step review. Unlike Household/Account deletion, this is
    routine and frequent, not rare/high-stakes — same shape as Budget's
    single-direction delete, not Objective's Status Transition.

**Configuration point (Step 5):** the Transaction Kind list should be
config/reference data, read by Transaction Kind Selection.

**Utilities:** ValidationUtility, LocaleUtility.

**Step 6 (diagrams):** tier diagram —
`docs/design/diagrams/ebd-tiers/manage-finances.html`. Sequence diagram(s)
deliberately deferred — see the sequencing decision below.

## Review Insights — full detail (Step 2/3)

Sixth and last Experience taken to full depth.

### Step 2: Volatility axes

- **Functional:** **Widget Type** is the evidenced volatility here (same
  "kind is reference data" list Transaction Kind/Category/Instrument
  Type/Role/Credit Card Network/Locale belong to) — which widgets are
  available on the Dashboard must be data-driven, not hardcoded.
- **Non-functional:** none evidenced. Audit Log's Owner/Admin-only gating
  is a fixed authorization rule, not a tracked alternative — not
  volatility.
- **Cross-cutting:** locale (currency/date formatting across dashboard,
  reports, audit log), validation (date-range filter format).
- **Environmental:** backend API shape for Dashboard (UC-1–2), Reports
  (UC-3), Export CSV (UC-4), Notifications (UC-5–6), Audit Log export —
  already pinned down by their call-chain diagrams, including the
  confirmed finding that Export Transactions CSV and Export Audit Log
  take *different* backend paths (one through `ReportingEngine`, one
  not) for a real reason.

### Step 3: Tiers

**Review Insights Experience** owns: which sub-view is active (Dashboard/
Reports/Notifications/Audit Log). Reads (not owns) reference data from
elsewhere as needed (Account/Category/Objective lists, for building
charts and reports) — same cross-Experience read pattern as Manage
Finances. No exit condition — an ongoing home base, like Manage
Household. Only tier that calls the backend.

- **Dashboard Flow** (confirmed as one — view + customize together)
  - *Widget Arrangement Interaction* (drag/drop/resize/reorder)
  - *Widget Selection Interaction* (add/remove which widgets show, from
    the Widget Type reference list)
- **Reporting Flow** (view a report + export it — same goal, different
  output)
  - *Report Selection Interaction* (choose report type + filter
    criteria)
  - *Export Report Interaction* (routes through `ReportingEngine`, per
    its call-chain diagram)
- **Audit Log Flow** (Owner/Admin only) — clears the Flow bar with two
  real distinct actions.
  - *Audit Log Selection Interaction* (browse + filter entries)
  - *Export Audit Log Interaction* — **kept separate from Export Report,
    deliberately not reused** (confirmed): superficially the same
    "export button," but the two hit different backend paths, different
    permissions, different data shapes. Not the same test as Manage
    Finances' Transaction Entry reuse (which *was* the same operation
    underneath) — surface similarity isn't enough on its own.

**Standalone Interaction** (demoted from the rough pass's "Notification
Inbox Flow," confirmed): *Notification Inbox Interaction* — browsing the
list and dismissing an item is one atomic gesture (same merge logic as
Manage Household's Session Management-style view+revoke), with no second
distinct action to clear the Flow bar the way Dashboard's arrange+select
pair does. Hosted directly by the Experience.

**Configuration point (Step 5):** the Widget Type list should be config/
reference data, read by Widget Selection.

**Utilities:** ValidationUtility, LocaleUtility.

**Capstone validation:** every Flow/Interaction in this Experience is the
View pattern, with Export as its specialization exactly as originally
discovered in `docs/architecture/00-core-process-patterns.md` — nothing
here needed a Create, Edit, or Lifecycle Transition shape (Dashboard's
arrangement is light editing of *layout*, not of domain data). Fitting,
as the last Experience, that it confirms the pattern discovery holds end
to end — all six Experiences, all four backend patterns echoed on the
frontend side, no exceptions found.

**Step 6 (diagrams):** tier diagram —
`docs/design/diagrams/ebd-tiers/review-insights.html`. Sequence diagram(s)
deliberately deferred — see the sequencing decision below.

## Sequence-diagram sweep: done, all 15 Flows

Every Flow across all 6 Experiences now has a sequence diagram
(`docs/design/diagrams/ebd-sequences/`) — the frontend counterpart to the backend's
architecture validation pass over all 48 use cases. Generated via a
Python template script (same technique used for the backend's call-chain
batch), then spot-checked in the browser: the most structurally complex
one (Account Setup's Objective Management, with nested `alt` blocks for
the Status Transition branch) and two others covering distinct mechanics
(Manage Finances' Record Transaction, with its `opt` block for Objective
Progress Feedback; Transaction Correction, with its cross-Flow reused-
Interaction participant). All three rendered correctly, and since every
file shares the identical proven template, the rest are trusted the same
way the bulk of the call-chain batch was.

Full list (15 total): `authenticate-sign-in.html`,
`onboard-guided-setup.html`,
`account-setup-account-card-management.html`,
`account-setup-category-management.html`,
`account-setup-budget-management.html`,
`account-setup-holding-management.html`,
`account-setup-objective-management.html`,
`manage-household-membership-management.html`,
`manage-household-delete-account.html`,
`manage-household-household-deletion.html`,
`manage-finances-record-transaction.html`,
`manage-finances-transaction-correction.html`,
`review-insights-dashboard.html`, `review-insights-reporting.html`,
`review-insights-audit-log.html`. (Notification Inbox has none — it's a
standalone Interaction, not a Flow.)

**Nothing new was designed in this sweep** — every diagram traces
Interactions/state already fixed during Step 2/3, and no gaps or
corrections surfaced (unlike the Category gap the rough Flow pass found
earlier). This closes out Step 6 of `ebd-decompose` for the whole
frontend.

## Not yet done — resume here

- **Steps 1–3 and 6: done for the whole frontend** (all 6 Experiences,
  full volatility/tier/Interaction detail, tier diagrams, and now every
  Flow's sequence diagram).
- Steps 4/7/8 (communication rules beyond what's noted per-Experience,
  validation against core journeys, file save confirmation) haven't
  started as separate formal passes — though communication rules and
  validation have largely been demonstrated inline throughout (e.g. every
  sequence diagram enforces state-down/events-up, and the capstone
  validation confirmed the process patterns hold end to end).
- **Next major step:** per the project's Planned Design Sequence
  (`README.md`), Data model / ERD.
- The wireframing tool (superdesign.dev) was explicitly deferred until
  after this structural decomposition — it can now be considered, since
  the structural pass (Steps 1–3, 6) is complete.
