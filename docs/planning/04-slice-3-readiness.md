# Slice 3 readiness — gaps found before building

A pass over everything slice 3 (tasks 99–122: `A7`, `A8`, `E1`, `E2`, `M3`,
`M4`, the kit pieces, `FL15`–`FL17`, `X6`, `I3`, `I4`, `I9`) depends on — the
requirements, the VBD/EBD docs, the contract, the data model, the sequence
diagrams, the mockups and the code already built — done on 2026-10-23,
while R2 (slice 2's review) runs. The goal: settle every question now, so
the slice's tasks run without stopping to ask.

**Status: closed — every decision answered (2026-10-23, OQ-201), the
fixes and drift applied in one PR before task 99:** requirements and
glossary, data model + ERD, the contract (+ regenerated types and API
page), VBD (§2–§5) + component diagram, EBD, BDT plan, the plan, the
contract-routes test, the sequence / call-chain / use-case / EBD diagrams
through their generators, and mockups 30–35 (35 new: the sell drawer).
Each decision below ends with the **answer**.

## How to read this

- **Decisions (D)** need the stakeholder: two reasonable answers exist and
  the requirements don't pick one. Each has a recommendation.
- **Fixes (F)** have one right answer that follows from decisions already
  made; they're applied without asking unless the stakeholder objects.
- **Drift (R)** is docs disagreeing with each other or with the code — fixed
  in the same PR.

## Decisions

### Money movement

- **D1 — An investment trade moves the account's cash.** The pipeline
  (VBD §3.1, `uc-01`) sends `investment_trade` only to
  `InvestmentHoldingAccessor.applyTrade`; nothing debits the account on a
  buy or credits it on a sell/redemption. Yet FR-6.11/OQ-74 count buys and
  sells as the account's outflow/inflow and mockup 32 says "Leaves the
  account · becomes a Holding". **Recommendation:** a buy also calls
  `AccountAccessor.applyMovement(−amount)`, a sell/redemption `+amount` —
  the same anchor rule as any movement (OQ-169: a buy dated before the
  starting balance only fills history, which is exactly the onboarding
  story OQ-169 describes). **Answer: yes, cash moves.**
- **D2 — What a transfer is.** Today `transfer_sent` and
  `transfer_received` are two unrelated kinds: moving R$500 from Checking
  to Savings means recording two transactions, and forgetting one leaves a
  balance wrong. **Recommendation:** one Transfer entry with From and To
  accounts writes both sides in one call, linked (a shared `transfer_id`);
  editing or deleting either side changes both. The two kinds stay as the
  sides' labels. **Answer: no — two separate entries, as today.** Each
  side is recorded on its own account; `effect = transfer` keeps both out
  of In/Out (FR-3.6).
- **D3 — Transfers across currencies** (BRL account → USD account). No FX
  conversion exists anywhere (FR-2.2). **Recommendation:** a paired
  transfer needs both accounts in one currency; across currencies the user
  enters the amount that left and the amount that arrived (two amounts,
  still one linked pair) — nothing is converted, both are typed.
  **Answer: moot** — with two separate entries (D2) each side is in its
  own account's currency.
- **D4 — Which kinds take a category (and so count in Budgets).**
  `accrueIfClaimed` runs for every transaction, so a categorized deposit or
  investment buy would count as spend. **Recommendation:** a category only
  on cash kinds (deposit, withdrawal, boleto, Pix) and card charge/refund;
  transfers, bill payments and investment kinds take none. Money coming
  back in the same category (a refund, a Pix receipt tagged Groceries)
  **reduces** that Budget's spend. **Answer: every kind may take a
  category, and money coming in reduces spend** — a Budget's spend is out
  − in per claimed category. A categorized bill payment would count its
  charges twice (FR-4.5); as the data model already says, that is left to
  the user not tagging it — no special case.
- **D5 — Can a `credit_card_only` account take cash kinds** (deposit,
  withdrawal, Pix)? It has a starting balance (FR-2.1) but exists to hold
  cards. **Recommendation:** no — only bill payments (from another account,
  to its card) and its cards' charges/refunds; its balance stays its
  starting balance. **Answer: no.**

### Editing and deleting

- **D6 — What can change on Edit.** The contract allows date, amount,
  category, subcategory, description. **Recommendation:** kind and target
  (account/card/holding) never change — delete and record again; an
  investment buy/sell also edits its quantity; a fixed-term buy also its
  rate, due date and debenture flag (its schedule is recomputed while no
  entry has posted, OQ-171). Allocations stay Edit Holding's (OQ-54).
  **Answer: as recommended.**
- **D7 — Deleting the buy that created a Holding.** Reversing it leaves an
  empty Holding with no transactions. **Recommendation:** when nothing
  else references it (no other transaction), the Holding goes with its buy
  — its automatic snapshots, schedule and Goal split too; if other
  transactions reference it, the delete is refused (409) until they go.
  **Answer: as recommended.**
- **D8 — Edit/delete after the schedule has started.** A fixed-term buy
  whose first interest/redemption entry already posted. **Recommendation:**
  amount/date/rate/due date edits and the delete are refused (409
  `transaction.schedule_started`); description and category still edit.
  **Answer: as recommended.**
- **D9 — Transactions the daily job posted** (`source = schedule`).
  **Recommendation:** fully editable like any other (the projected amount
  becomes the real one the bank paid) and deletable; deleting one does not
  re-post it. **Answer: as recommended.**

### Investments (`E1` InvestmentProductEngine)

- **D10 — How sell, redemption, dividend, interest and tax name their
  Holding.** The contract uses `ticker`, but fixed-term buys always create
  a new Holding (OQ-50), so a ticker can match several. **Recommendation:**
  those five kinds take a `holdingId` (picked from the account's Holdings);
  only a buy takes asset type + ticker. **Answer: as recommended.**
- **D11 — Quantity of a fixed-term buy.** A CDB has no natural unit count.
  **Recommendation:** optional for fixed-term (defaults to 1 unit); the
  amount is what counts; Tesouro Direto may still type its fractional
  titles. **Answer: as recommended.**
- **D12 — Interest schedule.** FR-11.2 says "periodic interest where
  applicable", but nothing captures when a given contract pays (a CDB pays
  at maturity, a debenture or CRI often monthly, Tesouro IPCA+ with coupons
  semi-annually — it varies per contract). **Recommendation:** a new buy
  field `interestPayment`: `at_maturity` (default) / `monthly` /
  `semiannual`. **Answer: as recommended.**
- **D13 — Day count.** Brazilian fixed income accrues over business days
  (252/year, national holidays excluded); US over calendar days.
  **Recommendation:** Brazil on business days with the national holidays
  coded in the Engine (a fixed list + Easter-based dates — reference data,
  extendable); US on actual/365. **Answer: as recommended.**
- **D14 — Amounts of index-linked cash events** (110% CDI, IPCA + 5%). The
  real amount depends on future index values. **Recommendation:** projected
  at buy time with the latest index value (as `project` already does),
  marked as estimates; posted as projected; the user edits a posted one to
  what the bank paid (D9). IOF (only under 30 days) is not modelled in v1.
  At maturity three entries post: interest (gross), tax, redemption
  (principal, zeroing the quantity). **Answer: as recommended.**

### Month Overview (`M4`, `FL17`)

- **D15 — A mixed-currency Goal on the Goal rail.** The exchange rate lives
  only in Goal Management's Flow (FR-9, never stored). **Recommendation:**
  the rail shows the progress of what is in the Goal's own currency and a
  "needs an exchange rate — open Goals" note when other currencies fund it;
  no second rate input. **Answer: as recommended.**
- **D16 — A credit card's figure on the Balance rail for a month.**
  **Recommendation:** the outstanding balance at that month's end (what is
  owed), labelled "Outstanding" as in mockup 30 — not the cycle's own
  charges. **Answer: as recommended.**

## Fixes (follow from decisions already made)

- **F1 — Who created a transaction.** `decide` lets a Member edit/delete
  what they created on shared data (OQ-111), but `account_transactions` and
  `card_transactions` have no creator column. Add `created_by_user_id`
  (nullable — schedule posts have none; Delete User nulls it, FR-1.17).
- **F2 — Undo data for trades** (already flagged by OQ-171): add
  `quantity_delta` and `cost_basis_delta` to `account_transactions`.
- **F3 — Bill payment needs both ids.** `TransactionCreateRequest` says
  "exactly one of accountId/creditCardId", but a bill payment is an Account
  Transaction carrying its card (FR-3.7). Rule: a card target takes
  `creditCardId` alone; a bill payment takes `accountId` + `creditCardId`.
- **F4 — Reading/editing a Card Transaction.** `GET/PATCH
  …/transactions/{id}` answer only `AccountTransaction`. Both answer
  `LedgerItem` (either ledger, by id — ids are UUIDs across both tables).
- **F5 — Error responses missing from the contract.** Record/Edit/Delete
  list no 404 and few codes. Add: 404 `transaction.not_found`,
  `account.not_found`, `holding.not_found`; 409 `account.archived`,
  `holding.insufficient_quantity`, `holding.cost_basis_below_zero`,
  `transaction.schedule_started`; 422 `transaction.kind_not_allowed_for_target`,
  `transaction.currency_mismatch`, `category.archived`,
  `transaction.subcategory_mismatch`.
- **F6 — What a ledger row shows.** `AccountTransaction` lacks the trade's
  `quantity`, and the Holding's `ticker`/`assetType` that the row and the
  pre-filled edit form need. Added to the read.
- **F7 — Month headers.** Mockup 30's month header says "7 transactions";
  `TransactionPage` carries day totals only. Add month counts for the months
  in the page, computed over the whole filtered set (not just the page), the
  same as day totals.
- **F8 — Filter semantics** (FR-3.12): Account/Card is one picker — the
  selected accounts and cards together (empty = all); a Category includes
  its Subcategories; criteria combine with AND.
- **F9 — Month Overview budgets.** `MonthOverviewReport.budgets` is
  `BudgetPeriod[]`, which has no Budget id, name, currency or visibility.
  Each item gets them; a Budget with no period opened that month shows the
  target in effect (latest period before it, OQ-166) and zero spend.
- **F10 — Archived things.** No transaction on an archived Account (OQ-169)
  or its cards; a new transaction can't use an archived Category, while an
  edit may keep the one it already has (same rule as Budget targets,
  OQ-176). Archived Accounts are left off the Balance rail.
- **F11 — `M4`'s scope across slices.** The plan has one `M4` task, but
  the contract-routes test says reports land in slice 5. Slice 3 builds
  what slice 3 shows: `month-overview`, `goal-progress` (+ by month) and
  the Holding reads with projections (FL15 needs the account's Holdings
  for D10). `investments-overview` and `payouts` land with `X7` (slice 4);
  the dashboard, notification inbox and audit-log export routes with slice
  5. The plan and the contract-routes test get those entries.
- **F12 — `GET …/credit-cards/{id}/transactions`** duplicates Browse with
  `creditCardIds` and has no caller in v1. Dropped from the contract.
- **F13 — The "Import" button** on mockup 30 is Open Banking (v2, OQ-69):
  not rendered.
- **F14 — E2E tiers for slice 3 (`I9`).** Core #5 ends on the Dashboard,
  which is slice 5: in `I9` it checks the Month Overview and Budget rail
  instead, and gains the Dashboard check in `I11`. Core #7 (backdated edit)
  and #11 (sell all, delete the sell) are `I9`'s. Smoke #4 (record → the
  balance moves) lands here. #6 (fixed-term buy) is split: the Holding and
  schedule in `I9`, the projection on the Holdings view in `I10`.
- **F15 — Contract tidy-ups.** `reportType` is declared twice on
  `/reports/{reportType}` with different enums (path-level v2 list vs the
  operation's v1 list) — keep the v1 list. `yearStrip.month` is an integer
  while payout series use a string month — both become `YYYY-MM` strings.

## Drift

- **R1** OQ-39 still says investment kinds apply only to investment
  accounts; OQ-76 superseded that (any account but `credit_card_only`).
- **R2** VBD §3.3's `TransactionManager` row calls `GoalAccessor.allocate`;
  it's `findByIds` + `listAllocations` + `replaceAllocations` (OQ-168).
- **R3** `uc-02`/`uc-03` (Edit/Delete Transaction) miss D1's cash leg, the
  schedule recompute (OQ-171), D7 and D8; `uc-01` misses D1, D5 and D10.
  Regenerated through `gen_record_transactions.py`.
- **R4** The EBD Record Transaction Flow designs only the buy entry
  (Investment Buy Entry); sell/redemption/dividend/interest/tax need a
  Holding picker (D10), and a fixed-term buy the interest-payment field
  (D12) — added to the EBD doc and `manage-finances-record-transaction`.
- **R5** Mockup 34 (mobile) still shows a month-scoped ledger title and a
  "Monthly" tag (recurring, removed by OQ-55) — known; the build follows
  page 30.
