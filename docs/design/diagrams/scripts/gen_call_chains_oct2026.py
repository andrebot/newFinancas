"""Apply the October 2026 call chain review (docs/architecture/06-call-chain-review-2026-10.md,
VBD Round 9) to docs/design/diagrams/call-chains/.

1. Every chain gets the Round 9 layout: GoalAccessor (was ObjectiveAccessor),
   new IndexRateAccessor, DashboardAccessor parked (v3).
2. investment-objectives/ -> goals/, archive/unarchive -> complete/reopen.
3. Changed chains are rewritten; 12 new chains are added.
Idempotent: rerunning produces the same output. A chain a later generator has
taken over (gen_goals.py, gen_track_investments.py,
gen_identity_code_sync_oct2026.py) is no longer written here, so a rerun never
rolls it back: every page has exactly one writer.
"""
import json
import pathlib
import re

CC = pathlib.Path(__file__).parent.parent / "call-chains"
TEMPLATE = CC / "track-investments" / "uc-02-edit-holding.html"
LAYOUT_RE = re.compile(r'<div class="architecture">.*?(?=<div class="legend">)', re.S)
REVIEW = 'Updated in the Oct 2026 call chain review (<code>docs/architecture/06-call-chain-review-2026-10.md</code>, VBD Round 9).'
ADDED = 'Added in the Oct 2026 call chain review (<code>docs/architecture/06-call-chain-review-2026-10.md</code>, VBD Round 9).'


def round9_layout(block: str) -> str:
    """Normalise whitespace and apply the Round 9 accessor changes to a layout block."""
    block = re.sub(r'(<div class="col-label">[^<]*</div>)\s+(?=<div class="col-label">)', r"\1", block)
    block = re.sub(r'(<div class="box empty-slot">—</div>)\s+(?=<div class="box empty-slot">)', r"\1", block)
    block = re.sub(r"\n\s*\n", "\n", block)
    if 'id="acc-indexrate"' not in block:
        block = block.replace('<div class="box accessor" id="acc-objective">ObjectiveAccessor</div>',
                              '<div class="box accessor" id="acc-goal">GoalAccessor</div>\n            <div class="box accessor" id="acc-indexrate">IndexRateAccessor</div>')
    block = block.replace('<div class="box accessor" id="acc-dashboard">DashboardAccessor</div>',
                          '<div class="box parked" id="acc-dashboard">DashboardAccessor (parked, v3)</div>')
    return block


def set_chain(html: str, title=None, subtitle=None, edges=None, notes=None) -> str:
    """Replace title / subtitle / edges / notes in a call-chain page."""
    if title:
        html = re.sub(r"<title>.*?</title>", f"<title>{title} — New Finance App</title>", html, count=1)
        html = re.sub(r"<h1>.*?</h1>", f"<h1>{title}</h1>", html, count=1)
    if subtitle:
        html = re.sub(r'<p class="subtitle">.*?</p>', f'<p class="subtitle">{subtitle}</p>', html, count=1, flags=re.S)
    if edges is not None:
        html = re.sub(r"var edges = \[.*?\];", "var edges = " + json.dumps(edges) + ";", html, count=1)
    if notes is not None:
        body = "\n".join(f"    <p>{n}</p>" for n in notes)
        html = re.sub(r'<div class="notes">.*?</div>', f'<div class="notes">\n{body}\n  </div>', html, count=1, flags=re.S)
    return html


def E(*spec):
    """Edges from compact tuples: (order, from, to[, 'a'])."""
    out = []
    for t in spec:
        order, frm, to = t[:3]
        out.append({"from": frm, "to": to, "type": "async" if len(t) > 3 else "sync", "order": order})
    return out


def write(path: pathlib.Path, title, subtitle, edges, notes):
    path.parent.mkdir(parents=True, exist_ok=True)
    base = path.read_text() if path.exists() else TEMPLATE.read_text()
    path.write_text(set_chain(base, title, subtitle, edges, notes))


# ------------------------------------------------------------------ 1. layout everywhere
for f in CC.rglob("*.html"):
    s = f.read_text()
    s = LAYOUT_RE.sub(lambda m: round9_layout(m.group(0)), s, count=1)
    s = s.replace('"acc-objective"', '"acc-goal"').replace("'acc-objective'", "'acc-goal'")
    for x, y in [("ObjectiveAccessor", "GoalAccessor"), ("Investment Objectives", "Goals"), ("Objectives", "Goals"), ("Objective", "Goal"), ("objectives", "goals"), ("objective", "goal")]:
        s = s.replace(x, y)
    s = re.sub(r"\b([Aa])n Goal", r"\1 Goal", s)
    f.write_text(s)

# ------------------------------------------------------------------ 2. Goals rename
old, GO = CC / "investment-objectives", CC / "goals"
if old.exists():
    GO.mkdir(exist_ok=True)
    for f in old.glob("*.html"):
        t = f.read_text()
        for a, b in [("Investment Objectives", "Goals"), ("ObjectiveAccessor", "GoalAccessor"), ("Objectives", "Goals"), ("Objective", "Goal"), ("objectives", "goals"), ("objective", "goal")]:
            t = t.replace(a, b)
        t = re.sub(r"\b([Aa])n Goal", r"\1 Goal", t)
        (GO / f.name.replace("objective", "goal")).write_text(t)
        f.unlink()
    old.rmdir()
for stale, new in [("uc-03-archive-goal.html", "uc-03-complete-goal.html"), ("uc-04-unarchive-goal.html", "uc-04-reopen-goal.html")]:
    if (GO / stale).exists():
        (GO / stale).rename(GO / new)
for f in GO.glob("*.html"):
    t = re.sub(r"Use case (\d) of 5 in the Goals set", r"Use case \1 of 6 in the Goals set", f.read_text())
    f.write_text(t)
G = "the Goals set (CUC-10)"
# Complete / Reopen / View Goals (uc-03, uc-04, uc-06) are gen_goals.py's since M2 part 4.

# ------------------------------------------------------------------ 3. changed chains
RT = CC / "record-transactions"
R = "the Record Transactions set (CUC-4)"
write(RT / "uc-01-record-transaction.html", "Call Chain — Record Transaction", f"Use case 1 of 5 in {R}, FR-3.1/3.8, FR-5.1/5.8, FR-8.2, FR-11. Create (+ cascade). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "util-validation"), (2, "mgr-transaction", "acc-category"),
        (3, "mgr-transaction", "acc-account"), (3, "mgr-transaction", "acc-creditcard"),
        (4, "mgr-transaction", "acc-holding"), (5, "mgr-transaction", "eng-product"), (5, "eng-product", "acc-indexrate"), (6, "mgr-transaction", "acc-holding"),
        (7, "mgr-transaction", "acc-snapshot"), (8, "mgr-transaction", "acc-goal"), (9, "mgr-transaction", "acc-budget"),
        (10, "mgr-transaction", "acc-accounttxn"), (10, "mgr-transaction", "acc-cardtxn"), (11, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> (target narrows kinds; investments not on credit-card-only accounts, OQ-76, nor cash kinds — OQ-201) and <code>CategoryAccessor</code> (a new archived Category is refused, OQ-201) → ③ <code>AccountAccessor.applyMovement</code> or <code>CreditCardAccessor.applyMovement</code> (a bill payment calls both, OQ-15; <strong>every trade moves the account's cash too</strong>, OQ-201) → ④ investment kinds (non-buy kinds name the Holding by id, OQ-201): <code>InvestmentHoldingAccessor</code> — <code>insert</code> on any fixed-term buy, or <code>findByTicker</code> then <code>insert</code> on a new ticker (a zeroed one is reopened, OQ-171); <code>applyTrade</code> with the Manager's quantity and cost-basis deltas; <strong><code>archive(by=system)</code> when quantity reaches 0</strong>, OQ-72 → ⑤ fixed-term buy: <code>InvestmentProductEngine.schedule</code> (reads <code>IndexRateAccessor.latest</code> itself for an index-linked rate; interest-payment terms, business-day count — OQ-201) → ⑥ <code>InvestmentHoldingAccessor.applySchedule</code> → ⑦ <code>ValuationSnapshotAccessor.insertAutomatic</code> → ⑧ if allocations were bundled (OQ-54): <code>GoalAccessor.findByIds</code> + <code>listAllocations</code>, then <code>replaceAllocations</code> with the split re-weighted by value at the buy's price (OQ-168) → ⑨ <code>BudgetAccessor.accrueIfClaimed</code> (signed: money in subtracts, OQ-201) → ⑩ the ledger write, with the trade's deltas and the recorder (<code>AccountTransactionAccessor</code> or <code>CardTransactionAccessor</code>) → ⑪ <code>LoggingUtility</code> (async).",
       "<strong>Removed (Round 9):</strong> the <code>NotificationDeliveryUtility</code> edge — it fired the budget-threshold alert removed by OQ-52; this diagram had kept it. Recurring templates are gone too (OQ-55).",
       "<strong>Smell check:</strong> widest fan-out in the system, all of it one Manager's own workflow decision + validated writes — no Manager↔Manager, no Engine↔Engine."])
write(RT / "uc-02-edit-transaction.html", "Call Chain — Edit Transaction", f"Use case 2 of 5 in {R}, FR-3.2, FR-5.2, FR-5.8. Edit (reverse + re-apply). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "util-validation"), (2, "mgr-transaction", "acc-category"), (3, "mgr-transaction", "acc-accounttxn"), (3, "mgr-transaction", "acc-cardtxn"),
        (4, "mgr-transaction", "acc-account"), (4, "mgr-transaction", "acc-creditcard"), (5, "mgr-transaction", "acc-holding"), (5, "mgr-transaction", "eng-product"), (5, "eng-product", "acc-indexrate"),
        (6, "mgr-transaction", "acc-snapshot"), (7, "mgr-transaction", "acc-budget"), (8, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> (values change, never identity — OQ-201) + <code>CategoryAccessor</code> → ③ read + update the ledger record → ④ reverse/re-apply the balance movement (a trade's cash leg too, OQ-201) → ⑤ <code>InvestmentHoldingAccessor.applyTrade</code> (quantity and cost-basis deltas) then <code>unarchiveIfSystemArchived</code> if quantity is no longer 0 (OQ-80); a fixed-term buy whose schedule hasn't started: <code>InvestmentProductEngine.schedule</code> + <code>applySchedule</code> (a started one keeps its terms — 409) → ⑥ <code>ValuationSnapshotAccessor.updateAutomatic</code> → ⑦ <code>BudgetAccessor</code> re-accrual, signed → ⑧ <code>LoggingUtility</code> (async)."])
write(RT / "uc-03-delete-transaction.html", "Call Chain — Delete Transaction", f"Use case 3 of 5 in {R}, FR-3.2, FR-5.8. Lifecycle Transition (hard delete + reversal). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "acc-accounttxn"), (2, "mgr-transaction", "acc-cardtxn"),
        (3, "mgr-transaction", "acc-account"), (3, "mgr-transaction", "acc-creditcard"), (4, "mgr-transaction", "acc-holding"), (4, "mgr-transaction", "acc-goal"),
        (5, "mgr-transaction", "acc-snapshot"), (6, "mgr-transaction", "acc-budget"), (7, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② read + delete the ledger record (<code>countForHolding</code> for a buy — OQ-201) → ③ reverse the balance movement (a trade's cash leg too) → ④ reverse the trade, <code>unarchiveIfSystemArchived</code> (OQ-80) — or, for the buy that created a Holding nothing else references, <code>GoalAccessor.replaceAllocations(…, [])</code> and <code>InvestmentHoldingAccessor.delete</code> (OQ-201) → ⑤ <code>ValuationSnapshotAccessor.deleteAutomatic</code> → ⑥ reverse budget accrual, signed → ⑦ <code>LoggingUtility</code> (async).",
       "A fixed-term buy whose schedule has posted can't be deleted (409 <code>transaction.schedule_started</code>); a buy whose Holding other transactions reference is refused (409 <code>transaction.holding_in_use</code>)."])
write(RT / "uc-04-browse-transactions.html", "Call Chain — Browse &amp; Filter Transactions", f"Use case 4 of 5 in {R}, FR-3.12. View (owned by TransactionManager — stakeholder decision, review Q1). {ADDED}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "acc-accounttxn"), (2, "mgr-transaction", "acc-cardtxn")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> (personal/shared visibility) → ② <code>AccountTransactionAccessor.list(filter, cursor)</code> + <code>CardTransactionAccessor.list(filter, cursor)</code>, merged newest-first, with day totals and month counts over the whole filtered set (OQ-201).",
       "<strong>Owner: TransactionManager, not InsightsManager</strong> (stakeholder, review Q1): it's a simple filter over the ledger it owns — no transformation worth an Engine. Filters: kinds, accounts, cards, categories, holding, any date range."])
write(RT / "uc-05-view-month-overview.html", "Call Chain — View Month Overview", f"Use case 5 of 5 in {R}, FR-6.11, FR-6.6, FR-4.3, FR-8.5. View. {ADDED}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-accounttxn"), (3, "eng-reporting", "acc-cardtxn"),
        (3, "eng-reporting", "acc-account"), (3, "eng-reporting", "acc-creditcard"), (3, "eng-reporting", "acc-budget"), (3, "eng-reporting", "acc-goal"), (3, "eng-reporting", "acc-snapshot")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine.monthOverview(householdId, year, month)</code> → ③ reads ledgers (in/out/net per currency, 12-month strip — excluding own-account transfers and bill payments via the persisted <code>effect</code>), month-end Account balances and card outstanding (OQ-201), the Budgets with their target in effect and spend, goal progress.",
       "Real transformation (aggregation across ledgers and months) — that's why this one goes through the Engine while Browse doesn't."])

TI = CC / "track-investments"
T = "the Track Investments &amp; Net Worth set (CUC-6)"
# Edit Holding (uc-02) and Archive Holding (uc-03) are gen_track_investments.py's.
write(TI / "uc-04-generate-scheduled-cash-event.html", "Call Chain — Generate Scheduled Investment Cash Event", f"Use case 4 of 12 in {T}, FR-11.3. System-Trigger. {REVIEW}",
      E((1, "acc-holding", "util-servicebus", "a"), (2, "util-servicebus", "mgr-transaction", "a"), (3, "mgr-transaction", "acc-holding"),
        (4, "mgr-transaction", "acc-accounttxn"), (5, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>investmentsDaily</code> (one daily cron for cash events + matured holdings, Manager review M6) → ① <code>InvestmentHoldingAccessor.findDueScheduleEntries(today)</code> → <code>ServiceBusUtility.publish(\"transaction.import.requested\")</code> (async) → ② <code>TransactionManager</code> subscribes → ③ <code>InvestmentHoldingAccessor.markEntryPosted(entryId)</code> (once — a repeated delivery stops here, OQ-171) → ④ the full Record Transaction pipeline (see that chain) in the same database transaction, incl. auto-archive when a redemption zeroes the Holding → ⑤ <code>LoggingUtility</code> (async).",
       "Amounts and taxes were computed by <code>InvestmentProductEngine</code> at buy time and stored with the schedule — index-linked ones are projections the user corrects once posted (OQ-201); at maturity interest, tax and redemption post as three entries. The trigger never calls the Engine. The recurring-schedule trigger that used to share this shape is gone (OQ-55)."])
# Market values (uc-05..07), index rates (uc-08..10) and Notify Matured Holding (uc-11)
# are gen_track_investments.py's.
write(TI / "uc-12-view-investments.html", "Call Chain — View Investments", f"Use case 12 of 12 in {T}, FR-5.3/5.4, FR-5.9, FR-11.2, FR-11.6. View. {ADDED}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-holding"), (3, "eng-reporting", "acc-snapshot"), (3, "eng-reporting", "acc-accounttxn"), (3, "eng-reporting", "acc-account"),
        (4, "mgr-insights", "eng-product"), (5, "eng-product", "acc-indexrate")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine</code> (net worth + change, payout this month + 12-month series from dividend/interest transactions, allocations, coming due, positions) → ③ its reads → ④ <code>InvestmentProductEngine.project(holding)</code> per fixed-term holding → ⑤ <code>IndexRateAccessor.latest(householdId, index)</code>.",
       "<strong>Two Engines, side by side, never calling each other</strong> — the Manager composes both results. Payout is never stored (FR-5.9); projections are computed on read (FR-11.2)."])

INS = CC / "insights-reports"
write(INS / "uc-01-view-dashboard.html", "Call Chain — View Dashboard", f"Use case 1 of 6 in the Insights &amp; Reports set (CUC-8), FR-6.0. View (fixed panels, v1). {REVIEW}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-account"), (3, "eng-reporting", "acc-creditcard"), (3, "eng-reporting", "acc-accounttxn"),
        (3, "eng-reporting", "acc-holding"), (3, "eng-reporting", "acc-snapshot"), (3, "eng-reporting", "acc-budget"), (3, "eng-reporting", "acc-goal")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine</code> (net worth + change, coming due, payout series, balances, budgets over-budget first, goals) → ③ its reads.",
       "<strong>Round 9:</strong> no <code>DashboardAccessor</code> read — the v1 Dashboard is fixed (OQ-67); the accessor is parked for v3."])

IH = CC / "identity-household"
# Revoke Session (uc-17) is gen_identity_code_sync_oct2026.py's.
write(IH / "uc-21-list-my-households.html", "Call Chain — List My Households", f"Use case 21 of 21 in the Identity &amp; Household set (CUC-1), FR-1.8. View. {ADDED}",
      E((1, "mgr-identity", "acc-household"), (2, "mgr-identity", "acc-invitation")),
      ["<strong>Chain:</strong> <code>IdentityManager</code> ① <code>HouseholdAccessor.listForUser(userId)</code> (name, role, member count) → ② <code>InvitationAccessor.listPendingForUser(userId)</code> (household, inviter, role).",
       "Identity views stay in <code>IdentityManager</code>, same as View Sessions. Switching the active household is client-side."])
print("done")
