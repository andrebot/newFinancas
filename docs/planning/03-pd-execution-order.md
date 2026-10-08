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

**Three splits made for slicing** (148 activities, up from 145):
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
- [ ] **5.** `N7` API contract tooling
- [ ] **6.** `N8` i18n catalog package
- [ ] **7.** `N5` Schema + migrations baseline
- [ ] **8.** `N12` Local operations (backup/restore)
- [ ] **9.** `N6` Reference data + seeds

## Slice 1 — Identity & household

*Done when:* register, enable MFA, create a household, sign in, manage profile and members — in the browser, against the real API.

- [ ] **10.** `U1` CorrelationIdUtility
- [ ] **11.** `U4` AuthenticationUtility
- [ ] **12.** `U6` ServiceBusUtility
- [ ] **13.** `A1` UserAccessor
- [ ] **14.** `A15` AuditLogAccessor
- [ ] **15.** `A16` NotificationInboxAccessor
- [ ] **16.** `A2` SessionAccessor
- [ ] **17.** `A3` HouseholdAccessor
- [ ] **18.** `A4` InvitationAccessor
- [ ] **19.** `U2` LoggingUtility
- [ ] **20.** `U5` AuthorizationUtility
- [ ] **21.** `U7` NotificationDeliveryUtility
- [ ] **22.** `M1` IdentityManager
- [ ] **23.** `FU1` ValidationUtility (web)
- [ ] **24.** `FU2` PasswordStrengthUtility
- [ ] **25.** `K1` Tailwind theme + tokens
- [ ] **26.** `FU4` ThemeUtility
- [ ] **27.** `FU5` I18nUtility
- [ ] **28.** `FU7` API client
- [ ] **29.** `K2` Typography
- [ ] **30.** `K3` Icon set
- [ ] **31.** `K13` Segmented control
- [ ] **32.** `K14` Option card
- [ ] **33.** `K16` Checkbox
- [ ] **34.** `K22` Popover
- [ ] **35.** `K28` Skeleton + loading + empty state
- [ ] **36.** `K30` Badge / tag / pill
- [ ] **37.** `K31` Avatar
- [ ] **38.** `K34` Card / panel + section header + layouts
- [ ] **39.** `K4` Button
- [ ] **40.** `K5` Text field
- [ ] **41.** `K11` Select / combobox
- [ ] **42.** `K17` Code input (6 digits)
- [ ] **43.** `K23` Menu
- [ ] **44.** `K25` Toast + inline banner
- [ ] **45.** `K26` Inline confirm
- [ ] **46.** `K27` Type-to-confirm
- [ ] **47.** `K6` Password field
- [ ] **48.** `FL1` Sign In
- [ ] **49.** `FL10` Household Deletion
- [ ] **50.** `FL2` Account Recovery
- [ ] **51.** `FL3` Registration
- [ ] **52.** `FL4` MFA Enrollment
- [ ] **53.** `FL5` Household Setup
- [ ] **54.** `FL8` Delete Account
- [ ] **55.** `FU3` AlertUtility
- [ ] **56.** `K45` List row
- [ ] **57.** `FL7` Security
- [ ] **58.** `FL9` Membership Management
- [ ] **59.** `S1` App Shell
- [ ] **60.** `X1` Authenticate
- [ ] **61.** `X2` Onboard (Registration, MFA, Household Setup)
- [ ] **62.** `X3` Manage Profile
- [ ] **63.** `X4` Manage Household
- [ ] **64.** `I1` IdentityManager seam suite
- [ ] **65.** `I7` Frontend ↔ backend: identity

## Slice 2 — Account setup

*Done when:* accounts, cards, categories, budgets, goals, plus the full onboarding wizard.

- [ ] **66.** `U3` ValidationUtility
- [ ] **67.** `A10` BudgetAccessor
- [ ] **68.** `A12` ValuationSnapshotAccessor
- [ ] **69.** `A13` GoalAccessor
- [ ] **70.** `A5` AccountAccessor
- [ ] **71.** `A6` CreditCardAccessor
- [ ] **72.** `A11` InvestmentHoldingAccessor
- [ ] **73.** `A14` IndexRateAccessor
- [ ] **74.** `A9` CategoryAccessor
- [ ] **75.** `M2` AccountManager
- [ ] **76.** `FU6` FormattingUtility
- [ ] **77.** `K15` Switch
- [ ] **78.** `K33` Progress bar
- [ ] **79.** `K42` Expandable row / accordion
- [ ] **80.** `K49` Stepper
- [ ] **81.** `K50` Category chip
- [ ] **82.** `K18` Icon picker
- [ ] **83.** `K19` Colour swatch picker
- [ ] **84.** `K48` Credit-card preview
- [ ] **85.** `K7` Money input
- [ ] **86.** `K8` Number / percent / rate input
- [ ] **87.** `K9` Date input
- [ ] **88.** `FL11` Account & Card Management
- [ ] **89.** `FL12` Category Management
- [ ] **90.** `FL13` Budget Management
- [ ] **91.** `FL14` Goal Management
- [ ] **92.** `FL6` Guided Setup
- [ ] **93.** `X5` Account Setup
- [ ] **94.** `X2G` Onboard: Guided Setup step
- [ ] **95.** `I2` AccountManager seam suite
- [ ] **96.** `I5` Manager pub/sub (household.created, holding.matured)
- [ ] **97.** `I8` Frontend ↔ backend: account setup

## Slice 3 — Day-to-day finances

*Done when:* record, browse, filter and edit transactions; month overview.

- [ ] **98.** `A7` AccountTransactionAccessor
- [ ] **99.** `A8` CardTransactionAccessor
- [ ] **100.** `E1` InvestmentProductEngine
- [ ] **101.** `E2` ReportingEngine
- [ ] **102.** `M3` TransactionManager
- [ ] **103.** `M4` InsightsManager
- [ ] **104.** `K32` Progress ring
- [ ] **105.** `K44` Key–value list
- [ ] **106.** `K20` Drawer / sheet
- [ ] **107.** `K29` Amount
- [ ] **108.** `K35` Card rail
- [ ] **109.** `K10` Date range picker
- [ ] **110.** `K12` Multi-select with search + presets
- [ ] **111.** `K36` Rail cards (balance / budget / goal)
- [ ] **112.** `K40` Period bar
- [ ] **113.** `K41` Grouped list + infinite scroll
- [ ] **114.** `K47` Allocation editor
- [ ] **115.** `FL15` Record Transaction
- [ ] **116.** `FL16` Browse Transactions
- [ ] **117.** `FL17` Month Overview
- [ ] **118.** `X6` Manage Finances
- [ ] **119.** `I3` TransactionManager seam suite
- [ ] **120.** `I4` InsightsManager seam suite
- [ ] **121.** `I9` Frontend ↔ backend: finances

## Slice 4 — Investments

*Done when:* holdings, market values, rates, payouts; the daily job.

- [ ] **122.** `N9` Local scheduler for investmentsDaily
- [ ] **123.** `K24` Tooltip
- [ ] **124.** `K43` Table
- [ ] **125.** `K38` Line chart / sparkline
- [ ] **126.** `K39` Stacked bar chart + legend
- [ ] **127.** `K37` Stat tile
- [ ] **128.** `K46` History editor
- [ ] **129.** `FL18` Portfolio Overview
- [ ] **130.** `FL19` Holding Maintenance
- [ ] **131.** `FL20` Rates Maintenance
- [ ] **132.** `X7` Track Investments
- [ ] **133.** `I6` investmentsDaily trigger end to end
- [ ] **134.** `I10` Frontend ↔ backend: investments

## Slice 5 — Insights & notifications

*Done when:* dashboard, audit export, notification bell routing, delete account.

- [ ] **135.** `M1D` IdentityManager: Delete User cascade
- [ ] **136.** `K21` Dialog
- [ ] **137.** `FL21` Dashboard
- [ ] **138.** `X8` Review Insights
- [ ] **139.** `I11` Frontend ↔ backend: insights
- [ ] **140.** `I12` Shell notification routing
- [ ] **141.** `I13` Delete account end to end

## Slice 6 — Hardening & first use

*Done when:* reviews, full test suites, then your real data.

- [ ] **142.** `N10` Security review (light)
- [ ] **143.** `N11` Accessibility audit
- [ ] **144.** `V1` Smoke suite
- [ ] **145.** `V2` Core E2E (14 journeys)
- [ ] **146.** `V3` Full E2E
- [ ] **147.** `N13` First real use + stabilization
- [ ] **148.** `V4` Load tests (k6)
