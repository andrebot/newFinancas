# Project Design — Step 3: Execution order (v1)

**Stakeholder decision (Oct 2026):** no effort estimates or schedule
options — one developer + Claude, **one task at a time**. This list is
the plan: a topological order of the dependency network
(`docs/planning/02-pd-dependency-network.md`, data + ordering in
`docs/design/diagrams/scripts/pd_network.py`), grouped into **vertical slices** so
each slice ends with a working, integrated area of the app instead of
"all backend, then all frontend".

**Rules for each task:** detail design first (questions answered before
code) → implementation → unit tests (100% coverage) / integration tests
per BDT → every function documented → cyclomatic complexity ≤ 7, ≤ 7
parameters → tick it here.

**Three splits made for slicing** (148 activities, up from 145; 149 with
`N14`, the component library, added during slice 1 — OQ-128):
Delete User's cascade (`M1D`) needs every owned-data Accessor, so it moved
to slice 5 with its end-to-end check (`I13`); Onboard's Guided Setup step
(`X2G`) composes Account Setup's Flows, so it lands in slice 2; the
`household.created` → default-categories effect (`I5`) is verified in
slice 2, where `AccountManager` exists.

Kit components arrive in the first slice that needs them — 27 with the
identity screens, the rest as later slices use them.

## Slice 0 — Setup

*Done when:* repo, local environment, database, contracts and catalog ready.

- [x] **1.** `N1` Project plan
- [x] **2.** `N2` Repository + monorepo setup
- [x] **3.** `N3` Local CI (scripts + hooks)
- [x] **4.** `N4` Local environment (Docker Postgres, console email)
- [x] **5.** `N7` API contract tooling
- [x] **6.** `N8` i18n catalog package
- [x] **7.** `N5` Schema + migrations baseline
- [x] **8.** `N12` Local operations (backup/restore)
- [x] **9.** `N6` Reference data + seeds

## Slice 1 — Identity & household

*Done when:* register, enable MFA, create a household, sign in, manage profile and members — in the browser, against the real API.

- [x] **10.** `U1` CorrelationIdUtility
- [x] **11.** `U4` AuthenticationUtility
- [x] **12.** `U6` ServiceBusUtility
- [x] **13.** `A1` UserAccessor
- [x] **14.** `A15` AuditLogAccessor
- [x] **15.** `A16` NotificationInboxAccessor
- [x] **16.** `A2` SessionAccessor
- [x] **17.** `A3` HouseholdAccessor
- [x] **18.** `A4` InvitationAccessor
- [x] **19.** `U2` LoggingUtility
- [x] **20.** `U5` AuthorizationUtility
- [x] **21.** `U7` NotificationEngine + EmailAccessor (was NotificationDeliveryUtility — OQ-113)
- [x] **22.** `M1` IdentityManager (five PRs, OQ-114 – OQ-118; Delete User's cascade is `M1D`, task 136)
- [x] **23.** `FU1` ValidationUtility (web) (OQ-119)
- [x] **24.** `FU2` PasswordStrengthUtility (OQ-120)
- [x] **25.** `K1` Tailwind theme + tokens (OQ-121)
- [x] **26.** `FU4` ThemeUtility (OQ-122)
- [x] **27.** `FU5` I18nUtility (OQ-123)
- [x] **28.** `FU7` API client (OQ-124)
- [x] **29.** `K2` Typography (OQ-125)
- [x] **30.** `K3` Icon set (OQ-126)
- [x] **31.** `K13` Segmented control (OQ-127)
- [x] **32.** `N14` Component library (Storybook) (OQ-128)
- [x] **33.** `K14` Option card (OQ-129)
- [x] **34.** `K16` Checkbox (OQ-130)
- [x] **35.** `K22` Popover (OQ-131)
- [x] **36.** `K28` Skeleton + loading + empty state
- [x] **37.** `K30` Badge / tag / pill (OQ-133)
- [x] **38.** `K31` Avatar (OQ-134)
- [x] **39.** `K34` Card / panel + section header + layouts (OQ-135)
- [x] **40.** `K4` Button
- [x] **41.** `K5` Text field
- [x] **42.** `K11` Select / combobox (OQ-138)
- [x] **43.** `K17` Code input (6 digits) (OQ-139)
- [x] **44.** `K23` Menu (OQ-140)
- [ ] **45.** `K25` Toast + inline banner
- [ ] **46.** `K26` Inline confirm
- [ ] **47.** `K27` Type-to-confirm
- [ ] **48.** `K6` Password field
- [ ] **49.** `FL1` Sign In
- [ ] **50.** `FL10` Household Deletion
- [ ] **51.** `FL2` Account Recovery
- [ ] **52.** `FL3` Registration
- [ ] **53.** `FL4` MFA Enrollment
- [ ] **54.** `FL5` Household Setup
- [ ] **55.** `FL8` Delete Account
- [ ] **56.** `FU3` AlertUtility
- [ ] **57.** `K45` List row
- [ ] **58.** `FL7` Security
- [ ] **59.** `FL9` Membership Management
- [ ] **60.** `S1` App Shell
- [ ] **61.** `X1` Authenticate
- [ ] **62.** `X2` Onboard (Registration, MFA, Household Setup)
- [ ] **63.** `X3` Manage Profile
- [ ] **64.** `X4` Manage Household
- [ ] **65.** `I1` IdentityManager seam suite
- [ ] **66.** `I7` Frontend ↔ backend: identity

## Slice 2 — Account setup

*Done when:* accounts, cards, categories, budgets, goals, plus the full onboarding wizard.

- [ ] **67.** `U3` ValidationUtility
- [ ] **68.** `A10` BudgetAccessor
- [ ] **69.** `A12` ValuationSnapshotAccessor
- [ ] **70.** `A13` GoalAccessor
- [ ] **71.** `A5` AccountAccessor
- [ ] **72.** `A6` CreditCardAccessor
- [ ] **73.** `A11` InvestmentHoldingAccessor
- [ ] **74.** `A14` IndexRateAccessor
- [ ] **75.** `A9` CategoryAccessor
- [ ] **76.** `M2` AccountManager
- [ ] **77.** `FU6` FormattingUtility
- [ ] **78.** `K15` Switch
- [ ] **79.** `K33` Progress bar
- [ ] **80.** `K42` Expandable row / accordion
- [ ] **81.** `K49` Stepper
- [ ] **82.** `K50` Category chip
- [ ] **83.** `K18` Icon picker
- [ ] **84.** `K19` Colour swatch picker
- [ ] **85.** `K48` Credit-card preview
- [ ] **86.** `K7` Money input
- [ ] **87.** `K8` Number / percent / rate input
- [ ] **88.** `K9` Date input
- [ ] **89.** `FL11` Account & Card Management
- [ ] **90.** `FL12` Category Management
- [ ] **91.** `FL13` Budget Management
- [ ] **92.** `FL14` Goal Management
- [ ] **93.** `FL6` Guided Setup
- [ ] **94.** `X5` Account Setup
- [ ] **95.** `X2G` Onboard: Guided Setup step
- [ ] **96.** `I2` AccountManager seam suite
- [ ] **97.** `I5` Manager pub/sub (household.created, holding.matured)
- [ ] **98.** `I8` Frontend ↔ backend: account setup

## Slice 3 — Day-to-day finances

*Done when:* record, browse, filter and edit transactions; month overview.

- [ ] **99.** `A7` AccountTransactionAccessor
- [ ] **100.** `A8` CardTransactionAccessor
- [ ] **101.** `E1` InvestmentProductEngine
- [ ] **102.** `E2` ReportingEngine
- [ ] **103.** `M3` TransactionManager
- [ ] **104.** `M4` InsightsManager
- [ ] **105.** `K32` Progress ring
- [ ] **106.** `K44` Key–value list
- [ ] **107.** `K20` Drawer / sheet
- [ ] **108.** `K29` Amount
- [ ] **109.** `K35` Card rail
- [ ] **110.** `K10` Date range picker
- [ ] **111.** `K12` Multi-select with search + presets
- [ ] **112.** `K36` Rail cards (balance / budget / goal)
- [ ] **113.** `K40` Period bar
- [ ] **114.** `K41` Grouped list + infinite scroll
- [ ] **115.** `K47` Allocation editor
- [ ] **116.** `FL15` Record Transaction
- [ ] **117.** `FL16` Browse Transactions
- [ ] **118.** `FL17` Month Overview
- [ ] **119.** `X6` Manage Finances
- [ ] **120.** `I3` TransactionManager seam suite
- [ ] **121.** `I4` InsightsManager seam suite
- [ ] **122.** `I9` Frontend ↔ backend: finances

## Slice 4 — Investments

*Done when:* holdings, market values, rates, payouts; the daily job.

- [ ] **123.** `N9` Local scheduler for investmentsDaily
- [ ] **124.** `K24` Tooltip
- [ ] **125.** `K43` Table
- [ ] **126.** `K38` Line chart / sparkline
- [ ] **127.** `K39` Stacked bar chart + legend
- [ ] **128.** `K37` Stat tile
- [ ] **129.** `K46` History editor
- [ ] **130.** `FL18` Portfolio Overview
- [ ] **131.** `FL19` Holding Maintenance
- [ ] **132.** `FL20` Rates Maintenance
- [ ] **133.** `X7` Track Investments
- [ ] **134.** `I6` investmentsDaily trigger end to end
- [ ] **135.** `I10` Frontend ↔ backend: investments

## Slice 5 — Insights & notifications

*Done when:* dashboard, audit export, notification bell routing, delete account.

- [ ] **136.** `M1D` IdentityManager: Delete User cascade
- [ ] **137.** `K21` Dialog
- [ ] **138.** `FL21` Dashboard
- [ ] **139.** `X8` Review Insights
- [ ] **140.** `I11` Frontend ↔ backend: insights
- [ ] **141.** `I12` Shell notification routing
- [ ] **142.** `I13` Delete account end to end

## Slice 6 — Hardening & first use

*Done when:* reviews, full test suites, then your real data.

- [ ] **143.** `N10` Security review (light)
- [ ] **144.** `N11` Accessibility audit
- [ ] **145.** `V1` Smoke suite
- [ ] **146.** `V2` Core E2E (14 journeys)
- [ ] **147.** `V3` Full E2E
- [ ] **148.** `N13` First real use + stabilization
- [ ] **149.** `V4` Load tests (k6)
