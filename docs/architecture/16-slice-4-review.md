# Slice review — slice 4, November 2026

The gate at the end of slice 4 (investments: holdings, market values, rates,
payouts and the daily job — tasks 123–135), run by the method in
`13-slice-review.md` (OQ-164). Work happens on the `review/slice-4` branch,
cut from `main` after PR #164 (`I10`).
**Status: phase 1 complete (its PR); phases 2–3 next.**

## Scope

- **Backend:** the job `N9` (`jobs/dailyScheduler.ts`, `investmentsDaily*`);
  `E2` ReportingEngine's investments shapes; `M4` InsightsManager's
  `investments-overview` and `payouts` reports and the household Holdings
  list; their routes; the `accountTransactionAccessor` change.
- **Web:** the kit pieces `K24`, `K37`–`K39`, `K43`, `K46`; the Flows
  `FL18`–`FL20`; the Experience `X7`.
- **E2E:** the `I6` and `I10` journeys (`tests/e2e/investments/`).

## Carry-overs

None — slice 4 raised no security or design question for this gate.

## Phase 1 — are the tests meaningful? (mutation testing)

### Step 1 — backend (`pnpm mutation:api`)

Limited to slice 4: `BASE=9180504` (the merge of PR #151, which closed the
slice-3 review). Files added since then are mutated whole; files changed
since then only on their changed lines — 18 files.

**Result (2026-11-11, 5 min):** 414 mutants in 18 files, 399 killed,
**15 survived — score 96.4%** (slice 3: 88.4%). The Managers, routes and the
scheduler kill every mutant; the survivors sit in the daily job and its
command. The two doubtful ones were checked by hand: without the date
pattern, `--today=2020` and `--today=2020-01` pass the calendar-day check
(the ISO round-trip alone accepts them).

#### Gaps — what could break and nobody would notice (4 mutants, 3 findings)

| # | Where | What could break unnoticed | Proposed test |
|---|---|---|---|
| B1 | Same-day cash order (`investmentsDaily.ts` L65) — 2 | On a CDB's maturity day, **the redemption could be posted before that day's last interest**: the "redemption last" rule is never exercised, because no test has both on one day with the redemption's id sorting first. | Interest and redemption due the same day, the redemption's id first → the interest is published first. |
| B2 | `--today`'s date check (`investmentsDailyCommand.ts` L72) — 1 | **`--today=2020` or `--today=2020-01` could run the job "as of" a partial date** — they pass the calendar check without the `YYYY-MM-DD` pattern, and compare as earlier than any real day in 2020. | `--today=2020` and `--today=2020-01` refused. |
| B3 | `--today`'s separator (`investmentsDailyCommand.ts` L91) — 1 | **`--today:2020-01-01` (or any character in place of `=`) could be accepted** as `--today=2020-01-01`: the date is cut at a fixed length, and only the `=` check refuses it. | `--today:2020-01-01` refused. |

#### Equivalent — can't change behaviour (11 mutants)

- **Repeated abort checks** (`investmentsDaily.ts` L103, L111, L135, L145,
  L147, L151) — 6. Each removed check is covered by the next one before any
  publish: no `await` lies between them, and the lock checks the signal
  before the run starts (L135). Removing one only lets a read happen before
  the run throws anyway. No change proposed; they make the "nothing published
  after the lock is lost" rule obvious where it is read.
- **The date pattern's anchors** (`investmentsDailyCommand.ts` L72) — 2. Text
  before or after the date already fails the ISO round-trip.
- **`listPayouts([])`'s early return** (`accountTransactionAccessor.ts` L551)
  — 1. Drizzle turns an empty `IN` into `false`; the database answers none
  either way (the db test checks both). It only saves a round trip.
- **Net worth's currency order** (`reporting/investments.ts` L210) — 1. The
  contract promises no order, and the web arranges the cards by
  `portfolio.netWorthOrder` itself.
- **The lock's initial `acquired`** (`investmentsDailyLock.ts` L57) — 1. It
  only matters when the lock query throws, and then `uncertain` already
  discards the connection without an unlock.

#### Fixed (2026-11-11) — stakeholder agreed the triage

| Group | Where the tests went |
|---|---|
| B1 | `investmentsDaily.test.ts` — interest and redemption due one day, the redemption read second with the id sorting first |
| B2–B3 | `investmentsDailyCommand.test.ts` — `--today=2020`, `--today=2020-07` and `--today:2020-07-02` refused |

**Second run (2026-11-11, `BASE=9180504`, 4 min):** 414 mutants, 403
killed, **11 survived — 97.3%** (from 96.4%): exactly the 11 equivalent
ones above; none new.

### Step 2 — web and packages (`pnpm mutation:web`)

**Run (2026-11-11, `BASE=9180504`):** 81 changed files, one Stryker run each
over `vitest related <file>` (packages over their own suite). 4,115 mutants:
3,653 killed, **462 survived — 88.8%** (slice 3: 89.2%); none in the
packages. Triaged with slice 1's rules; every survivor tagged by file and
line (the map is reproducible from `reports/mutation/web/mutation.json`).
The doubtful ones were hand-applied against the related tests, each passing
before its fix: a completed Goal offered in the split (V1), the value
history editable by a Viewer (V2), a trade not refreshing the payouts (V3),
the Holdings listed in input order (V4).

#### Gaps — what could break and nobody would notice (≈127 mutants, 10 findings)

| # | Sev. | Where | What could break unnoticed |
|---|---|---|---|
| V1 | **High** | `GoalAllocationCard.tsx:83,95,99,108,119,175`, `holdingMaintenance.ts:414` (14) | **The Goal split editor:** a completed Goal could be offered in "Add goal"; a Holding with no split yet (or whose Goals are all gone) could show "No goals to fund" instead of the editor; changing one of two shares could leave Save asleep; problems could show before Save, or stay after Reset or a save; a slow save could be sent twice. |
| V2 | **High** | `HoldingPanel.tsx:95,167,193` (3) | **The value history drawer could be editable for a user who may not change the Holding** (a Viewer, an archived Holding), or open on its own; a refused write could toast an empty message. |
| V3 | Medium | `trackInvestments/api.ts:147,167,172,176,186,190,198` (13) | **A write could stop refreshing what it changed** (OQ-222/236's tags): a trade recorded in Manage Finances not refreshing the payout chart, the Activity card or the value history; a split, value or rate write answering "not found" not refreshing its list. |
| V4 | Medium | `holdingMaintenance.ts:183`, `portfolioOverview.ts:62,120,122,185`, `HoldingsTable.tsx:234` (8) | **Order:** Holdings, a family's shares and the account rows could follow the report's order instead of largest first (R$ first for accounts) — the fixtures happened to arrive sorted; opening one Holding row could open every row (the table's key). |
| V5 | Medium | `MarketValueEntry.tsx:89,122,124,128,137,142,146`, `RateUpdateEntry.tsx:74`, `useHistoryEditing.ts:191,233`, `historyModel.ts:268` (12) | **The value forms:** problems shown before Save or kept after a save, a valid field flagged, a second value on a day already recorded refused (market values allow several), a save sent twice, the page reloading on submit, a change preview with nothing typed, a reopened form showing the last refusal, `isDraftValid` passing a draft whose only problem is its value. |
| V6 | Medium | `RateCard.tsx:168,175`, `useHistoryEditing.ts:174`, `HistoryEditorParts.tsx:303–305` (15) | **Focus:** a Rate card or the history editor taking focus on load, the editor pulling focus out of the form it just opened, a refused save not moving focus to the field at fault. |
| V7 | Medium | `netWorthTiles.ts:26`, `ComingDue.tsx:77`, `PayoutPanel.tsx:182`, `MarketValueEntry.tsx:234`, `ValueHistoryDrawer.tsx:65`, `RateHistoryDrawer.tsx:66`, `ContractCard.tsx:209`, `holdingMaintenance.ts:269` (14) | **Figures:** the net worth change compared to the wrong month on a longer series, Coming Due's day showing NaN, chart chips unformatted or a market value written as a rate, a rate's change in percent instead of points, an empty term bar, a whole month not counted on the same day of the month. |
| V8 | Medium | the tabs' and payout switch's names, the Holdings search, the cards' titles and figure labels (Market value, Counts toward goals, Position, Contract, Used by, By account), failure messages, the history list's `tabIndex` (22) | **Accessible names and labels** (slices 2–3's W8/V8 again). |
| V9 | Low | `ComingDue.tsx:112–118`, `PayoutThisMonth.tsx:86,89`, `AllocationCards.tsx:60,63`, `TrackInvestmentsExperience.tsx:60,251`, `useMediaQuery.ts:34`, `barModel.ts:196,243`, `StackedBarChart.tsx:80`, `Table.tsx:92`, `HistoryEditor.tsx:247` (22) | Two states at once (placeholders with rows, the empty line with rows), the user's loading shown as a failure, the overview asking for completed Goals too, the media query never hearing a change, a long payout window labelling every month or the wrong ones, a padded `1fr` track left unwrapped, the editor refusing a second value a day by default. |
| V10 | Low | `DetailCard.tsx:50`, `MarketValueEntry.tsx:276`, `HistoryEditorParts.tsx:176`, `Table.tsx:250` (4) | Empty elements: a header's action slot, a read-only note, an unlocked value's reason line, a table's footer row. |

#### Not gaps (≈335)

| Kind | Why |
|---|---|
| Tailwind class strings, class arrays, `join(' ')`, inline colours and widths, SVG and chart geometry, label placement at exact edges | Styling — reviewed through Storybook (OQ-128) and the mockups, as in slices 1–3. |
| Secondary copy keys (descriptions, hints, footnotes, notes, placeholders, the unknown-Holding stand-in), icons | Presentation; titles, labels and actions are asserted (slice 1's rule). |
| Equivalent | Memo and effect dependency arrays; RTK `addTagTypes`; a tag no write invalidates (`Payouts`, `HoldingActivity`) or one another tag already covers (`InvestmentsOverview`/`Accounts` with `Goals`); `parseSelection('')` throwing into the same `all`; the payout panel's failed check (`series` is undefined whenever the read failed); a rate's `{ kind: 'rate' }` vs `{}` in its checks; redundant guards (`isDraftValid` before `value === null`, a fixed rate with no index); the readout's dismiss listener; a remembered choice re-read from storage; `labelWide`'s parity (`a−b` and `a+b` share it); a `catch → 'refused'` that `!== 'done'` already covers; the empty-history chart (K38 draws nothing without points). |
| Defensive | `?? ''`/`?? []`/`?.` on fields the contract always sends or reads not yet loaded; four-digit year padding; a slice of another kind sharing an id; a projection with a payout but no taxes. |
| Not worth a test | Tab switches replacing the history entry (Playwright's domain), a pending point drawn on an empty history while typing, column headers hidden from assistive tech, the Table's group key. |

**Proposed order:** V1–V2 first (the split editor, a Viewer's history), then
V3–V8, then V9–V10. One commit per group.

#### Fixed (2026-11-11) — all groups, stakeholder decision

Every group has its tests, each checked against its own mutants applied by
hand (all killed); the whole web suite passes, typechecks and lints.

| Group | Where the tests went |
|---|---|
| V1 | `GoalAllocationCard.test.tsx` (only open Goals to add, a first split and a split with no Goals left editable, problems held until Save and dropped after Reset or a save, one send while saving), `holdingMaintenance.test.ts` (one of two shares changed) |
| V2 | `HoldingPanel.test.tsx` — the drawer read-only for who may not change the Holding, closed until asked; the refusal toast's text |
| V3 | `trackInvestments/api.test.ts` — a trade refreshes the payouts, the activity and the snapshots; a split, value or rate write answering not found refreshes its list |
| V4 | `holdingMaintenance.test.ts`, `portfolioOverview.test.ts` (inputs smallest first, a USD account larger than the R$ one), `HoldingsTable.test.tsx` (one open row) |
| V5 | `MarketValueEntry.test.tsx`, `RateUpdateEntry.test.tsx`, `HistoryEditor.test.tsx` (submit is prevented, a reopened form is clean), `historyModel.test.ts` |
| V6 | `RateCard.test.tsx`, `HistoryEditor.test.tsx` (no focus on mount, focus kept in the opened form after the next frames, focus on the field at fault) |
| V7 | `netWorthTiles.test.ts`, `ComingDue.test.tsx`, `PayoutPanel.test.tsx` (the readout in money), `MarketValueEntry.test.tsx`, `ValueHistoryDrawer.test.tsx`, `RateHistoryDrawer.test.tsx`, `ContractCard.test.tsx` (the bar's value), `holdingMaintenance.test.ts` |
| V8 | the Experience's tabs, `PayoutPanel`, `PositionCard`, `ContractCard`, `GoalAllocationCard`, `MarketValueEntry`, `HoldingPanel`, `RateCard`, `AllocationCards`, `HistoryEditor` |
| V9 | `ComingDue`, `PayoutThisMonth`, `AllocationCards` (one state at a time), the Experience (loading, active Goals), `useMediaQuery`, `barModel` and `StackedBarChart` (fourteen months), `Table` (padded and partial `fr` tracks), `HistoryEditor` (the `uniqueDays` default) |
| V10 | `MarketValueEntry.test.tsx` (no note, a three-part header), `HistoryEditor.test.tsx`, `Table.test.tsx` |

**Second run (2026-11-11, `BASE=9180504`, no file failed):** 4,115 mutants,
3,772 killed, **343 survived — 91.7%** (from 88.8%); none new. Every
survivor is a triaged non-gap; on the gap lines only narrower spans of the
same kinds remain: the `Payouts` and `HoldingActivity` tag names (no write
invalidates them), the Market value form's `{ kind: 'money' }` (MoneyInput
types no minus sign), the term bar's tone and a figure's `numeric` look
(styling), and the refusal-focus effect's `refusals > 0 → true` and `?.`
(nothing is `aria-invalid` before a refusal).

### Phase 1 — where it stands

Fixed on `review/slice-4`: B1–B3 (backend) and V1–V10 (web), tests only, no
app code. Both second runs clean.
