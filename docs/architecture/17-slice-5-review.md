# Slice review — slice 5, November 2026

The gate at the end of slice 5 (insights and notifications: the Delete User
cascade, the Dialog, the Dashboard, the notification inbox, the audit-log
export, the bell's routing and delete account — tasks 136–142), run by the
method in `13-slice-review.md` (OQ-164). Work happens on the `review/slice-5`
branch, cut from `main` after PR #175 (`I13`).
**Status: in progress — phase 1.**

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

## Phase 2 — the Playwright suite

## Phase 3 — code and architecture

## Closing (OQ-164)
