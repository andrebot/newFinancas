#!/usr/bin/env python3
"""Project Design network for New Finance App v1 (single source of truth).

Activities and dependencies from docs/planning/01-pd-activity-list.md,
derived from the architecture's communication rules:
- Utilities and infrastructure are leaves; Accessors depend on the schema;
  Engines on their Accessors; Managers on what they orchestrate.
- Kit components depend on foundations and on the kit pieces they compose;
  Flows on the kit + frontend Utilities they use; Experiences on their
  Flows and the API client; integration on both sides of the seam.

Step 2 (this file's `main`): validate (no unknown ids, no cycles), reduce
transitive edges, print the build levels. Step 3 adds durations and the
critical path to the same data.
"""
import re
import sys
from collections import defaultdict

# Kit core used by nearly every UI package — listed once instead of on every node.
KIT_CORE = ["K4", "K5", "K25", "K28", "K34"]

# id: (name, [dependencies])
ACTIVITIES = {
    # ---- non-code / infrastructure
    "N1": ("Project plan", []),
    "N2": ("Repository + monorepo setup", ["N1"]),
    "N3": ("Local CI (scripts + hooks)", ["N2"]),
    "N4": ("Local environment (Docker Postgres, console email)", ["N2"]),
    "N5": ("Schema + migrations baseline", ["N4"]),
    "N6": ("Reference data + seeds", ["N5"]),
    "N7": ("API contract tooling", ["N2"]),
    "N8": ("i18n catalog package", ["N2"]),
    "N9": ("Local scheduler for investmentsDaily", ["U6"]),
    "N10": ("Security review (light)", ["I7"]),
    "N11": ("Accessibility audit", ["I7", "I8", "I9", "I10", "I11", "I12"]),
    "N12": ("Local operations (backup/restore)", ["N5"]),
    "N13": ("First real use + stabilization", ["V3", "N10", "N11", "N12"]),
    # ---- UI kit: foundations
    "K1": ("Tailwind theme + tokens", ["N2"]),
    "K2": ("Typography", ["K1"]),
    "K3": ("Icon set", ["K1"]),
    # ---- UI kit: inputs
    "K4": ("Button", ["K2", "K3"]),
    "K5": ("Text field", ["K2"]),
    "K6": ("Password field", ["K5", "K4"]),
    "K7": ("Money input", ["K5", "FU6"]),
    "K8": ("Number / percent / rate input", ["K5", "FU6"]),
    "K9": ("Date input", ["K5", "FU6"]),
    "K10": ("Date range picker", ["K9", "K22"]),
    "K11": ("Select / combobox", ["K5", "K22"]),
    "K12": ("Multi-select with search + presets", ["K11", "K16"]),
    "K13": ("Segmented control", ["K2"]),
    "K14": ("Option card", ["K2", "K3"]),
    "K15": ("Switch", ["K2"]),
    "K16": ("Checkbox", ["K2", "K3"]),
    "K17": ("Code input (6 digits)", ["K5"]),
    "K18": ("Icon picker", ["K22", "K3"]),
    "K19": ("Colour swatch picker", ["K22"]),
    # ---- UI kit: overlays + feedback
    "K20": ("Drawer / sheet", ["K4"]),
    "K21": ("Dialog", ["K4"]),
    "K22": ("Popover", ["K2"]),
    "K23": ("Menu", ["K22"]),
    "K24": ("Tooltip", ["K22"]),
    "K25": ("Toast + inline banner", ["K4"]),
    "K26": ("Inline confirm", ["K4"]),
    "K27": ("Type-to-confirm", ["K5", "K4"]),
    "K28": ("Skeleton + loading + empty state", ["K2"]),
    # ---- UI kit: data display
    "K29": ("Amount", ["K2", "FU6"]),
    "K30": ("Badge / tag / pill", ["K2"]),
    "K31": ("Avatar", ["K2"]),
    "K32": ("Progress ring", ["K2"]),
    "K33": ("Progress bar", ["K2"]),
    "K34": ("Card / panel + section header + layouts", ["K2"]),
    "K35": ("Card rail", ["K34", "K4"]),
    "K36": ("Rail cards (balance / budget / goal)", ["K35", "K32", "K29"]),
    "K37": ("Stat tile", ["K38", "K29", "K34"]),
    "K38": ("Line chart / sparkline", ["K24"]),
    "K39": ("Stacked bar chart + legend", ["K24", "K29"]),
    "K40": ("Period bar", ["K13", "K29"]),
    "K41": ("Grouped list + infinite scroll", ["K42", "K28", "K29"]),
    "K42": ("Expandable row / accordion", ["K2", "K3"]),
    "K43": ("Table", ["K42"]),
    "K44": ("Key–value list", ["K2"]),
    "K45": ("List row", ["K31", "K23"]),
    "K46": ("History editor", ["K7", "K8", "K9", "K26", "K38"]),
    "K47": ("Allocation editor", ["K11", "K8", "K33"]),
    "K48": ("Credit-card preview", ["K5"]),
    "K49": ("Stepper", ["K2"]),
    "K50": ("Category chip", ["K3", "FU4"]),
    # ---- backend utilities
    "U1": ("CorrelationIdUtility", ["N2"]),
    "U2": ("LoggingUtility", ["U1", "A15"]),
    "U3": ("ValidationUtility", ["N2"]),
    "U4": ("AuthenticationUtility", ["N2"]),
    "U5": ("AuthorizationUtility", ["A3"]),
    "U6": ("ServiceBusUtility", ["N2"]),
    "U7": ("NotificationDeliveryUtility", ["A16", "N8"]),
    # ---- accessors
    "A1": ("UserAccessor", ["N5"]),
    "A2": ("SessionAccessor", ["N5"]),
    "A3": ("HouseholdAccessor", ["N5"]),
    "A4": ("InvitationAccessor", ["N5"]),
    "A5": ("AccountAccessor", ["N5"]),
    "A6": ("CreditCardAccessor", ["N5"]),
    "A7": ("AccountTransactionAccessor", ["N5"]),
    "A8": ("CardTransactionAccessor", ["N5"]),
    "A9": ("CategoryAccessor", ["N6"]),
    "A10": ("BudgetAccessor", ["N5"]),
    "A11": ("InvestmentHoldingAccessor", ["N6"]),
    "A12": ("ValuationSnapshotAccessor", ["N5"]),
    "A13": ("GoalAccessor", ["N5"]),
    "A14": ("IndexRateAccessor", ["N6"]),
    "A15": ("AuditLogAccessor", ["N5"]),
    "A16": ("NotificationInboxAccessor", ["N5"]),
    # ---- engines
    "E1": ("InvestmentProductEngine", ["A11", "A14"]),
    "E2": ("ReportingEngine", ["A5", "A6", "A7", "A8", "A10", "A11", "A12", "A13"]),
    # ---- managers (with their HTTP routes)
    "M1": ("IdentityManager", ["A1", "A2", "A3", "A4", "U2", "U4", "U5", "U6", "U7", "N7"]),
    # Split out (execution order): Delete User touches every owned-data Accessor.
    "M1D": ("IdentityManager: Delete User cascade", ["M1", "A5", "A7", "A8", "A10", "A11", "A13"]),
    "M2": ("AccountManager", ["A5", "A6", "A9", "A10", "A11", "A12", "A13", "A14",
                              "U2", "U3", "U5", "U6", "U7", "N7"]),
    "M3": ("TransactionManager", ["A5", "A6", "A7", "A8", "A10", "A12", "A13", "E1",
                                  "U2", "U5", "U6", "N7"]),
    "M4": ("InsightsManager", ["E1", "E2", "A15", "A16", "U5", "N7"]),
    # ---- frontend utilities
    "FU1": ("ValidationUtility (web)", ["N2"]),
    "FU2": ("PasswordStrengthUtility", ["N2"]),
    "FU3": ("AlertUtility", ["K25"]),
    "FU4": ("ThemeUtility", ["K1"]),
    "FU5": ("I18nUtility", ["N8"]),
    "FU6": ("FormattingUtility", ["FU5"]),
    "FU7": ("API client", ["N7"]),
    # ---- flows (each includes its Interactions)
    "FL1": ("Sign In", ["K6", "K17", "FU1"]),
    "FL2": ("Account Recovery", ["K6", "FU1", "FU2"]),
    "FL3": ("Registration", ["K6", "K16", "FU1", "FU2"]),
    "FL4": ("MFA Enrollment", ["K14", "K17", "FU1"]),
    "FL5": ("Household Setup", ["FU1"]),
    "FL6": ("Guided Setup", ["K49", "FL11", "FL12", "FL13"]),
    "FL7": ("Security", ["K6", "K45", "K26", "FU2"]),
    "FL8": ("Delete Account", ["K27"]),
    "FL9": ("Membership Management", ["K45", "K30", "K26", "K11"]),
    "FL10": ("Household Deletion", ["K27"]),
    "FL11": ("Account & Card Management", ["K14", "K7", "K48", "K13", "K15", "K26"]),
    "FL12": ("Category Management", ["K42", "K18", "K19", "K50", "K26"]),
    "FL13": ("Budget Management", ["K11", "K7", "K26", "K50"]),
    "FL14": ("Goal Management", ["K7", "K8", "K9", "K33", "K26"]),
    "FL15": ("Record Transaction", ["K13", "K11", "K7", "K9", "K47", "K15", "K20", "K50"]),
    "FL16": ("Browse Transactions", ["K41", "K10", "K12", "K44", "K26", "K20", "K50"]),
    "FL17": ("Month Overview", ["K40", "K36"]),
    "FL18": ("Portfolio Overview", ["K37", "K39", "K12", "K45"]),
    "FL19": ("Holding Maintenance", ["K43", "K44", "K47", "K46", "K20", "K11"]),
    "FL20": ("Rates Maintenance", ["K37", "K46"]),
    "FL21": ("Dashboard", ["K37", "K39", "K12", "K36", "K45"]),
    # ---- shell + experiences
    "S1": ("App Shell", ["K22", "K30", "K31", "K23", "FU3", "FU4", "FU5", "FU7"]),
    "X1": ("Authenticate", ["FL1", "FL2", "FU3", "FU7"]),
    "X2": ("Onboard (Registration, MFA, Household Setup)", ["FL3", "FL4", "FL5", "S1"]),
    # Split out (execution order): Guided Setup composes Account Setup's Flows.
    "X2G": ("Onboard: Guided Setup step", ["X2", "FL6"]),
    "X3": ("Manage Profile", ["FL7", "FL8", "K13", "S1"]),
    "X4": ("Manage Household", ["FL9", "FL10", "S1"]),
    "X5": ("Account Setup", ["FL11", "FL12", "FL13", "FL14", "S1"]),
    "X6": ("Manage Finances", ["FL15", "FL16", "FL17", "S1"]),
    "X7": ("Track Investments", ["FL18", "FL19", "FL20", "S1"]),
    "X8": ("Review Insights", ["FL21", "K21", "K10", "S1"]),
    # ---- integration
    "I1": ("IdentityManager seam suite", ["M1"]),
    "I2": ("AccountManager seam suite", ["M2"]),
    "I3": ("TransactionManager seam suite", ["M3"]),
    "I4": ("InsightsManager seam suite", ["M4"]),
    "I5": ("Manager pub/sub (household.created, holding.matured)", ["I1", "I2"]),
    "I6": ("investmentsDaily trigger end to end", ["N9", "I2", "I3"]),
    "I7": ("Frontend ↔ backend: identity", ["X1", "X2", "X3", "X4", "I1"]),
    "I8": ("Frontend ↔ backend: account setup", ["X5", "X2G", "I2", "I5"]),
    "I9": ("Frontend ↔ backend: finances", ["X6", "I3", "I4"]),
    "I10": ("Frontend ↔ backend: investments", ["X7", "I2", "I4"]),
    "I11": ("Frontend ↔ backend: insights", ["X8", "I4"]),
    "I12": ("Shell notification routing", ["S1", "X3", "X7", "X8", "I6", "I4"]),
    # ---- verification
    "V1": ("Smoke suite", ["I7", "I8", "I9", "I11", "N3"]),
    "I13": ("Delete account end to end", ["M1D", "X3", "I7"]),
    "V2": ("Core E2E (14 journeys)", ["V1", "I10", "I12", "I13"]),
    "V3": ("Full E2E", ["V2"]),
    "V4": ("Load tests (k6)", ["V2"]),
}


def id_key(aid):
    """Sort key for ids like K12, M1D: prefix, number, suffix."""
    m = re.fullmatch(r"([A-Z]+)(\d+)([A-Z]*)", aid)
    return (m.group(1), int(m.group(2)), m.group(3))


def deps_with_core(aid):
    """Dependencies of an activity, adding the kit core to UI packages."""
    name, deps = ACTIVITIES[aid]
    ui = aid.startswith(("FL", "X", "S"))
    return list(dict.fromkeys(deps + (KIT_CORE if ui else [])))


def validate():
    """Raise on unknown ids or cycles; return a topological order."""
    for aid in ACTIVITIES:
        for d in deps_with_core(aid):
            if d not in ACTIVITIES:
                raise ValueError(f"{aid} depends on unknown {d}")
    order, state = [], {}

    def visit(n, path):
        """Depth-first visit that detects back edges (cycles)."""
        if state.get(n) == 1:
            raise ValueError("cycle: " + " → ".join(path + [n]))
        if state.get(n) == 2:
            return
        state[n] = 1
        for d in deps_with_core(n):
            visit(d, path + [n])
        state[n] = 2
        order.append(n)

    for aid in ACTIVITIES:
        visit(aid, [])
    return order


def ancestors(order):
    """All transitive predecessors of every activity."""
    anc = {}
    for n in order:
        s = set()
        for d in deps_with_core(n):
            s |= {d} | anc[d]
        anc[n] = s
    return anc


def reduced(order):
    """Direct dependencies minus those already implied transitively."""
    anc = ancestors(order)
    out = {}
    for n in order:
        ds = deps_with_core(n)
        out[n] = [d for d in ds if not any(d in anc[o] for o in ds if o != d)]
    return out


def levels(order, red):
    """Build level = longest dependency chain length (in activities)."""
    lv = {}
    for n in order:
        lv[n] = 1 + max((lv[d] for d in red[n]), default=0)
    return lv


def main():
    """Validate the network and print the levels and redundant edges removed."""
    order = validate()
    red = reduced(order)
    lv = levels(order, red)
    removed = sum(len(deps_with_core(n)) - len(red[n]) for n in order)
    by = defaultdict(list)
    for n in order:
        by[lv[n]].append(n)
    print(f"{len(ACTIVITIES)} activities, {sum(len(v) for v in red.values())} edges "
          f"after removing {removed} transitive ones, {max(lv.values())} levels")
    for k in sorted(by):
        print(f"L{k:>2}: {' '.join(sorted(by[k], key=id_key))}")
    return red, lv


if __name__ == "__main__":
    sys.exit(0 if main() else 1)


# ---------------------------------------------------------------- step 3 (streamlined)
# Stakeholder decision: no estimates / options — one developer + Claude,
# one task at a time. The execution order is a topological order of the
# network, built in vertical slices: each slice ends with a working,
# integrated area. A prerequisite inherits the earliest slice that needs it.
SLICES = [
    ("Setup", ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N12"]),
    ("Identity & household", ["I7"]),
    ("Account setup", ["I8"]),
    ("Day-to-day finances", ["I9"]),
    ("Investments", ["I10", "I6"]),
    ("Insights & notifications", ["I11", "I12", "I13"]),
    ("Hardening & first use", ["V1", "V2", "V3", "V4", "N10", "N11", "N13"]),
]


def slice_of(order, red):
    """Earliest slice that needs each activity (goals pull their prerequisites)."""
    sl = {}
    for i, (_, goals) in enumerate(SLICES):
        stack = list(goals)
        while stack:
            a = stack.pop()
            if a in sl:
                continue
            sl[a] = i
            stack.extend(red[a])
    return sl


def execution_order(order, red, lv):
    """Pick ready tasks by (slice, backend before frontend, level, id)."""
    sl = slice_of(order, red)
    done, seq = set(), []
    side = lambda a: 0 if a[0] in "NUAEM" else (1 if a[0] in "KF" or a[0] in "SX" else 2)
    while len(seq) < len(ACTIVITIES):
        ready = [a for a in ACTIVITIES if a not in done and all(d in done for d in red[a])]
        nxt = min(ready, key=lambda a: (sl.get(a, len(SLICES)), side(a), lv[a], a))
        done.add(nxt)
        seq.append(nxt)
    return seq, sl
