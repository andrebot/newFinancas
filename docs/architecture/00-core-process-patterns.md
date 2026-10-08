# Core Process Patterns

This document supersedes the *10 core use cases* (`docs/requirements/01-core-use-cases.md`)
as the primary input to backend/frontend decomposition. The CUCs remain
valid as domain scoping — they tell you *what data the system manages* —
but they are not, it turns out, where the real volatility axis for
*workflow shape* lives. This document is where that lives.

## Method

Every CUC (except CUC-7, deferred, and the Open Banking trio within
CUC-3/CUC-4, also deferred) was broken into granular use cases and each
one drawn as a two-lane (Frontend/Backend) high-level activity diagram —
45 diagrams total, under `docs/design/diagrams/use-cases/`. Rather than treat each as
a bespoke flow, we compared their shapes directly against each other,
across CUC boundaries, looking for recurring skeletons. Four emerged.
Two more shapes looked like candidates but turned out not to be new
shapes at all — see "Valid, but not core" below.

## The four core domain process patterns

### 1. Create

**Shape:** open page → fill form → submit → validate → check invariants →
persist (new identity) → apply initial effects/cascades → log → respond →
notify.

**Distinguishing trait:** there is no prior state to reconcile against —
the entity doesn't exist yet. The backend's only job is deciding what the
*initial* state and its *initial* side effects are.

**Instances:** Create Household, Invite User to Household (creates a
pending Invitation), Create User (2-round-trip: user + MFA enrollment),
Create Financial Account (+ optional inline Credit Card), Record
Transaction (richest instance — auto-creates a Holding, computes a
product schedule, updates budget accrual, may create a notification, all
as cascades of one Create), Create Budget (+ cascades a Budget Period),
Add Investment Holding (onboarding variant), Create Objective. Also,
underneath Auth (see below): Login and MFA Recovery are both
`Create(Session)`.

### 2. Edit

**Shape:** open page → select existing item → edit fields (sometimes
absorbing a related child entity's own CRUD into the same form) → submit
→ validate → reconcile against prior state (may reverse a previous
effect before applying the new one) → check invariants → persist → log →
respond → notify.

**Distinguishing trait:** prior state exists and must be diffed against —
this is what makes Edit structurally heavier than Create in places like
Edit Transaction (reverse the old effect, apply the new one) even though
the surface form looks similar.

**Instances:** Edit User, Edit Financial Account (+ Credit Card
attach/edit/remove folded in, OQ-35), Edit Transaction, Edit Budget, Edit
Investment Holding (+ maturity/schedule edits, + Objective-allocation
management folded in, OQ-48), Edit Dashboard Layout (+ Widget add/
remove/reorder/configure folded in), Edit Objective, Change a Member's
Role, Transfer Ownership (an atomic *two*-entity Edit). Also, underneath
Auth: Change Password and Reset Password are both `Edit(User.password)`.

### 3. Lifecycle Transition

**Shape:** select existing item → confirm (or not, if low-stakes) →
submit → transition the entity's status → apply cascades specific to
*that* status target → log → respond → notify.

**This is Delete, Archive, and Unarchive unified.** They are not three
patterns that happen to look similar — they are the *same* generic
operation, `transitionStatus(entity, targetStatus)`, where each entity
type declares which statuses are legal for it and which cascades fire on
each transition:

- **Delete** targets a terminal "gone" status. Cascades: reverse any
  effects the entity was responsible for, release any claims/relations it
  held.
- **Archive** targets a non-terminal "archived" status. Cascades: whatever
  that entity's own dependent state requires (e.g., archiving an Account
  auto-disconnects its Open Banking sync).
- **Unarchive** targets "active" again — the *reverse* transition. Only
  Investment Objective supports this reverse (see OQ-47) — every other
  archivable entity's archive is one-way by choice, not by some
  architectural limitation. The state-machine, not the operation, decides
  which transitions exist for a given entity.

**Distinguishing trait vs. Edit:** no field diff — the "new value" is
implicit (a status, not user-chosen data), which is exactly why the
frontend shape is confirm-only, never a form.

**Instances:** Delete Household, Accept/Decline/Revoke Invitation (all
three are `Lifecycle Transition(Invitation → {accepted, declined,
revoked})` — accepting additionally cascades a `Create(Membership)`),
Remove Member / Leave Household (`Lifecycle Transition(Membership →
removed)`, actor differs), Archive Financial Account, Delete/Archive
Investment Holding, Delete Budget, Delete Account/Card Transaction,
Delete Notification (no confirm — low stakes), Archive/Unarchive/Delete
Objective. Also, underneath Auth: Logout and Revoke Session are both
`Lifecycle Transition(Session → ended)`, and Delete User is
`Lifecycle Transition(User → deleted)` with the richest cascade set in
the whole inventory (per-household Owner succession, FR-1.18; anonymize
shared-data contributions, not delete them, OQ-25).

### 4. View (Export is a specialization, not a fifth pattern)

**Shape:** request → fetch/compute → respond → render. No confirm, no
invariant check, no log entry (nothing happened to log).

**Export** is the same shape with the render target swapped from screen
to a downloadable file, and usually an added role check + date-range
selector on the way in. It was tempting to call it a fifth pattern — it
isn't; the backend computation is identical, only the output shape
differs.

**Instances:** View Active Sessions, View Dashboard, View Report (report
type is a parameter, same "kind is data" principle used throughout the
requirements), View Notification Inbox (carries a trivial embedded
status-transition as a side effect — opening it marks shown notifications
`seen` — without becoming a different top-level pattern), Export
Transactions to CSV, Export Audit Log to CSV.

## Valid use cases, but not core patterns

### System-Trigger

Not a workflow shape — an **alternate entry point** into Create. A
scheduled trigger (Generate Scheduled Investment Cash Event, and once
un-deferred: Open Banking sync, recurring-transaction generation) simply
re-enters the same Create(Transaction) pipeline a manual entry would use,
with no frontend lane at all. Worth documenting (it changes who the actor
is and removes the confirm step) but it doesn't add a fifth pattern.

### Auth

Not a new pattern either, once you separate *which entity* from *what
operation*. Every Auth use case is one of the four patterns above, applied
to universal, non-domain entities (User, Session, credential) instead of
domain entities (Household, Account, Transaction, Budget, Holding,
Objective):

| Auth use case | Pattern |
|---|---|
| Login | Create(Session) |
| MFA Recovery | Create(Session), variant entry |
| Logout | Lifecycle Transition(Session → ended, self) |
| Revoke Session | Lifecycle Transition(Session → ended, other) |
| View Active Sessions | View(Session list) |
| Change Password | Edit(User.password) |
| Reset Password | Edit(User.password), unauthenticated entry |
| Delete User | Lifecycle Transition(User → deleted) |

What makes Auth *feel* different is (a) the entity is one every
application has, not one specific to this domain, and (b) there's an
added security-verification layer on top of the generic operation — not
a different workflow shape underneath. This is "core" in the sense that
every serious application needs it, but not "core to this domain" the way
the CUCs are.

## Volatility reconciliation

Enumerating volatility per pattern (Step 2 of `vbd-decompose`) produced 15
candidate entries, pooled from every CUC note, NFR observation, and the
pattern analysis above. Cycling back over that pool for false positives,
duplicates, and gaps — the discipline being **a volatility must be
evidenced by a real signal (explicit stakeholder language, a named future
phase, an "at least X" hedge, an already-growing list), not by imagining
that an alternative design exists somewhere** — cut it to 7. Rejected
along the way, each for a reason worth remembering:

- **Owner-succession atomicity** — not volatility, an invariant. Fully
  specified, no signal it changes; it just needs correct implementation.
- **Multi-year history performance** — not volatility, an engineering
  quality bar satisfied by correct Accessor/query design, not by
  architectural decoupling.
- **UI/UX visualization** — real and constant, but entirely EBD's job
  (Experience/Flow/Interaction, React components exist specifically to
  absorb this) — not enumerated here unless it has a backend-facing
  implication (Widget Type being data already covers that implication).
- **Lifecycle Transition's per-entity status sets** — this was the
  *process-pattern* finding restated as if it were volatility. Once
  Budget=delete, Account=archive-only, Objective=archive+delete are
  decided, they're well-defined rules, not evidence of ongoing churn.
- **Budgeting model, Categorization/recurring-transaction rules,
  Objective funding source (savings accounts)** — all three were
  "a plausible/natural future extension," speculation with no stakeholder
  signal behind them, the same mistake in three places.
- **Auth mechanism & session policy** (broad framing) — the mechanism
  itself is now a *resolved* decision (JWT/OAuth2, OQ-30), not open
  volatility. Only the evidenced sliver survives, narrowed to MFA method
  extensibility below.

**Landing list — 7, each with a real signal:**

| Volatility | Evidence |
|---|---|
| Kind/Type/Role Extensibility *(meta)* | Explicit "reference data, extendable" language across Transaction Kind, Widget/Report Type, Category, Instrument Type, Credit Card Network, Role, Locale set |
| Holding Valuation Source | FR-5.7's named, confirmed future phase (live market data) |
| Instrument-Specific Product Rules (FR-11) | Directly specified by the stakeholder, confirmed for v1 (OQ-42) |
| MFA Method Extensibility | NFR-SEC-1: "TOTP **at minimum**" |
| Notification Delivery Channel | FR-6.5/OQ-5: stakeholder explicitly named channel expansion |
| Regional Compliance Regime | OQ-4: confirmed dual-region, US-side scope explicitly pending legal review |
| Log/Observability Destination | NFR-OBS-5, already mitigated via Winston Transport |

Open Banking Providers and the External Analysis API (CUC-7) are real,
evidenced volatilities too, but parked off this active list alongside
their deferred CUCs — they return when that work is un-deferred, not
dropped.

## VBD classification applied (Round 7)

Running the 4 patterns and 7 volatilities through Step 3 of
`vbd-decompose` against the existing decomposition
(`docs/architecture/backend/01-vbd-decomposition.md`) landed as follows —
full detail and reasoning lives in that document's Round 7 revision note;
this is the summary:

- **Managers: 4, unchanged.** The process-pattern axis (what kind of
  operation) is orthogonal to the trigger-pattern axis (why/when it
  fires) that already grouped Managers — it explains, rather than
  overturns, why `InsightsManager` was already correct to stand alone
  (Create/Edit/Lifecycle-Transition are owned-entity operations; View is
  inherently cross-entity).
- **Engines: 2, up from 1.** Added `InvestmentProductEngine` (FR-11's
  maturity/interest/tax computation) alongside the existing
  `ReportingEngine`.
- **Resource Accessors: 17 active + 4 parked, down from 21.** Removed
  `CurrencyReferenceRateAccessor` (OQ-49). Split `InvitationAccessor` out
  of `HouseholdAccessor` (its own lifecycle, independent of Membership).
  Extended `InvestmentHoldingAccessor` with FR-11's schedule rather than
  adding a new Accessor. Considered and rejected a `RolePermissionAccessor`
  — Role is developer-versioned reference data like Transaction Kind, not
  household-customizable data like Category, so it stays an in-code table
  `AuthorizationUtility` reads inline. Parked the 4 Open-Banking/external
  Accessors alongside their deferred CUCs.
- **Utilities: 7, down from 9.** Merged `ApplicationLogUtility` +
  `AuditLogUtility` → `LoggingUtility` (same mechanism, parameterized by
  entry kind). Split the old `AccessControlUtility` grouping into
  `AuthenticationUtility` (merged `PasswordHashUtility` + `TOTPUtility` —
  pure identity-proof primitives, volatile because crypto standards
  evolve externally) and `AuthorizationUtility` (renamed from
  `AccessControlUtility` — volatile because *this app's* role/permission
  model evolves, a different driver than crypto standards).

**Not yet done:** the communication-rules table, component diagram, and
sequence diagram in the VBD decomposition doc still reference pre-Round-7
names and have not been reworked against this list — that's the next
conversation.

## Implications for the next steps

- **The VBD backend decomposition** (`docs/architecture/backend/01-vbd-decomposition.md`)
  should be revised through this lens next: a Manager's real job, for most
  of its surface area, is executing one of these four generic operations
  against a specific entity, with entity-specific configuration
  (validations, invariants, cascades) rather than bespoke logic per use
  case. This is the next architecture conversation.
- **The eventual EBD frontend decomposition** should expect the same
  collapse — a generic Create/Edit/Lifecycle-Transition/View Flow
  template, parameterized per entity, rather than one bespoke Flow per
  use case.
- The 45 individual use-case diagrams remain the traceable, concrete
  record (requirements ↔ diagram ↔ pattern) — this document is the
  synthesis layer above them, not a replacement for them.
