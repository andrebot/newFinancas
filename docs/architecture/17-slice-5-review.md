# Slice review — slice 5, November 2026

The gate at the end of slice 5 (insights and notifications: the Delete User
cascade, the Dialog, the Dashboard, the notification inbox, the audit-log
export, the bell's routing and delete account — tasks 136–142), run by the
method in `13-slice-review.md` (OQ-164). Work happens on the `review/slice-5`
branch, cut from `main` after PR #175 (`I13`).
**Status: complete — phase 1 in PR #176, phases 2–3 in phase 3's PR (OQ-247).**

## Scope

- **Backend:** `M1D` IdentityManager's one erasure (`managers/identity/erasure.ts`,
  `departure.ts`, `members.ts`) and each Accessor's `forgetUser`
  (`erasureScope.ts`); `M4` InsightsManager's Dashboard, notification inbox
  and audit-log export (`managers/insights/`); `E2` ReportingEngine's
  Dashboard shape (`engines/reporting/dashboard.ts`); their routes
  (`http/routes/insights.ts`, `insightsJson.ts`, `identity.ts`); the log
  reconciliation change (PR #168).
- **Web:** the kit pieces `K21` Dialog and the shared `Modal` shell (the
  Drawer now built on it); the Flow `FL21` Dashboard; the Experience `X8`
  Review Insights (`experiences/reviewInsights/`); Track Investments'
  Archive Matured Holding and linked Holding (`archiveMaturedHolding.ts`,
  `useLinkedHolding.ts`); the shell's notification routing; the shared reads
  moved to `src/api/`.
- **E2E:** the `I11`–`I13` journeys (`tests/e2e/insights/`,
  `identity/bellInvitation.spec.ts`, `identity/deleteAccount.spec.ts`) and
  the finished core #13 (`investments/investmentsDaily.spec.ts`).

## Carry-overs

- **R4's A2 (OQ-239)** — one save lifecycle written four times; extract a
  Utility hook when the next form with that lifecycle lands. Slice 5's
  Dialog form (the audit-log export) is that form: decided in phase 3.

## Phase 1 — are the tests meaningful? (mutation testing)

### Step 1 — backend (`pnpm mutation:api`)

Limited to slice 5: `BASE=8f3a6a8` (the merge of PR #166, the last of R4's
PRs). Files added since then are mutated whole; files changed since then only
on their changed lines — 32 files.

**Result (2026-11-12, 9 min):** 251 mutants in 30 files, 240 killed,
**11 survived — score 95.6%** (slice 4: 96.4%). The first run, at 4 workers,
was stopped by the memory watchdog at mutant 151 (each worker's suite took
~4 GB beside a desktop already using ~14 GB); the rerun used 2 workers. The
erasure, the inbox, the audit export and the Dashboard Manager kill every
mutant.

#### Gaps — what could break and nobody would notice (2 mutants, 1 finding)

| # | Where | What could break unnoticed | Proposed test |
|---|---|---|---|
| B1 | Dashboard's active Holdings (`engines/reporting/investments.ts` L412) — 2 | **An archived CDB could reappear in the Dashboard's Coming Due.** A matured Holding is archived while it still holds its position (`hasMatured` needs `quantity > 0`), so it still has a value; only this filter keeps it out, and no Dashboard test has an archived Holding. | An archived fixed-term Holding with a value → absent from `comingDue`, still counted in the net worth series. |

#### Not gaps (9 mutants)

- **Equivalent — the departure's `'left'`** (`managers/identity/departure.ts`
  L39, L58) — 2. Its one caller (`erasure.ts`) only tells `stale`, `gone` and
  `dissolved` apart; any other outcome is a Leave, so `''` audits the same.
- **Equivalent — the inbox guard's path** (`http/routes/insights.ts` L40) —
  1. `.use('')` guards every route of the Insights sub-app, `/notifications`
  included (its 401 test still passes); the other routes already need a
  signed-in user through the household guard (OQ-174).
- **Equivalent — an undefined database field** (`utilities/logging/reconcile.ts`
  L90) — 1. A field kept as `undefined` disappears from the JSON log line.
- **Defensive — a `null` cause** (`utilities/logging/reconcile.ts` L87) — 4.
  Only an Error thrown with `cause: null` reaches it; Drizzle wraps the
  driver's error object.
- **Not worth a test — an error message** (`managers/insights/errors.ts` L41)
  — 1. The web reads the code; the message is never shown.

#### Fixed (2026-11-12) — stakeholder agreed the triage

B1: `investments.test.ts` — an archived matured CDB with a value is left out
of the Dashboard's Coming Due and kept in the net worth series. Hand-applied,
the mutant fails it.

### Step 2 — web and packages (`pnpm mutation:web`)

**Run (2026-11-12, `BASE=8f3a6a8`):** 46 changed files, one Stryker run each
over `vitest related <file>` (packages over their own suite). 911 mutants:
824 killed, **87 survived — 90.4%** (slice 4: 88.8%); none in the packages.
Triaged with slice 1's rules and R4's precedents (a tag some write
invalidates is a gap, `addTagTypes` is not; accessible names are gaps).

#### Gaps — what could break and nobody would notice (14 mutants, 9 findings)

| # | Sev. | Where | What could break unnoticed |
|---|---|---|---|
| V1 | Medium | `InboxPanel.tsx:153` (1) | **Every routed bell action could toast "nothing can handle this"**: accepting an invitation or archiving a Holding from the bell would show the `unrouted` error even when it worked — only the unrouted case is tested. |
| V2 | Medium | `inbox.ts:67` (1) | **An invitation notice could name the wrong invitation**: with two invitations waiting, both notices would name the first one's household and inviter, and a stale notice would look live while any invitation waits. |
| V3 | Medium | `reviewInsights/api.ts:70` — `Accounts`, `Budgets`, `Goals`, `Holdings` (4) | **The Dashboard could stop refreshing after a write elsewhere** (a transaction, a Budget, a Goal, an archived Holding) and show yesterday's figures until a reload. |
| V4 | Medium | `usePayoutChart.ts:31` (1) | **After a household switch, the payout chart could keep the previous household's chosen Holdings** and save the new choice under the old household — neither Investments nor the Dashboard remounts on a switch, so only the memo's dependency picks the new storage. |
| V5 | Medium | `InboxPanel.tsx:74,137` (2) | **The bell's panel could crash when the invitations arrive before the notifications**, or mark notifications seen before the panel can show them (an invitations read that fails would leave them seen and never displayed). Tests answer both reads together. |
| V6 | Low | `InboxPanel.tsx:132` (1) | The inbox's "2 hours ago" could be told from no moment at all — the Interaction is mocked in the panel's test and its `now` never checked. |
| V7 | Low | `formatting.ts:72` (2) | A notice 7–29 days old could read "12 days ago" instead of "last week" / "2 weeks ago" — no test covers the week unit. |
| V8 | Low | `ExportAuditLog.tsx:104` (1) | **Accessible name:** the export's date range (its label is hidden, so the key is its only name). |
| V9 | Low | `NotificationInbox.tsx:124` (1) | Empty element: a notice with no actions could still render an empty actions row. |

#### Not gaps (73 mutants)

| Kind | Why |
|---|---|
| Styling (26) | The badges' icons and tints, the row and badge classes, the Dialog's and Modal's class strings, the Modal's transition duration and timing style — reviewed through Storybook (OQ-128) and the mockups. |
| Copy and logs (10) | Logger labels, the warnings logged when marking seen or deleting a handled notice fails, the Dashboard's empty-state description (secondary copy). |
| Equivalent (29) | RTK `addTagTypes` (13); the `Payouts` and `Dashboard` tags no write invalidates (2); `attachmentNameOf`'s `?? ''` (no match either way); the export's seed range, overwritten by `choosePreset` (4), and its `checked` start (the initial preset is valid, so nothing shows) (1); `inboxReadOf`'s `&&` (`freshIds` is only set once both reads are in, and RTK keeps data); `noticeOf(…, [])` for a matured notice (invitations unread); Table's and HoldingsTable's open keys (a key no row has opens nothing) (3); `useLinkedHolding` dropping an absent parameter; Archive's `request.reset()` (a cache entry nothing reads); `useRole`'s default role is `dialog`. |
| Defensive (8) | `meta?.response?.` on a response RTK always passes (2); `?.` on a notice found from a rendered row (2); `noticeOf`'s type check (the contract has only two types, the other handled first); `holdings ?? []` before the Holdings load (the chart waits or shows all) (3). |

#### Fixed (2026-11-12) — all groups, stakeholder decision

Every group has its tests, each checked against its own mutants applied by
hand (all killed); the whole suite passes, typechecks and lints, coverage
100%.

| Group | Where the tests went |
|---|---|
| V1, V5, V6 | `InboxPanel.test.tsx` — a handled action toasts nothing; the invitations answered before the notifications (loading, then loaded and marked once); nothing marked seen while the invitations fail; the stub shows the panel's `now` |
| V2 | `inbox.test.ts` — the notice names its own invitation among several; stale while only others wait |
| V3 | `reviewInsights/api.test.ts` — one write per tag (`editAccount`, `deleteBudget`, `saveHoldingAllocations`, `recordIndexRate`), each invalidating only that Dashboard tag, reads the Dashboard again |
| V4 | `usePayoutChart.test.tsx` (new) — after a rerender with another household, its own remembered choice is read, and a new choice written under its key |
| V7 | `formatting.test.ts` — 14 days is "2 weeks ago" |
| V8, V9 | `ExportAuditLog.test.tsx` (the range named "Date range"), `NotificationInbox.test.tsx` (an actions row only around actions) |

### Phase 1 — where it stands

**Second runs (2026-11-12, `BASE=8f3a6a8`):** backend 251 mutants, 242
killed, **9 survived — 96.4%** (from 95.6%); web 911 mutants, 838 killed,
**73 survived — 92.0%** (from 90.4%). All 15 gap mutants are killed and no
survivor is new: every one left is a triaged non-gap. Phase 1 closes with its
PR.

## Phase 2 — the Playwright suite

The slice's journeys: 5 new tests and 5 changed. Tagged `@core`: #8 delete
account (I13), #12 the audit export (I11), #14 invite → bell → accept and #13
finished in the bell (I12), #5 finished on the Dashboard (I11). Smoke #5 (a
new household's Dashboard answers) is `@smoke`. Untagged (Full E2E): the
inbox's list/delete on a revoked invitation's notice, and the Dashboard's
investment panels with the payout choice shared with Investments. The Drawer
journey also checks its scrim starts under the header (OQ-241).
Preconditions are arranged through the API, the browser does only the
journey, and every end state is read back through the API: the Holding
`archivedBy: 'user'` and the notice gone (#13), the membership and the notice
gone (#14), the CSV equal to the API's for those days (#12), the members, the
shared rows naming no one and the audit log a superset of before (#8), the
Dashboard report's figures (#5, panels).

**Runs (2026-11-12, local, 16 workers):** the slice and smoke 3× — 63/63 in
23 s; 10× — 210/210 in 1.1 min; the whole suite 3× — 168/168 in 1.6 min. No
journey failed or was retried.

**CI cadence holds.** `ci.yml` runs `@smoke` on every PR and `@core` after
merge on `main`; `nightly.yml` runs everything at 06:00 UTC and on demand —
unchanged in slice 5. The BDT plan's slice-5 paragraphs (I11–I13) are written,
and all 14 core journeys are now tagged.

**No findings.** Checked and left as they are:
- **#8 proves personal rows only unnamed, not deleted** — decided in OQ-246:
  no one else can see them through the API; M1D's integration suite proves
  the deletion. The plan's I13 paragraph says so, though its core list still
  reads "personal Accounts/Budgets/Goals gone" for the journey as a whole.
- **#12's CSV compared with an export made after the download** — safe: an
  export writes no audit entry, and the journey waits for the setup's last
  entry before the Owner asks.
- **The Dashboard journey checks the payout chart by its legend and the
  Holdings asked for, not its bars' amounts** — the seam it adds is the choice
  shared with Investments; the payouts report's figures are R4 E1's check on
  Investments.

**Note — an aborted read logged as an API failure.** Each run logged a few
`API request failed … status: 200, code: internal.unexpected` for
`listHouseholds`, always in #5. The API answered 200 in 2–7 ms (its log, by
correlation ID); the journey's `page.goto` reloaded the page 1.4 s after
sign-in, while the app's first household read was still being read, and the
cut-short body read surfaced as a `PARSING_ERROR`. No test is flaky because
of it and no user sees it: the browser logger writes only to the console, and
in the app a page change is a client route, not a reload. Left as is.

## Phase 3 — code and architecture

The `harmonic-review` lenses over slice 5's code, with the import graph per
layer (every changed file's imports read).

**Boundaries hold.**
- **VBD:** no Engine → Engine or Accessor → Accessor at runtime — the
  Accessors share `erasureScope.ts`, a query helper like `ledgerQuery.ts`;
  routes call only Managers. The cross-tier imports in the slice are all
  `import type` (`insightsJson.ts` → `notificationInboxAccessor`,
  `engines/reporting`; `reconcile.ts` → `auditLogAccessor`; Identity's
  `departure.ts`/`erasure.ts` → their Accessors' types). The Insights Managers
  are thin: one access check, then one Engine or Accessor read; the export's
  `date.before_start` is the Manager's (OQ-243).
- **EBD:** only Experiences call the backend (ESLint); no Flow imports a
  sibling; Review Insights reaches Investments only through the shared
  `experiences/` pieces (`usePayoutChart`, the panels in
  `experiences/interactions/`, `holdingLink`) and an address — never Track
  Investments' modules. The bell's actions reach their Experiences through
  the shell's routing table (OQ-245); the inbox panel is Review Insights'
  Experience tier, handed to the shell through `chrome.tsx`.
- **BDT:** each new test mocks only the tier below — the Dashboard Flow its
  four Interactions, the Experience its Flow, the inbox panel its Interaction,
  the export its browser-download Utility; the Insights Manager suite fakes
  the Engine and Accessors.
- **Plan vs code:** tasks 136–142 are done; the contract-routes test (OQ-163)
  lists only v2/v3 operations as unrouted.

| # | Finding | Severity | Proposed fix |
|---|---|---|---|
| A1 | **A refused submit leaves focus where it was in three forms (OQ-192).** OQ-192 settled it in slice 2: after a refused submit, the first invalid field takes the focus, so a message below the fold isn't missed — `utilities/useFocusFirstInvalid.ts`, used by seven forms. The Audit Log export (`ExportAuditLog.tsx`), Market Value Entry and the Goal split editor (`GoalAllocationCard.tsx`) never move it; Rate Update Entry and the history editor (`HistoryEditorParts.tsx:304`) copy the effect inline. *Cause (EBD):* the "refused submit" axis has a Utility, but nothing points a new form at it — slice 4 re-derived it twice and dropped it twice, slice 5 dropped it once. *Counterpart (BDT):* mutation testing can't find a behaviour that was never written; each copy tested focus on its own (R4's V6). **Correction to R4's A2:** it said all four slice-4 forms focus the field at fault — only two do. | Medium | Give the Utility a scope a form can pass as it renders (its form element, or a ref) and use it in all five: the three forms gain the focus, the two inline copies go. Its own suite tests the focus once; each form's test checks one refused submit focuses its field. This settles R4's A2: the shared piece is this Utility, not a whole save-lifecycle hook — who holds `busy` (the export's caller, the forms themselves) and what "done" closes still differ. |
| A2 | **Note — the erasure rule in seven Accessors.** "Personal rows go, shared rows lose the user's name" is written in each `forgetUser` (Accounts, both ledgers, Budgets, Goals, index rates, invitations), and the transfer unpairing ("a transfer losing its side becomes a lone movement") sits in `accountTransactionAccessor`. *Volatility:* the rule is FR-1.17's (GDPR) and changes with the law, not with a feature; what is personal and how rows link is each table's own storage fact; the order and the transaction are the Manager's (`erasure.ts`, OQ-240). | Note | **Leave it** (recommended): decided in OQ-240; one verb per Accessor keeps each table's foreign keys and visibility in the one place that knows them. Revisit if erasure ever gets a policy of its own (e.g. keeping personal rows for a grace period). |

Decisions (OQ-247): fix A1 through the Utility; leave A2 as a note.

### Phase 3 — fixes (2026-11-13)

- **A1:** `useFocusFirstInvalid` takes an optional ref for its scope, read
  when the focus moves (the page when unmounted); its suite checks the
  unmounted case. The Audit Log export, Market Value Entry and the Goal split
  editor count their refusals (in place of a shown-problems flag) and use it,
  scoped to their own fields; Rate Update Entry and the History editor drop
  their inline copies for it. Each form's test checks a refused submit
  focuses the field at fault, and fails with the form's call removed (all
  five hand-checked). OQ-192 and OQ-239 amended through OQ-247.

## Closing (OQ-164)

R5 is complete: phase 1 in PR #176, phases 2 and 3 in phase 3's PR (phase 2
found nothing to fix). Nothing stays open as work: A2 is a note. The next
slice starts at task 143 (`N10`).
