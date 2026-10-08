"""Apply the October 2026 call chain review (docs/architecture/06-call-chain-review-2026-10.md,
VBD Round 9) to docs/design/diagrams/call-chains/.

1. Every chain gets the Round 9 layout: GoalAccessor (was ObjectiveAccessor),
   new IndexRateAccessor, DashboardAccessor parked (v3).
2. investment-objectives/ -> goals/, archive/unarchive -> complete/reopen.
3. Changed chains are rewritten; 12 new chains are added.
Idempotent: rerunning produces the same output.
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


def edges_of(html: str) -> list:
    return json.loads(re.search(r"var edges = (\[.*?\]);", html).group(1))


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
write(GO / "uc-03-complete-goal.html", "Call Chain — Complete Goal", f"Use case 3 of 6 in {G}, FR-8.8. Lifecycle Transition (reversible). {REVIEW}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "acc-goal"), (3, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>GoalAccessor.complete(goalId)</code> → ③ <code>LoggingUtility</code> (async).",
       "Renamed from Archive Objective (OQ-78). Allocations and history stay — progress-by-month remains viewable."])
write(GO / "uc-04-reopen-goal.html", "Call Chain — Reopen Goal", f"Use case 4 of 6 in {G}, FR-8.9. Lifecycle Transition (reverse). {REVIEW}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "acc-goal"), (3, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>GoalAccessor.reopen(goalId)</code> → ③ <code>LoggingUtility</code> (async).", "Renamed from Unarchive Objective (OQ-78)."])
write(GO / "uc-06-view-goals.html", "Call Chain — View Goals", f"Use case 6 of 6 in {G}, FR-8.5/8.7. View. {ADDED}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-goal"), (3, "eng-reporting", "acc-holding"), (3, "eng-reporting", "acc-snapshot")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> (visibility) → ② <code>ReportingEngine.goalProgress</code> → ③ reads <code>GoalAccessor</code> (goals + allocations), <code>InvestmentHoldingAccessor</code> (fixed-term cost basis), <code>ValuationSnapshotAccessor</code> (market-priced values).",
       "Contributions come back per currency (OQ-49); the exchange-rate input is frontend-only (FR-9)."])

# ------------------------------------------------------------------ 3. changed chains
RT = CC / "record-transactions"
R = "the Record Transactions set (CUC-4)"
write(RT / "uc-01-record-transaction.html", "Call Chain — Record Transaction", f"Use case 1 of 5 in {R}, FR-3.1/3.8, FR-5.1/5.8, FR-8.2, FR-11. Create (+ cascade). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "util-validation"),
        (3, "mgr-transaction", "acc-account"), (3, "mgr-transaction", "acc-creditcard"),
        (4, "mgr-transaction", "acc-holding"), (5, "mgr-transaction", "eng-product"), (6, "eng-product", "acc-holding"),
        (7, "mgr-transaction", "acc-snapshot"), (8, "mgr-transaction", "acc-goal"), (9, "mgr-transaction", "acc-budget"),
        (10, "mgr-transaction", "acc-accounttxn"), (10, "mgr-transaction", "acc-cardtxn"), (11, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> (target narrows kinds; investments not on credit-card-only accounts, OQ-76) → ③ <code>AccountAccessor.applyMovement</code> or <code>CreditCardAccessor.applyChargeOrRefund / applyBillPayment</code> → ④ investment kinds: <code>InvestmentHoldingAccessor.applyTrade</code> (creates the Holding on a new ticker or any fixed-term buy; <strong>archives it with by=system when quantity reaches 0</strong>, OQ-72) → ⑤ fixed-term buy: <code>InvestmentProductEngine.schedule</code> → ⑥ <code>InvestmentHoldingAccessor.applySchedule</code> → ⑦ <code>ValuationSnapshotAccessor.insertAutomatic</code> → ⑧ <code>GoalAccessor.allocate</code> if allocations were bundled (OQ-54) → ⑨ <code>BudgetAccessor.accrueIfClaimed</code> → ⑩ the ledger write (<code>AccountTransactionAccessor</code> or <code>CardTransactionAccessor</code>) → ⑪ <code>LoggingUtility</code> (async).",
       "<strong>Removed (Round 9):</strong> the <code>NotificationDeliveryUtility</code> edge — it fired the budget-threshold alert removed by OQ-52; this diagram had kept it. Recurring templates are gone too (OQ-55).",
       "<strong>Smell check:</strong> widest fan-out in the system, all of it one Manager's own workflow decision + validated writes — no Manager↔Manager, no Engine↔Engine."])
write(RT / "uc-02-edit-transaction.html", "Call Chain — Edit Transaction", f"Use case 2 of 5 in {R}, FR-3.2, FR-5.2, FR-5.8. Edit (reverse + re-apply). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "util-validation"), (3, "mgr-transaction", "acc-accounttxn"), (3, "mgr-transaction", "acc-cardtxn"),
        (4, "mgr-transaction", "acc-account"), (4, "mgr-transaction", "acc-creditcard"), (5, "mgr-transaction", "acc-holding"),
        (6, "mgr-transaction", "acc-snapshot"), (7, "mgr-transaction", "acc-budget"), (8, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> → ③ read + update the ledger record → ④ reverse/re-apply the balance movement → ⑤ <code>InvestmentHoldingAccessor.applyTrade</code> (delta) then <code>unarchiveIfSystemArchived</code> if quantity is no longer 0 (OQ-80) → ⑥ <code>ValuationSnapshotAccessor.updateAutomatic</code> → ⑦ <code>BudgetAccessor</code> re-accrual → ⑧ <code>LoggingUtility</code> (async)."])
write(RT / "uc-03-delete-transaction.html", "Call Chain — Delete Transaction", f"Use case 3 of 5 in {R}, FR-3.2, FR-5.8. Lifecycle Transition (hard delete + reversal). {REVIEW}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "acc-accounttxn"), (2, "mgr-transaction", "acc-cardtxn"),
        (3, "mgr-transaction", "acc-account"), (3, "mgr-transaction", "acc-creditcard"), (4, "mgr-transaction", "acc-holding"),
        (5, "mgr-transaction", "acc-snapshot"), (6, "mgr-transaction", "acc-budget"), (7, "mgr-transaction", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> → ② read + delete the ledger record → ③ reverse the balance movement → ④ reverse the trade, <code>unarchiveIfSystemArchived</code> (OQ-80) → ⑤ <code>ValuationSnapshotAccessor.deleteAutomatic</code> → ⑥ reverse budget accrual → ⑦ <code>LoggingUtility</code> (async)."])
write(RT / "uc-04-browse-transactions.html", "Call Chain — Browse &amp; Filter Transactions", f"Use case 4 of 5 in {R}, FR-3.12. View (owned by TransactionManager — stakeholder decision, review Q1). {ADDED}",
      E((1, "mgr-transaction", "util-authz"), (2, "mgr-transaction", "acc-accounttxn"), (2, "mgr-transaction", "acc-cardtxn")),
      ["<strong>Chain:</strong> <code>TransactionManager</code> ① <code>AuthorizationUtility</code> (personal/shared visibility) → ② <code>AccountTransactionAccessor.list(filter, cursor)</code> + <code>CardTransactionAccessor.list(filter, cursor)</code>, merged newest-first.",
       "<strong>Owner: TransactionManager, not InsightsManager</strong> (stakeholder, review Q1): it's a simple filter over the ledger it owns — no transformation worth an Engine. Filters: kinds, accounts, cards, categories, holding, any date range."])
write(RT / "uc-05-view-month-overview.html", "Call Chain — View Month Overview", f"Use case 5 of 5 in {R}, FR-6.11, FR-6.6, FR-4.3, FR-8.5. View. {ADDED}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-accounttxn"), (3, "eng-reporting", "acc-cardtxn"),
        (3, "eng-reporting", "acc-account"), (3, "eng-reporting", "acc-creditcard"), (3, "eng-reporting", "acc-budget"), (3, "eng-reporting", "acc-goal"), (3, "eng-reporting", "acc-snapshot")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine.monthOverview(householdId, year, month)</code> → ③ reads ledgers (in/out/net per currency, 12-month strip — excluding own-account transfers and bill payments via the persisted <code>effect</code>), balances, budget periods, goal progress.",
       "Real transformation (aggregation across ledgers and months) — that's why this one goes through the Engine while Browse doesn't."])

TI = CC / "track-investments"
T = "the Track Investments &amp; Net Worth set (CUC-6)"
write(TI / "uc-02-edit-holding.html", "Call Chain — Edit Holding Goal Allocations", f"Use case 2 of 12 in {T}, FR-8.2/8.3. Edit. {REVIEW}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "acc-goal"), (3, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>GoalAccessor.replaceAllocations(holdingId, [...])</code> (rejects &gt; 100%, FR-8.3) → ③ <code>LoggingUtility</code> (async).",
       "<strong>Narrowed (Round 9):</strong> no snapshot write and no holding-field update any more — position is transaction-only, market value has its own use cases. Direction of control unchanged (OQ-48)."])
write(TI / "uc-03-archive-holding.html", "Call Chain — Archive Matured Holding", f"Use case 3 of 12 in {T}, FR-5.8. Lifecycle Transition (one-way, user-made). {REVIEW}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "acc-holding"), (3, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>InvestmentHoldingAccessor.archive(holdingId, by=user)</code> → ③ <code>LoggingUtility</code> (async).",
       "The notification that started this is then deleted by the frontend via Delete Notification (Insights UC-6) — keeps <code>AccountManager</code> off the inbox."])
write(TI / "uc-04-generate-scheduled-cash-event.html", "Call Chain — Generate Scheduled Investment Cash Event", f"Use case 4 of 12 in {T}, FR-11.3. System-Trigger. {REVIEW}",
      edges_of((TI / "uc-04-generate-scheduled-cash-event.html").read_text()),
      ["<strong>Chain:</strong> <code>investmentsDaily</code> (one daily cron for cash events + matured holdings, Manager review M6) → ① <code>InvestmentHoldingAccessor.findDueScheduleEntries(today)</code> → <code>ServiceBusUtility.publish(\"transaction.import.requested\")</code> (async) → ② <code>TransactionManager</code> subscribes and runs the full Record Transaction pipeline (see that chain), incl. auto-archive when a redemption zeroes the Holding.",
       "Tax amounts were computed by <code>InvestmentProductEngine</code> at buy time and stored with the schedule — the trigger never calls the Engine. The recurring-schedule trigger that used to share this shape is gone (OQ-55)."])
mv = lambda n, verb, method, note: write(TI / f"uc-0{n}-{verb}-market-value.html", f"Call Chain — {verb.capitalize()} Market Value", f"Use case {n} of 12 in {T}, FR-5.2. {'Create' if verb == 'record' else 'Edit' if verb == 'edit' else 'Lifecycle Transition'}. {ADDED}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "util-validation"), (3, "mgr-account", "acc-holding"), (4, "mgr-account", "acc-snapshot"), (5, "mgr-account", "util-logging", "a")),
      [f"<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> → ③ <code>InvestmentHoldingAccessor</code> (verify market-priced) → ④ <code>ValuationSnapshotAccessor.{method}</code> → ⑤ <code>LoggingUtility</code> (async).", note])
mv(5, "record", "insertManual", "Net worth and goal progress pick it up on read — nothing to recompute here.")
mv(6, "edit", "updateManual", "Rejects automatic (transaction-driven) snapshots — those change only with their transaction (OQ-56).")
mv(7, "delete", "deleteManual", "Same restriction as Edit; the previous snapshot becomes current if this was the latest.")
ir = lambda n, verb, method: write(TI / f"uc-{n:02d}-{verb}-index-rate.html", f"Call Chain — {verb.capitalize()} Index Rate", f"Use case {n} of 12 in {T}, FR-11.6. {'Create' if verb == 'record' else 'Edit' if verb == 'edit' else 'Lifecycle Transition'}. {ADDED}",
      E((1, "mgr-account", "util-authz"), (2, "mgr-account", "util-validation"), (3, "mgr-account", "acc-indexrate"), (4, "mgr-account", "util-logging", "a")),
      [f"<strong>Chain:</strong> <code>AccountManager</code> ① <code>AuthorizationUtility</code> → ② <code>ValidationUtility</code> → ③ <code>IndexRateAccessor.{method}</code> → ④ <code>LoggingUtility</code> (async).",
       "<code>IndexRateAccessor</code> is new in Round 9. Projections read the latest value on demand, so nothing downstream is recalculated here."])
ir(8, "record", "insert(index, value, asOf)")
ir(9, "edit", "update(id, value, asOf)")
ir(10, "delete", "delete(id)")
write(TI / "uc-11-notify-matured-holding.html", "Call Chain — Notify Matured Holding", f"Use case 11 of 12 in {T}, FR-5.8, FR-6.5. System-Trigger + subscriber. {ADDED}",
      E((1, "acc-holding", "util-servicebus", "a"), (2, "util-servicebus", "mgr-account", "a"), (3, "mgr-account", "util-notify"), (4, "mgr-account", "acc-holding"), (5, "mgr-account", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>investmentsDaily</code> (same daily cron as the scheduled cash events, Manager review M6) → ① <code>InvestmentHoldingAccessor.findMaturedWithPosition(today)</code> → <code>ServiceBusUtility.publish(\"holding.matured\")</code> (async) → ② <code>AccountManager</code> subscribes → ③ <code>NotificationDeliveryUtility.deliver</code> (in-app) → ④ <code>InvestmentHoldingAccessor.markMaturedNotified</code> → ⑤ <code>LoggingUtility</code> (async).",
       "Same trigger shape as the scheduled cash events (§3.2a); <code>AccountManager</code> already subscribes to <code>household.created</code>, so this adds no new kind of coupling."])
write(TI / "uc-12-view-investments.html", "Call Chain — View Investments", f"Use case 12 of 12 in {T}, FR-5.3/5.4, FR-5.9, FR-11.2, FR-11.6. View. {ADDED}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-holding"), (3, "eng-reporting", "acc-snapshot"), (3, "eng-reporting", "acc-accounttxn"), (3, "eng-reporting", "acc-account"),
        (4, "mgr-insights", "eng-product"), (5, "eng-product", "acc-indexrate")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine</code> (net worth + change, payout this month + 12-month series from dividend/interest transactions, allocations, coming due, positions) → ③ its reads → ④ <code>InvestmentProductEngine.project(holding)</code> per fixed-term holding → ⑤ <code>IndexRateAccessor.latest(index)</code>.",
       "<strong>Two Engines, side by side, never calling each other</strong> — the Manager composes both results. Payout is never stored (FR-5.9); projections are computed on read (FR-11.2)."])

INS = CC / "insights-reports"
write(INS / "uc-01-view-dashboard.html", "Call Chain — View Dashboard", f"Use case 1 of 6 in the Insights &amp; Reports set (CUC-8), FR-6.0. View (fixed panels, v1). {REVIEW}",
      E((1, "mgr-insights", "util-authz"), (2, "mgr-insights", "eng-reporting"), (3, "eng-reporting", "acc-account"), (3, "eng-reporting", "acc-creditcard"), (3, "eng-reporting", "acc-accounttxn"),
        (3, "eng-reporting", "acc-holding"), (3, "eng-reporting", "acc-snapshot"), (3, "eng-reporting", "acc-budget"), (3, "eng-reporting", "acc-goal")),
      ["<strong>Chain:</strong> <code>InsightsManager</code> ① <code>AuthorizationUtility</code> → ② <code>ReportingEngine</code> (net worth + change, coming due, payout series, balances, budgets over-budget first, goals) → ③ its reads.",
       "<strong>Round 9:</strong> no <code>DashboardAccessor</code> read — the v1 Dashboard is fixed (OQ-67); the accessor is parked for v3."])

IH = CC / "identity-household"
s = (IH / "uc-17-revoke-session.html").read_text()
ed = edges_of(s)
if not any(e.get("note") == "all" for e in ed):
    pass
write(IH / "uc-17-revoke-session.html", None, None, None,
      ["<strong>Chain:</strong> <code>IdentityManager</code> → <code>SessionAccessor.revoke(sessionId)</code> — or, for the \"sign out all others\" variant (FR-1.3, Round 9), <code>SessionAccessor.deleteAllExceptCurrent(userId, currentSessionId)</code>. Same edge, different method.",
       REVIEW])
write(IH / "uc-21-list-my-households.html", "Call Chain — List My Households", f"Use case 21 of 21 in the Identity &amp; Household set (CUC-1), FR-1.8. View. {ADDED}",
      E((1, "mgr-identity", "acc-household"), (2, "mgr-identity", "acc-invitation")),
      ["<strong>Chain:</strong> <code>IdentityManager</code> ① <code>HouseholdAccessor.listForUser(userId)</code> (name, role, member count) → ② <code>InvitationAccessor.listPendingForUser(userId)</code> (household, inviter, role).",
       "Identity views stay in <code>IdentityManager</code>, same as View Sessions. Switching the active household is client-side."])
print("done")
