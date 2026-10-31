# Slice review — slice 3, October 2026

The gate at the end of slice 3 (day-to-day finances: record, browse, filter
and edit transactions; the month overview — tasks 99–122), run by the method
in `13-slice-review.md` (OQ-164). Work happens on the `review/slice-3`
branch, cut from `main` after PR #148 (`I9`).
**Status: phase 1 fixed and verified — backend 94.0%, web 93.5%; its PR next. See "Where it stands" at the end.**

## Scope

- **Backend:** the Accessors `A7`, `A8`; the Engines `E1`
  InvestmentProductEngine and `E2` ReportingEngine (slice 3's part); the
  Managers `M3` TransactionManager and `M4` InsightsManager (slice 3's part);
  their routes; the `I3` and `I4` seam suites.
- **Web:** the kit pieces `K10`, `K12`, `K29`, `K32`, `K35`, `K36`,
  `K40`–`K41`, `K44`, `K47`; the Flows `FL15`–`FL17`; the Experience `X6`.
- **E2E:** the `I9` journeys (`tests/e2e/finances/`) and smoke #4.

## Carry-overs

None — slice 3 raised no security or design question for this gate.

## Phase 1 — are the tests meaningful? (mutation testing)

### Step 1 — backend (`pnpm mutation:api`)

Limited to slice 3: `BASE=54c15d8` (the merge of PR #122, which closed the
slice-2 review). Files added since then are mutated whole; files changed
since then only on their changed lines — 32 files.

**Result (2026-10-31, 79 min, run detached from the session):** 3,433
mutants in 32 files, 3,034 killed, **399 survived — score 88.4%** (slice 2:
96.0%). Every survivor is triaged below. The alarming ones were hand-applied
and the whole API suite run: an edited buy writing a sell's deltas (B2), the
route dropping every Browse filter (B4) and a partial sell archiving its
Holding (B3) all pass 2,223 tests unchanged.

**The pattern behind most gaps.** The TransactionManager suites check the
outcome (what the use case returns, which refusal it throws) but rarely
*what was written*: the fakes answer any id and any arguments, and only a few
tests assert the row, the Accessor's arguments or the audit entry. Most
findings below are one instance of that.

#### Gaps — what could break and nobody would notice (201 mutants, 19 findings)

| # | Where | What could break unnoticed | Proposed test |
|---|---|---|---|
| B1 | Audit of Record / Edit / Delete Transaction (`record.ts` L1044, `edit.ts` L626–628, `delete.ts` L188, `context.ts` L67–70, `edit.ts` L164) — 32 | The audit entry could lose its entity type, id, household or actor, or be written for an edit that changed nothing. The audit log is FR-7; slice 1's `expectAudited` (M5) isn't used by these suites. | `expectAudited` on all three use cases, on both ledgers (`CardTransaction` / `AccountTransaction`), with the actor; an edit resending the same values writes and audits nothing. |
| B2 | Edit of a buy (`edit.ts` L201) — 4 | **Editing a buy could take its quantity and cost basis out of the Holding** (a sell's negative deltas) instead of putting them back. Hand-applied: all tests pass. | Edit a market buy's quantity and amount → `applyTrade` gets the positive deltas, and the row stores them. |
| B3 | Archive after a trade (`record.ts` L800, `edit.ts` L322) — 2 | **A partial sell, or an edit leaving position, could archive the Holding** as if it were sold out. Hand-applied: all tests pass. | A partial sell and a partial-sell edit leave the Holding unarchived. |
| B4 | Browse filters (`routes/transactions.ts` L33–36, `browse.ts` L207–228) — 26 | **The ledger filters could never reach the query**: the route could drop every filter (hand-applied: all tests pass), the Manager could drop the account/card picker, and the card side could ignore which cards were picked (an Account's cards, a card's own, none). | Route: the query's filters reach `listTransactions`. Manager: the picker reaches both Accessors; the card side gets the picked Account's cards, the picked card, or none. |
| B5 | Browse paging (`browse.ts` L63–66, L101–102, L167–176, L357–362, L408–409) — 23 | Page 2 could restart from the top (the cursor never handed to the Accessor); a ledger already exhausted could be queried again; a malformed cursor (no `:`, a bad date, an empty id) could slip through as a query instead of a 400; month counts could be asked for the wrong months; two days or two currencies could share one day total; a transfer read by id could lose its visible pair or ledger tag. | A second page resumes each ledger from its half of the token and skips a finished one; three malformed half-tokens → 400; two days × two currencies of totals; `getTransaction` of a transfer whose other side is visible. |
| B6 | The rows written (`record.ts` L244, L261, L320, L635, L642, L703) — 17 | A charge, a cash transaction or a trade could be stored **without its Category**, a trade with the wrong `kind`/`effect`, a scheduled post without `source: 'schedule'`, and a Subcategory spend could miss its Budget. | Assert the full row inserted for a card, a cash and a trade kind; a scheduled post's `source`; a Subcategory accrual. |
| B7 | Category checks (`record.ts` L217–226, `edit.ts` L176–191, `reversal.ts` L330) — 10 | A Subcategory sent without its Category could be accepted; a Category's second Subcategory could be refused; an edit setting a valid Subcategory could be refused; a started fixed-term buy could refuse a Category edit (D8 allows it). The fakes find any Category or Holding id, even `undefined`. | Each case above, with fakes that answer only the ids the test set up. |
| B8 | Goal splits with more than one Goal (`record.ts` L429–435, L477, L529–534, `delete.ts` L42, `allocations.ts` L26) — 11 | A split naming one visible and one hidden Goal, or one open and one completed, could pass; a duplicate's error could name no field; the split could be read without the Holding's id; two shares with equal remainders could get the extra point in either order. | Two-Goal splits for each refusal; the duplicate's field; `listAllocations({ holdingId })`; a tie in the rounding. |
| B9 | Fixed-term terms handed to the Engine (`record.ts` L551–556, `edit.ts` L214–223) — 7 | An incentivised debenture could be scheduled as taxed, the interest-payment default lost, and an edit could schedule from the wrong rate or drop the Holding's flag. | Assert the terms `schedule` gets on a buy (defaults included) and on an edit that changes only one term. |
| B10 | A fixed-term Holding's other trades (`edit.ts` L82, L268, L325, L474, `delete.ts` L144, `reversal.ts` L228–229) — 15 | A CDB's **redemption** could be edited or deleted under its **buy's** rules (term fields, the schedule lock, a schedule recompute); a date-only edit of a buy could skip the recompute; a schedule with entries but none posted could count as started. | Edit and delete a CDB redemption; a date-only buy edit recomputes; an unposted schedule stays editable. |
| B11 | User- vs system-archived Holdings (`record.ts` L340, L733, `edit.ts` L285) — 6 | A **dividend or interest naming a sold-out (system-archived) Holding** could be refused like a user-archived one. | Record and edit a cash event on a system-archived Holding. |
| B12 | Own-account transfers (`record.ts` L986, `edit.ts` L570, `accountTransactionAccessor.ts` L412) — 3 | A transfer **from an archived Account, or in another currency than the sender's**, could be accepted; an edit from the receiving side could swap the sides; the Accessor could return the sent row as the received one. | Each of the three. |
| B13 | Scheduled post onto an archived Account (`record.ts` L899) — 1 | The target checks on a scheduled post are untested — and **an Account can be archived while it still holds a live CDB**, so the maturity post is refused every day, forever. Needs a decision (below). | After the decision. |
| B14 | Per-kind fields (`kindRules.ts` L26–51, L73, L114–116, `edit.ts` L94) — 27 | **Boleto, Pix payment, Pix receipt, dividend and tax are never recorded in the API suite**: their required fields could vanish (then `accountId` itself is refused as unknown) and nothing fails. A redemption's Goal split could be refused; a Subcategory on an own transfer accepted; unknown-key details lose their `keys`. The "every kind" test checks 3 of 18 kinds. | The field table over all 18 kinds; record each of the five kinds once; the other cases. |
| B15 | Lost races in reversals (`reversal.ts` L270–283, L311, `edit.ts` L351) — 6 | A balance move or card movement refused mid-reversal could go unnoticed instead of `transaction.changed` (OQ-203); a card edit could be written with no stale guard; undoing a buy to zero could reopen a system archive. | Each refusal → `transaction.changed`; the card edit's expected values; no `unarchiveIfSystemArchived` at zero. |
| B16 | Schedule posts subscription (`managers/index.ts` L45) — 1 | `createManagers` could stop subscribing TransactionManager to `transaction.import.requested` — **no fixed-term entry would ever post**, and the suite stays green. | In `pubsub.test.ts`: the event, published on the real bus, posts the entry. |
| B17 | ReportingEngine (`goalProgress.ts` L96, `monthOverview.ts` L96, L175, L283) — 4 | A market-priced Holding could be valued at its cost basis in Goal progress; an own transfer could count as money in and out; currencies could come in any order; a Budget's period from the same month a year earlier could count as this month's spend. | Each case. |
| B18 | Easter (`calendar.ts` L118–123) — 5 | The Easter formula could be wrong in years the table doesn't cover — 2014/2033 (a negative intermediate) and 2049/2076 (the rare correction); Carnival, Good Friday and Corpus Christi move with it. Long Treasury bonds run past 2045. | Add those years and one in the 2100s. |
| B19 | `CardTransactionAccessor.insert` (L188) — 1 | Any insert error could be reported as `reference_not_found` instead of surfacing (the Account ledger's twin is tested). | A non-FK failure rethrows. |

#### Not gaps (198 mutants)

- **Equivalent — can't change behaviour (92):**
  - *Empty-list short-circuits* (25) in the Accessors and Browse — Drizzle answers `inArray(column, [])` with nothing; the guard only saves a round trip (as slice 2).
  - *An `undefined` field spread* (15: `description`, `holdingId`, `source`, terms, filters) — Drizzle and the Manager skip `undefined` keys.
  - *`archivedAt !== null` → `true`* (6) — the schema pairs `archived_at` with `archived_by`, so `archivedBy === 'user'` alone decides; the schedule handler's three are the same, its sold-out branch catching the rest.
  - *Fixed-term term checks on a request without terms* (10, `kindRules.ts` L150–158, L199) — nothing to find; a stray term is already an unknown key.
  - *Opaque or self-consistent values* (36): the cursor's start marker, `padStart` on a last day ≥ 28, the holidays cache, a direction that is "anything but out", NaN shares that round away, `held` signs that keep zero at zero, `or()` dropping `undefined`, the scheduled target's `'Owner'` role no scheduled post reads, kinds that are the only ones carrying a card, and similar.
- **Defensive — inputs the system can't produce (17):** an unknown stored kind, a Holding vanishing between two reads in one request, rates with only one of type/value (the schema refuses it), the debenture-only incentivised flag (the Manager refuses it elsewhere), the Engine's non-fixed-term guard, and the card row lock's `of` clause (PGlite can't observe it, as slice 2).
- **Not worth a test (68):** the English `message` of every DomainError (`errors.ts` ×58, `access.ts`, `authentication.ts`; OQ-83 — `account`/`identity` are here because PR #123 touched them) and the schedule handler's log texts.
- **Guarded outside the suite (21):** `db/schema/*` check and index names and SQL — `pnpm check:schema` fails on any drift from the migrations (slice 1, S1).

#### Decision (OQ-226)

- **D1 — a scheduled post onto an archived Account (B13).** Archiving an
  Account didn't look at its Holdings, so a CDB in an archived Account kept
  its schedule; at maturity the post was refused and retried every day.
  **Decided: archiving an Account with an open Holding is refused** (409
  `account.holdings_open`); the scheduled post's archived check is then
  defensive, and B13's test pins it.

#### Proposed fixes

One commit per finding group: B1 (audit), B2–B3 and B15 (trade effects and
races), B4–B5 (Browse), B6–B7 and B14 (the rows written, categories, per-kind
fields), B8–B11 (Goal splits and Holdings), B12–B13 with D1 (transfers,
scheduled posts, the archive refusal), B16 (subscription), B17–B19 (Engines
and the card Accessor). Fakes in the TransactionManager suites answer only
the ids a test set up. Verified by a second `BASE=54c15d8` run: the 201
killed, none new.

#### Fixed — verified (2026-10-31)

Tests added in five commits on `review/slice-3` (D1; B1; B2–B3 and B6–B15;
B4–B5; B16–B19), each new test first checked against its own mutant, applied
by hand. **Second run (`BASE=54c15d8`, 55 min):** 3,443 mutants, 3,235
killed, **208 survived — 94.0%** (from 88.4%). No gap mutant survives; the
208 are the triaged non-gaps, the reclassified ones below, and one new
not-worth (the English message of `account.holdings_open`). Five more of the
first run's "gaps" proved equivalent on the second look: `browse.ts` L63 `<= 0`
(the date check still fails), L225/L227 (a junk card id is never a visible
one), `edit.ts` L82 (a junk asset type is no more fixed-term than `''`) and
`record.ts` L642 `source !== undefined → true` (Drizzle skips an `undefined`).
**Backend gaps: 190 mutants, all killed.**

#### Reclassified while fixing (6 mutants)

Writing the tests showed six "gaps" can't change behaviour after all, so the
backend count is **195 gap mutants** (B5 22, B8 10, B10 13, B12 2, B17 3),
**97 equivalent** and **18 defensive**:

- `browse.ts` L63 `separator < 0` → `false`: with no `:` the date part loses a
  character and fails the date check anyway.
- `allocations.ts` L26 tie-break `−` → `+`: every tie then compares "after",
  and V8's stable sort keeps the input order the existing tie tests pin.
- `delete.ts` L144 `?? ''`: only card rows have no asset type, and they are
  never buys.
- `accountTransactionAccessor.ts` L412 received row: Postgres returns the
  received side first through the transfer index, so "the first row" is the
  right one; the code finds it by id, which is correct — no test can force
  another order.
- `monthOverview.ts` L96 `'transfer'` in `LEFT_OUT`: `movedInside` reads
  `pairInView` for a transfer and never consults the set, so the entry is
  dead code — **for phase 3** (drop it, or say why it stays).
- `edit.ts` L474 `holding !== undefined` → defensive: `tradeHoldingOf`
  throws before a trade without its Holding gets there.

#### Where the backend tests went

Every group B1–B19 has its tests; each new test was checked against its own
mutant, applied by hand, and the whole API suite passes — 2,321 tests. Fakes
in the TransactionManager suites now find a Category or Holding only by an id
the test set up (`CATEGORY` with two Subcategories in `fakes.ts`).

| Group | Where the tests went |
|---|---|
| B1 | new `transaction/audit.test.ts` |
| B2, B3, B11, B15 | `edit.test.ts` (trades, shared undo), `record.test.ts` (sell, cash events) |
| B4, B5 | `browse.test.ts` (two-card pickers, paging), `transactionRoutes.test.ts` |
| B6, B7, B14 | `record.test.ts` (rows written, untested kinds), `edit.test.ts`, `kindRules.test.ts` (18-kind table), `events.test.ts` |
| B8, B9, B10 | `record.test.ts` (multi-Goal splits, Engine terms), `edit.test.ts`, `delete.test.ts` |
| B12, B13 | `transfers.test.ts`, `events.test.ts` |
| D1 | `account/accounts.test.ts` + `listByAccounts` in `account/fakes.ts` |
| B16 | `pubsub.test.ts` |
| B17, B18, B19 | `reporting/*.test.ts`, `calendar.test.ts` (2014, 2033, 2049, 2076, 2100, 2106 — checked against `dateutil`), `cardTransactionAccessor.test.ts` |

### Step 2 — web app and packages (`pnpm mutation:web`)

**Run (2026-10-31, detached, `BASE=54c15d8`):** 126 changed files, one
Stryker run each over `vitest related <file>` (packages over their own
suite); stopped once by the memory watchdog at 48 files (hand-run tests in
parallel) and resumed with `RESUME=1`. 4,793 mutants: 4,272 killed, 1 timed
out, **520 survived — 89.2%** (slice 2: 91.3%); none in the packages.
Triaged with slice 1's rules; every survivor tagged by file and line (the
map is reproducible from `reports/mutation/web/mutation.json`). Five
hand-applied, each passing every related test: a Category write that no
longer refreshes the Categories (V3), a 0-cent amount passing the client
check (V2), a Holding change keeping the old Holding's refusal (V1), the
ledger's day totals gone (V4), the chosen Holding never shown as chosen
(V5).

#### Gaps — what could break and nobody would notice (289 mutants, 10 findings)

| # | Sev. | Where | What could break unnoticed |
|---|---|---|---|
| V1 | **High** | `RecordTransactionFlow.tsx` — the `change(form, [fields])` lists, `EVERY_FIELD`, the refusal keys each field reads (51) | **Which refusals an edit clears, and under which field a refusal shows.** Changing the Holding, the account, the card, the date or the terms could keep the old refusal on screen (hand-applied: the Holding's stays — all tests pass), a kind change could keep every refusal, and a refusal could show under the wrong field. |
| V2 | **High** | `transactionChecks.ts:95,141,172,208,222`, `allocation.ts:57`, `AllocationEditor.tsx:270`, `InvestmentBuyEntry.tsx:136` (17) | **The client checks at their edges:** a 0 amount or quantity, a ticker of spaces, a received amount of exactly 1 cent, a Goal share under the minimum — could pass (hand-applied: a 0 amount passes); a split of exactly 100% could show as over; the rate field could take a minus sign where it mustn't, or refuse one where a spread may be negative. |
| V3 | **High** | `setupApi.ts:135–207`, `manageFinances/api.ts:126,156` (21) | **A write could stop refreshing what it changed** (OQ-222's tags): Account, Category and Budget writes, and every transaction write's Month Overview / Accounts / Budgets / Goals. Hand-applied: a Category write refreshes nothing — all tests pass. |
| V4 | Medium | `BrowseTransactionsFlow.tsx:106,183,200,220,232`, `FilterPanel.tsx:49,188,407`, `ledgerFilters.ts:157`, `ledgerRow.ts:107,275`, `LedgerRow.tsx:53–55,166`, `ledgerPages.ts:38`, `browseState.ts`, `useBrowseTransactions.ts:70` (29) | **The ledger:** the day totals could vanish (hand-applied), USD before R$ (OQ-217), the Holding chip shown with no Holding filter, the delete spinner on every row, the delete failure lost, "Clear" sending garbage, a filter applied over a date-range error, the date presets lost, a blank description counted as one, a scheduled-post badge on every row, the row icon ignoring its Category. |
| V5 | Medium | `transactionForm.ts`, `transactionRequest.ts`, `recordTransactionState.ts`, `useRecordTransaction.ts`, `useRecordDrawer.ts`, `HoldingSelection.tsx:138,210,250`, `InvestmentBuyEntry.tsx:218,265`, `GoalAllocationEntry.tsx:46,74`, `manageFinances.ts:103`, the rest of `RecordTransactionFlow.tsx` (70) | **Record Transaction's state:** the chosen Holding never marked (hand-applied), a Holding's units or the split loaded again or never, the edit form built from a card row or a transfer wrongly, a locked edit's fields (date, received amount, quantity) unlocked or locked when they shouldn't be, an asset type kept after the currency changes, rate-type and interest-payment options missing, the drawer's "latest request" counter and its close. |
| V6 | Medium | `useRecordTransaction.ts:229`, `AllocationEditor.tsx:94,96,313`, `CardRail.tsx:84,116,215`, `GroupedList.tsx:266`, `stripScroll.ts` (17) | **Focus and the wheel:** focus on the first invalid field after a refused submit, focus into the split after "Add goal", focus handed between the rail's arrows and track, the end-of-list focus, and the period strip turning a vertical wheel into a horizontal scroll at its edges. |
| V7 | Medium | `railScroll.ts:92–114`, `CardRail.tsx:130` (10) | **The rail's paging arithmetic** (OQ-212: "none is skipped"): the edge tolerances and the inset in which card the next page starts from — off by a pixel or a sign, a card could be skipped or shown twice; the back arrow could page forward. |
| V8 | Medium | Field labels, `aria-label`s and search labels in the Record and Filter forms, `aria-invalid` on the Holding list, the Filter's "Clear / Select all" (21) | **Accessible names** (slice 2's W8 again): a control could lose its label, the floating Record button its name. |
| V9 | Low | `ManageFinancesExperience.tsx:102,139,300,341,344`, `useLedger.ts:66,89`, `ownership.ts:46,70`, `balanceCards.ts:73`, `GroupedList.tsx:129,131`, `MultiSelectPanel.tsx:74–188`, the kit's icon/tag slots, `PeriodBar.tsx:317`, `AllocationEditor.tsx:251`, `Amount.tsx:75`, `AuthLayout.tsx:93` (44) | The phone layout's Filter button, the rails shown while one query loads, the period bar's first year, a Holding filter from another household kept, the manage rule with no role, a card-only Account's balance, the infinite-scroll sentinel firing on any entry, the multi-select presets and group counts, icons and tags on chips, the month a strip item names. |
| V10 | Low | `FilterPanel.tsx:174,311`, `LedgerRow.tsx:126`, `GoalAllocationEntry.tsx:101`, `MultiSelectPanel.tsx:208`, `BrowseTransactionsFlow.tsx:65` (9) | Empty elements on the happy path: a count badge at 0, an empty error banner, a separator before the first item. |

#### Not gaps (231)

| Kind | Survivors | Why |
|---|---|---|
| Tailwind class strings, class arrays, `join(' ')`, SVG geometry | 155 | Styling — reviewed through Storybook (OQ-128) and the mockups, as in slices 1–2. |
| Secondary copy keys (descriptions, hints, captions, notes, placeholders) | 21 | Presentation; titles and actions are asserted (slice 1's rule). |
| Equivalent | 33 | Effect and callback dependency arrays; RTK `addTagTypes` (slice 1 W1); `useRole`'s default; a sentinel or key that only has to be consistent; a garbage tag on a failed read; conditional spreads checked with `toEqual`; a `change(form, [])` that clears nothing. |
| Defensive | 22 | `?? ''` on ledger fields the contract always sends; arrows already disabled at the year's ends; a `?? []` on pages that always carry totals; observers on elements always mounted. |

**Proposed order:** V1–V3 first (stale refusals, client checks at their
edges, lists not refreshed), then V4–V8, then V9–V10. One commit per group;
verified by a second `BASE=54c15d8` web run.

#### Fixed (2026-10-31) — all groups, stakeholder decision

Every group has its tests, each checked against its own mutants applied by
hand; the whole web suite passes and typechecks.

| Group | Where the tests went |
|---|---|
| V1 | `RecordTransactionFlow.test.tsx` — "which refusals a change clears": every change's list, each refusal under its field (a CDB asset button added to the buy stub) |
| V2 | `transactionChecks.test.ts` (0 amount and units, a ticker of spaces, 1 cent received, an edited sell), `AllocationEditor.test.tsx` (exactly 100% is full), `InvestmentBuyEntry.test.tsx` (a minus sign only on a spread above IPCA/IGP-M) |
| V3 | `setupApi.test.tsx` (every Account, Category and Budget write refreshes its list), `manageFinances/api.test.ts` (record, save and delete refresh the month) |
| V4 | `BrowseTransactionsFlow.test.tsx` (day totals, the delete spinner and failure, no Holding chip unfiltered), `ledgerRow`, `ledgerFilters`, `ledgerPages` (R$ first), `browseState`, `LedgerRow.test.tsx` (Category disc, schedule tag), `FilterPanel.test.tsx` (presets, From's error) |
| V5 | `transactionForm`, `transactionRequest` (card-row edit, no stale Holding), `RecordTransactionFlow.test.tsx` (reads loading, a stale split read ignored, no split for a cash event, one-currency transfer, quiet errors, the locks), `HoldingSelection`, `InvestmentBuyEntry`, `GoalAllocationEntry`, `ManageFinancesExperience.test.tsx` (a read landing after a close opens nothing) |
| V6 | `RecordTransactionFlow.test.tsx` (focus on the first invalid field, after the drawer's own first focus), `CardRail.test.tsx` (focus never taken from outside the arrows) |
| V7 | `railScroll.test.ts` — six geometries on the 1px tolerance, each way |
| V8 | the Kind, Holding, Rate, Interest paid, Card, To, Asset, Contract, search and date-range names; the floating Record button |
| V9 | `ManageFinancesExperience.test.tsx` (the phone's icon Filter, both Goal reads awaited, this household's date, no Holding read unfiltered), `balanceCards`, `ownership`, the chips' and choices' icons and tags (the dropdown branch too), the strip's January–December |
| V10 | no "0 selected", no dot before one currency, no empty banner, refusal or note |

**Proved equivalent or defensive while fixing** (the second run will show
them as survivors): V1 `receivedAmount` in `EVERY_FIELD` and the switch's
list (the field only comes back through a destination, which clears it);
V2 `allocation.ts:57` (`null < 1`); V3 `api.ts:126` (a transaction write also
invalidates `Accounts` and `Goals`); V4 `FilterPanel.tsx:188` (values off the
list are filtered), `useBrowseTransactions.ts:70`; V5
`recordTransactionState.ts:118,161,176`, `useRecordTransaction.ts:171,203`,
`transactionForm.ts:338,348`, `transactionRequest.ts:282,285,375`,
`manageFinances.ts:103`, `useRecordDrawer.ts:56,72,127`,
`RecordTransactionFlow.tsx:208` and the new-record halves of `:259,340,357`;
V6 the strip's wheel guards and listener (`stripScroll.ts`), the
`AllocationEditor` frame and `{ editor: false }`, `GroupedList.tsx:129,131,266`
(the sentinel renders only when armed), `CardRail.tsx:84` `from !== null`,
`:116,215`; V7 `railScroll.ts:114` `<` (the cut card is the fallback) and
`CardRail.tsx:130` (anything but forward is back); V9 the multi-select's
preset classes and Clear (styling; off-list values filtered), `:188`,
`AllocationEditor.tsx:251`, `Amount.tsx:75`, `ManageFinancesExperience.tsx:341,344`,
`useLedger.ts:66`, `ownership.ts:70`, `balanceCards.ts:73`'s non-card-only
halves, an empty tag pill (`ChoiceField`/`MultiChoiceField` `tag → true`),
`AuthLayout.tsx:93,96` (demo data).

**Second run (2026-10-31, `BASE=54c15d8`, no file failed):** 4,794 mutants,
4,480 killed, 3 timed out, **311 survived — 93.5%** (from 89.2%); none new.
Every survivor is a triaged non-gap or one listed above, plus a few narrower
spans of the same kind: `transactionChecks.ts:95,208,222` and `x === null →
false` (`null < 1` is still refused), `transactionForm.ts:360,381,453,465`
(`includes(undefined)` is false, every group has kinds, the Flow has its own
split source), `TransactionEntry.tsx:69`, `LedgerRow.tsx:166`,
`ledgerRow.ts:275` (card rows carry no source or Holding), `ledgerPages.ts:38`
and `ManageFinancesExperience.tsx:300` (defensive). It found two real ones
left: a Budget edit or create answering `budget.not_found` should still
refresh the list (`setupApi.ts:201,207`) — the edit now has its test (killed
by hand); the create can't answer that code (defensive).

## Where it stands (2026-10-31)

Branch `review/slice-3`, not pushed. Phase 1 is fixed in full and verified —
backend 94.0%, web 93.5%, no gap left.

1. **Done:** D1 (OQ-226) end to end — `archiveAccount`'s 409
   `account.holdings_open`, both catalogs, the contract and its page, FR-2.4,
   the uc-03 sequence and call chain, the Account Management Flow's message;
   backend B1–B19; web V1–V10.
2. **Next:** open phase 1's PR (both steps verified: backend 94.0%, web 93.5%).
3. **Then phase 2** (the Playwright suite) and **phase 3** (code and
   architecture — it also decides `monthOverview.ts`'s dead `'transfer'` in
   `LEFT_OUT`), each with its own PR; then R3 is ticked and slice 4 starts at
   task 123.
4. **Tooling notes:** the pre-commit `pnpm check` lints `.stryker-tmp/`, so
   commit only while no Stryker run is going (or after removing a leftover
   sandbox); don't hand-run tests during a web run (the memory watchdog stops
   it — resume with `RESUME=1`); in zsh pass test paths as separate words — a
   filter that finds no tests looks "killed".
