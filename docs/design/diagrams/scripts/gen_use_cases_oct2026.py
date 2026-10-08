"""Apply the October 2026 use case review (docs/architecture/05-use-case-review-2026-10.md)
to docs/design/diagrams/use-cases/: defer 3, rename Objectives -> Goals, rewrite/patch changed
use cases, add 12 new ones. Idempotent: rerunning rewrites the same output.
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from uc_lib import system_use_case, use_case  # noqa: E402

UC = pathlib.Path(__file__).parent.parent / "use-cases"
REVIEW = "Updated in the Oct 2026 use case review (<code>docs/architecture/05-use-case-review-2026-10.md</code>)."
ADDED = "Added in the Oct 2026 use case review (<code>docs/architecture/05-use-case-review-2026-10.md</code>)."
S, E = "Start", "End"
REQ = ["Receive request"]
TAIL_BE = ["Record the action (log)", "Send response"]


def sub(n, total, set_name, cuc, traces, extra=REVIEW):
    """Standard subtitle line."""
    return (f"Use case {n} of {total} in the {set_name} set (<code>docs/requirements/01-core-use-cases.md</code>, "
            f"{cuc}). Traces to {traces}. High-level activity view only — no component names or API details yet. {extra}")


def patch(path, replacements, note=None):
    """In-place text replacements on an existing diagram, plus an optional note paragraph."""
    s = path.read_text()
    for a, b in replacements:
        if b in s and a not in s:
            continue  # already applied
        assert a in s, f"{path.name}: {a[:60]}"
        s = s.replace(a, b, 1)
    if note and note not in s:
        s = s.replace('  <div class="notes">\n', f'  <div class="notes">\n    <p>{note}</p>\n', 1)
    path.write_text(s)


def defer(path, why, version="v2"):
    """Mark a use case as deferred to a later version."""
    s = path.read_text()
    if "Deferred to v" not in s:
        s = re.sub(r"(  <h1>.*?</h1>\n)", rf'\1  <div style="display:inline-block;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;background:#3a2f12;color:#ffd166;margin:0 0 12px 0">Deferred to {version} — {why}</div>\n', s, count=1)
        path.write_text(s)


# ---------------------------------------------------------------- 1. defer
INS = UC / "insights-reports"
defer(INS / "uc-02-edit-dashboard-layout.html", "OQ-67", "v3")
defer(INS / "uc-03-view-report.html", "OQ-71")
defer(INS / "uc-04-export-csv.html", "OQ-71")

# ---------------------------------------------------------------- 2. rename Objectives -> Goals
old, GO = UC / "investment-objectives", UC / "goals"
if old.exists():
    GO.mkdir(exist_ok=True)
    for f in old.glob("*.html"):
        t = f.read_text()
        for a, b in [("Investment Objectives", "Goals"), ("Objectives", "Goals"), ("Objective", "Goal"), ("objectives", "goals"), ("objective", "goal")]:
            t = t.replace(a, b)
        t = re.sub(r"\b([Aa])n Goal", r"\1 Goal", t)
        (GO / f.name.replace("objective", "goal")).write_text(t)
        f.unlink()
    old.rmdir()
for stale in ["uc-03-archive-goal.html", "uc-04-unarchive-goal.html"]:
    (GO / stale).unlink(missing_ok=True)

G = ("Goals", "CUC-10")
use_case(GO / "uc-03-complete-goal.html", "UC-3: Complete Goal",
         sub(3, 6, *G, "<code>FR-8.8</code> (OQ-47, OQ-78)"),
         [S, "Open Goals page", "Select 'Mark completed' on a goal", "Confirm inline (reversible)", "Submit", "Receive result", "Move goal to the Completed list", E],
         REQ + ["Verify actor may edit this goal", "Set goal status = completed<br/>(record kept, allocations kept)"] + TAIL_BE,
         ["<strong>Renamed from Archive Goal (OQ-78).</strong> Same behavior: the goal record stays so its progress-by-month history (FR-8.7) remains viewable; it just leaves the Active list.",
          "<strong>Reversible</strong> — the only lifecycle transition in the app that is; see Reopen Goal (UC-4)."], fe_split=5)
use_case(GO / "uc-04-reopen-goal.html", "UC-4: Reopen Goal",
         sub(4, 6, *G, "<code>FR-8.9</code> (OQ-47, OQ-78)"),
         [S, "Open Goals page → Completed list", "Select 'Reopen' on a goal", "Submit", "Receive result", "Move goal back to the Active list", E],
         REQ + ["Verify actor may edit this goal", "Set goal status = active<br/>(can receive allocations again)"] + TAIL_BE,
         ["<strong>Renamed from Unarchive Goal (OQ-78).</strong>"], fe_split=4)
use_case(GO / "uc-06-view-goals.html", "UC-6: View Goals",
         sub(6, 6, *G, "<code>FR-8.5</code>, <code>FR-8.7</code>, <code>FR-9</code>", ADDED),
         [S, "Open Goals page (or a goal panel<br/>on Transactions / Dashboard / Investments)", "Request goals", "Receive goals + per-currency contributions", "If a goal mixes currencies: user types<br/>'1 USD = x BRL' — frontend converts<br/>and combines (nothing sent or stored)", "Render progress bars, funded-by lists", E],
         REQ + ["Fetch visible goals (active or completed)", "For each goal: per allocated Holding,<br/>contribution = latest valuation × % —<br/>in the Holding's own currency", "Group contributions by currency"] + ["Send response"],
         ["<strong>Why a use case:</strong> progress is computed on read from the latest valuation snapshots, never stored (FR-8.5) — this is the read path the Goals page, the Transactions overview and the Dashboard all share.",
          "<strong>FX stays client-side (FR-9, OQ-49):</strong> the backend returns contributions per currency; the exchange-rate input on the goal view only blends them for display."], fe_split=3)
for f in GO.glob("*.html"):
    t = f.read_text()
    t2 = re.sub(r"Use case (\d) of 5 in the Goals set", r"Use case \1 of 6 in the Goals set", t)
    if t2 != t:
        f.write_text(t2)

# ---------------------------------------------------------------- 3. changed use cases
RT = UC / "record-transactions"
R = ("Record Transactions", "CUC-4")
use_case(RT / "uc-01-record-transaction.html", "UC-1: Record Transaction",
         sub(1, 5, *R, "<code>FR-3.1</code>, <code>FR-3.6</code>–<code>FR-3.9</code>, <code>FR-5.1</code>, <code>FR-5.8</code>, <code>FR-8.2</code>, <code>FR-11</code> (Open Banking auto-import deferred — OQ-69)"),
         [S, "Open Transactions page", "Select 'Record Transaction'", "Choose kind group, then kind<br/>(Cash / Transfer / Credit card / Investment)", "Choose target: account or credit card<br/>(investment kinds: any account except<br/>credit card only)", "Fill in form: amount, date, category,<br/>description + kind-specific fields", "Investment buy only: asset type, ticker,<br/>quantity, rate + due date (fixed-term),<br/>debenture 'incentivised' flag, optional<br/>goal allocations (≤ 100%)", "Submit", "Receive result", "Notify user (recorded / error)", E],
         REQ + ["Validate input (target narrows valid kinds)", "Determine effect from target + kind", "Apply effect: account balance, OR card<br/>balance, OR holding quantity / cost basis", "Investment buy on a new ticker (or any<br/>fixed-term buy): create the Holding", "Fixed-term: compute schedule + taxes<br/>(engine, coded tax rules per type)", "Buy/sell/redemption: record automatic<br/>valuation snapshot", "If goal allocations given: verify ≤ 100%<br/>and save them", "If quantity reached 0: auto-archive<br/>the Holding", "Update budget accrual (if categorized)", "Save the transaction record"] + TAIL_BE,
         ["<strong>One flow, two ledgers (OQ-39):</strong> account or credit card, the flow is identical — target and kind narrow each other as data; the record lands in the Account or Card ledger accordingly (OQ-16).",
          "<strong>Removed in this review:</strong> the recurring toggle (FR-3.5 dropped, OQ-55) and the budget-threshold notification (FR-4.4 removed, OQ-52 — this diagram still showed it).",
          "<strong>Goal allocations are bundled into the buy (OQ-54)</strong> — one call; later changes happen on the Holding (Edit Holding, Track Investments UC-2).",
          "<strong>Auto-archive (FR-5.8, OQ-72):</strong> a full sell/redemption archives the Holding in the same operation; Edit/Delete Transaction undo it if the quantity is no longer zero (OQ-80)."], fe_split=8)
use_case(RT / "uc-02-edit-transaction.html", "UC-2: Edit Transaction",
         sub(2, 5, *R, "<code>FR-3.2</code>, <code>FR-3.9</code>, <code>FR-5.2</code>, <code>FR-5.8</code> (OQ-37, OQ-39, OQ-80)"),
         [S, "Open Transactions page", "Expand the transaction row → Edit", "Edit date, amount, category, description<br/>(kind and target are fixed)", "Submit", "Receive result", "Notify user (updated / error)", E],
         REQ + ["Verify the transaction is editable (manual)", "Reverse previous effect, apply updated<br/>effect (balances / holding quantity)", "Update its automatic valuation snapshot,<br/>if investment", "If the Holding was auto-archived by this<br/>transaction and quantity is now > 0:<br/>un-archive it", "Update budget accrual accordingly", "Save updated transaction"] + TAIL_BE,
         ["<strong>Kind and target can't change</strong> after recording — the edit drawer shows them read-only.", "<strong>Auto-unarchive (OQ-80):</strong> only a system-made archive is undone; a user-made archive stays one-way."], fe_split=5)
use_case(RT / "uc-03-delete-transaction.html", "UC-3: Delete Transaction",
         sub(3, 5, *R, "<code>FR-3.2</code>, <code>FR-3.9</code>, <code>FR-5.8</code> (OQ-80)"),
         [S, "Open Transactions page", "Expand the transaction row → Delete", "Confirm inline", "Submit", "Receive result", "Remove the row", E],
         REQ + ["Verify the transaction is manual", "Reverse its effect<br/>(account / card / holding)", "Delete its automatic valuation snapshot,<br/>if investment", "If it had auto-archived a Holding:<br/>un-archive it", "Reverse budget accrual, if counted", "Delete the transaction record"] + TAIL_BE,
         ["<strong>Auto-unarchive (OQ-80):</strong> deleting the sell/redemption that zeroed a Holding brings the Holding back."], fe_split=5)

TI = UC / "track-investments"
T = ("Track Investments &amp; Net Worth", "CUC-6")
TI_TOTAL = 11
use_case(TI / "uc-02-edit-holding.html", "UC-2: Edit Holding Goal Allocations",
         sub(2, TI_TOTAL, *T, "<code>FR-5.2</code>, <code>FR-8.2</code>, <code>FR-8.3</code>, <code>FR-8.6</code> (OQ-48, OQ-56)"),
         [S, "Open Investments → Holdings by account", "Expand a holding", "Edit 'Counts toward goals':<br/>add / remove goals, change %", "Save", "Receive result", "Notify user (saved / error)", E],
         REQ + ["Verify actor may edit this Holding", "Verify allocations total ≤ 100%", "Replace the Holding's goal allocations"] + TAIL_BE,
         ["<strong>Narrowed in this review:</strong> a Holding's position is read-only (it changes only through its transactions), and its market value has its own use cases (Record / Edit / Delete Market Value). What's left to edit on the Holding itself is goal allocation.",
          "<strong>Direction of control (OQ-48):</strong> allocations are edited from the Holding, never from the Goal."], fe_split=5)
use_case(TI / "uc-03-archive-holding.html", "UC-3: Archive Matured Holding",
         sub(3, TI_TOTAL, *T, "<code>FR-5.8</code>, <code>FR-6.5</code> (OQ-43, OQ-72)"),
         [S, "Open the 'past due' notification<br/>(Notify Matured Holding, UC-11)", "Select 'Archive holding'", "Confirm (irreversible)", "Submit", "Receive result", "Delete the notification<br/>(Insights UC-6)", "Notify user (archived / error)", E],
         REQ + ["Verify actor may edit this Holding", "Archive it (by = user; keep valuation<br/>history and goal allocations)"] + TAIL_BE,
         ["<strong>Manual archive is now only for this case:</strong> a fixed-term Holding past its due date that still has a position. Every other archive happens automatically when a transaction brings quantity to 0 (Record Transaction, OQ-72).",
          "<strong>One-way (OQ-43):</strong> a user-made archive is never undone automatically (contrast OQ-80).",
          "<strong>Call chain review:</strong> the frontend deletes the notification afterwards through Delete Notification (Insights UC-6), so this flow stays inside <code>AccountManager</code>'s own entities."], fe_split=5)
system_use_case(TI / "uc-04-generate-scheduled-cash-event.html", "UC-4: Generate Scheduled Investment Cash Event",
                sub(4, TI_TOTAL, *T, "<code>FR-11.2</code>, <code>FR-11.3</code>, <code>FR-5.8</code>, <code>FR-5.9</code>"),
                ["Scheduled trigger (daily)", "Find fixed-term holdings with a cash event<br/>due today (interest / redemption / tax)", "For each: re-enter the Record Transaction<br/>pipeline (target = the holding's account,<br/>linked to the holding)", "Tax amount comes from the engine's coded<br/>rules for the instrument type; US: none<br/>estimated in v1", "Redemption brings quantity to 0 →<br/>auto-archive the Holding", "Save the transaction record", "Record the action (log)"],
                ["<strong>Payout source (FR-5.9):</strong> the interest transactions created here are what the payout chart and 'Payout this month' read — nothing else stores payout.",
                 "<strong>Removed:</strong> the comparison to recurring-transaction generation (FR-3.5 dropped, OQ-55). This is contractual, not user-defined recurrence."])

FA = UC / "financial-accounts"
patch(FA / "uc-01-create-account.html", [("Fill in account form (name, type,<br/>currency, opening balance, visibility)", "Fill in account form (name, type: checking /<br/>savings / credit card only / investment,<br/>currency, opening balance, visibility)")],
      "<strong>Account types (OQ-76, Oct 2026 review):</strong> four — checking, savings, credit card only, investment. Investments can later live in any of them except credit card only. Also the mandatory first step of the guided setup for every new household (FR-1.22).")
CA = UC / "categories"
patch(CA / "uc-01-create-category.html", [("Fill in form (name)", "Fill in form (name, icon, colour)")], "<strong>Icon + colour (FR-10.1, OQ-57, Oct 2026 review):</strong> they identify the category everywhere it appears.")
patch(CA / "uc-02-edit-category.html", [("Edit name and/or add/edit/remove subcategories", "Edit name / icon / colour and/or<br/>add, edit, archive subcategories")], "<strong>Icon + colour editable (FR-10.1, OQ-57).</strong>")

IH = UC / "identity-household"
patch(IH / "uc-01-create-household.html", [], "<strong>Two entry points (FR-1.4, OQ-75, Oct 2026 review):</strong> onboarding, or 'Create household' in the main menu's household switcher. Either way the guided setup follows, with the first account mandatory (FR-1.22, OQ-81).")
patch(IH / "uc-03-invite-user.html", [("Send invitation notice (email)", "Create an in-app notification<br/>for the invitee (FR-6.5)")],
      "<strong>Changed in the Oct 2026 review:</strong> the invitee is notified through the in-app notification inbox (FR-6.5, OQ-68) — v1 has no email channel. The notification carries who invited them (FR-1.10).")
patch(IH / "uc-04-accept-invitation.html", [("Open invitation (notice/link)", "Open invitation (notification inbox,<br/>Profile, or household switcher)")], "<strong>Entry points (Oct 2026 review):</strong> the notification inbox (accept inline), Profile → Invitations, or the household switcher's pending invitations.")
patch(IH / "uc-05-decline-invitation.html", [], "<strong>Entry points (Oct 2026 review):</strong> also declinable inline from the notification inbox.")
patch(IH / "uc-11-create-user.html", [("Fill in email + password", "Fill in first name, last name,<br/>email + password (≥ 12 chars)"), ("Validate email + password", "Validate email + password<br/>(≥ 12 characters)")],
      "<strong>Oct 2026 review:</strong> first and last name were missing here (FR-1.1, OQ-29); password minimum is 12 characters (NFR-SEC-4, OQ-64).")
patch(IH / "uc-18-reset-password.html", [], "<strong>Password minimum 12 characters</strong> (NFR-SEC-4, OQ-64).")
patch(IH / "uc-19-change-password.html", [], "<strong>Password minimum 12 characters</strong> (NFR-SEC-4, OQ-64).")
patch(IH / "uc-13-edit-user.html", [("Edit profile fields", "Edit profile fields (first / last name)<br/>and preferences (theme: dark / light /<br/>system, language)"), ("Validate &amp; update profile fields", "Validate &amp; update profile fields<br/>and preferences")],
      "<strong>Preferences added (FR-1.21, Oct 2026 review):</strong> per user, not per household.")
patch(IH / "uc-17-revoke-session.html", [("Select a session to revoke", "Select a session to revoke —<br/>or 'Sign out all others'"), ("Verify session belongs to actor", "Verify session(s) belong to actor"), ("Revoke that session's refresh token", "Revoke that session's refresh token<br/>(or every session except the current one)")],
      "<strong>Variant added (FR-1.3, OQ-62, Oct 2026 review):</strong> revoke all other sessions in one action — same use case, different target set.")
use_case(IH / "uc-21-list-my-households.html", "UC-21: List My Households",
         sub(21, 21, "Identity &amp; Household", "CUC-1", "<code>FR-1.8</code> (OQ-60)", ADDED),
         [S, "Open the main menu's household switcher", "Request my households", "Receive households + pending invitations", "Show list; selecting one switches the<br/>active household (client-side)", E],
         REQ + ["Fetch households where the actor is a member<br/>(name, role, member count)", "Fetch the actor's pending invitations<br/>(household, inviter, role)", "Send response"],
         ["<strong>Switching is not a backend use case:</strong> the frontend keeps the active household and sends it with every request; RBAC (NFR-SEC-6) checks membership on each call.",
          "'Create household' in the same menu goes to Create Household (UC-1)."], fe_split=3)

use_case(INS / "uc-01-view-dashboard.html", "UC-1: View Dashboard",
         sub(1, 6, "Insights &amp; Reports", "CUC-8", "<code>FR-6.0</code>, <code>FR-5.3</code>, <code>FR-5.9</code>, <code>FR-4.3</code>, <code>FR-8.5</code> (OQ-67)"),
         [S, "Open Dashboard (landing page after login)", "Request dashboard data", "Receive data", "Render fixed panels", E],
         REQ + ["Net worth per currency, 6-month series<br/>+ change vs previous month", "Coming-due fixed-income list", "Payout series (last 12 months) for the<br/>selected holdings", "Balances, budgets (over-budget first),<br/>goals for the current month", "Send response"],
         ["<strong>v1 = fixed panels (FR-6.0, OQ-67):</strong> no saved layout or widget configuration — that's Edit Dashboard Layout (UC-2), deferred to v3.",
          "Each panel reuses a read that another use case already owns (View Investments, View Month Overview, View Goals) — the Dashboard composes, it doesn't compute anything new."], fe_split=3)
use_case(INS / "uc-05-view-notifications.html", "UC-5: View Notifications",
         sub(5, 6, "Insights &amp; Reports", "CUC-8", "<code>FR-6.5</code>, <code>FR-6.10</code> (OQ-68)"),
         [S, "Click the bell in the header<br/>(shows unseen count)", "Request notifications", "Receive list", "Show inbox; items are actionable:<br/>accept / decline invitation (Identity<br/>UC-4/5), archive matured holding<br/>(Track Investments UC-3)", E],
         REQ + ["Fetch the user's notifications", "Mark the fetched ones as seen", "Send response"],
         ["<strong>v1 triggers (OQ-68):</strong> invitation received (Identity UC-3) and fixed-term holding past due (Track Investments UC-11). Open Banking sync failure stays dormant (OQ-69).",
          "Actions inside a notification call the use case they belong to; this use case only lists and marks seen."], fe_split=3)

# ---------------------------------------------------------------- 4. new use cases
use_case(RT / "uc-04-browse-transactions.html", "UC-4: Browse &amp; Filter Transactions",
         sub(4, 5, *R, "<code>FR-3.12</code> (OQ-61)", ADDED),
         [S, "Open Transactions page (or 'See in<br/>Transactions' from a holding)", "Optionally open Filter: kinds, accounts,<br/>cards, categories, holding, date range<br/>(any months)", "Request a page of transactions", "Receive page + next cursor", "Render grouped by month and day;<br/>load the next page on scroll", E],
         REQ + ["Apply visibility rules (personal / shared)", "Apply filters", "Return newest-first page from both<br/>ledgers merged, with day totals", "Send response"],
         ["<strong>Not scoped to the period bar (OQ-61):</strong> the list shows all transactions, lazily loaded; the month selector only drives the overview (UC-5).",
          "Filtering by holding is how a holding links to its own transactions."], fe_split=4)
use_case(RT / "uc-05-view-month-overview.html", "UC-5: View Month Overview",
         sub(5, 5, *R, "<code>FR-6.11</code>, <code>FR-6.6</code>, <code>FR-4.3</code>, <code>FR-8.5</code> (OQ-74)", ADDED),
         [S, "Open Transactions page", "Pick year and month in the period bar", "Request overview for that month", "Receive overview", "Render in / out / total ($ or R$),<br/>12-month strip, balances, budgets, goals", E],
         REQ + ["Per currency: month inflow, outflow, net —<br/>excluding own-account transfers and<br/>card bill payments", "Per currency: inflow / outflow for each<br/>month of the selected year", "Account and card balances at month end", "Budget periods for that month<br/>(over-budget first)", "Goal progress as of that month end", "Send response"],
         ["<strong>One currency at a time in the UI ($/R$ switch), never summed (FR-2.2).</strong>", "Balances need no stored snapshot — derived from dated transactions (FR-6.6)."], fe_split=4)

use_case(TI / "uc-05-record-market-value.html", "UC-5: Record Market Value",
         sub(5, TI_TOTAL, *T, "<code>FR-5.2</code> (OQ-56)", ADDED),
         [S, "Expand a market-priced holding<br/>(stock / FII / fund / other)", "Enter new value + 'as of' date<br/>(chart previews the point)", "Save value", "Receive result", "Update chart and Value column", E],
         REQ + ["Verify the Holding is market-priced<br/>(fixed-term Holdings have no snapshots)", "Create a manual valuation snapshot"] + TAIL_BE,
         ["Net worth and goal progress for affected months follow automatically — both read 'latest snapshot at or before month end'."], fe_split=4)
use_case(TI / "uc-06-edit-market-value.html", "UC-6: Edit Market Value",
         sub(6, TI_TOTAL, *T, "<code>FR-5.2</code> (OQ-56)", ADDED),
         [S, "Open Value history (from 'Edit history'<br/>or a chart point)", "Select an entry → edit date / value", "Save", "Receive result", "Update list and chart", E],
         REQ + ["Verify the snapshot is manual (automatic<br/>ones change only via their transaction)", "Update the snapshot"] + TAIL_BE,
         ["<strong>New in the Oct 2026 review (OQ-56):</strong> snapshots used to be append-only; manual ones can now be corrected."], fe_split=4)
use_case(TI / "uc-07-delete-market-value.html", "UC-7: Delete Market Value",
         sub(7, TI_TOTAL, *T, "<code>FR-5.2</code> (OQ-56)", ADDED),
         [S, "Open Value history", "Select an entry → delete, confirm inline", "Submit", "Receive result", "Remove from list and chart", E],
         REQ + ["Verify the snapshot is manual", "Delete the snapshot"] + TAIL_BE,
         ["If the deleted entry was the latest, the Holding's current value falls back to the previous snapshot."], fe_split=4)
use_case(TI / "uc-08-record-index-rate.html", "UC-8: Record Index Rate",
         sub(8, TI_TOTAL, *T, "<code>FR-11.6</code> (OQ-59)", ADDED),
         [S, "Open Investments → Rates", "Select 'Update' on an index<br/>(Selic / CDI / IPCA / IGP-M)", "Enter value + 'as of' date", "Save", "Receive result", "Update card and chart", E],
         REQ + ["Validate (known index, sensible range)", "Add the value to that index's history"] + TAIL_BE,
         ["Household-scoped reference data. The engine reads the latest value when projecting payouts/taxes for holdings that track this index (FR-11.2) — projections are computed on read, so nothing is recalculated here."], fe_split=5)
use_case(TI / "uc-09-edit-index-rate.html", "UC-9: Edit Index Rate",
         sub(9, TI_TOTAL, *T, "<code>FR-11.6</code>", ADDED),
         [S, "Open Rates → an index's History", "Select an entry → edit value / date", "Save", "Receive result", "Update history and chart", E],
         REQ + ["Validate", "Update the entry"] + TAIL_BE, ["Same drawer pattern as Value history."], fe_split=4)
use_case(TI / "uc-10-delete-index-rate.html", "UC-10: Delete Index Rate",
         sub(10, TI_TOTAL, *T, "<code>FR-11.6</code>", ADDED),
         [S, "Open Rates → an index's History", "Select an entry → delete, confirm inline", "Submit", "Receive result", "Update history and chart", E],
         REQ + ["Delete the entry"] + TAIL_BE, ["If it was the latest value, projections fall back to the previous one."], fe_split=4)
system_use_case(TI / "uc-11-notify-matured-holding.html", "UC-11: Notify Matured Holding",
                sub(11, TI_TOTAL, *T, "<code>FR-5.8</code>, <code>FR-6.5</code> (OQ-68, OQ-72)", ADDED),
                ["Scheduled trigger (daily)", "Find fixed-term holdings past their due<br/>date that still have a position", "Skip ones already notified", "Create an in-app notification for each<br/>holding's owner(s): 'past due — archive?'", "Record the action (log)"],
                ["The notification's 'Archive holding' action runs Archive Matured Holding (UC-3).",
                 "Normally a redemption (UC-4) zeroes and auto-archives the holding first; this catches the cases where it didn't."])
use_case(TI / "uc-12-view-investments.html", "UC-12: View Investments",
         sub(12, 12, *T, "<code>FR-5.3</code>, <code>FR-5.4</code>, <code>FR-5.9</code>, <code>FR-11.2</code>, <code>FR-11.6</code> (OQ-58, OQ-73)", ADDED),
         [S, "Open Investments (Overview / Holdings<br/>by account / Rates tab)", "Request the tab's data (payout chart:<br/>selected holdings)", "Receive data", "Render", E],
         REQ + ["Overview: net worth per currency + change,<br/>payout this month and 12-month series<br/>(from dividend/interest transactions),<br/>allocations, coming due", "Holdings by account: positions; fixed-term →<br/>expected payout + taxes from the engine<br/>(latest index rate; US taxes 'not estimated');<br/>market-priced → value history", "Rates: each index's history", "Send response"],
         ["<strong>Everything here is computed on read</strong> — payout from linked transactions (FR-5.9), projections from the engine (FR-11.2) — nothing new is stored."], fe_split=3)

# Track Investments set now has 11 numbered + UC-12 (12 diagrams incl. retired UC-1 slot) — normalise "of N"
for f in TI.glob("*.html"):
    t = f.read_text()
    t2 = re.sub(r"Use case (\d+) of \d+ in the Track Investments", r"Use case \1 of 12 in the Track Investments", t)
    if t2 != t:
        f.write_text(t2)
print("done")
