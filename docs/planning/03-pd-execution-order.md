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

**Slice gate (OQ-164):** a slice ends with its review, `R<n>` — mutation
testing, the Playwright suite, then code and architecture, one phase at a
time, findings before fixes (`docs/architecture/13-slice-review.md`). The
next slice starts only once it is ticked.

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
- [x] **45.** `K25` Toast + inline banner
- [x] **46.** `K26` Inline confirm (OQ-142)
- [x] **47.** `K27` Type-to-confirm (OQ-143)
- [x] **48.** `K6` Password field (OQ-144)
- [x] **49.** `FL1` Sign In (OQ-145: two-step sign-in, backend included)
- [x] **50.** `FL10` Household Deletion
- [x] **51.** `FL2` Account Recovery (OQ-147)
- [x] **52.** `FL3` Registration (OQ-148)
- [x] **53.** `FL4` MFA Enrollment (OQ-149: enrollment confirmation, backend included)
- [x] **54.** `FL5` Household Setup (OQ-150)
- [x] **55.** `FL8` Delete Account (OQ-151)
- [x] **56.** `FU3` AlertUtility (OQ-152)
- [x] **57.** `K45` List row (OQ-153)
- [x] **58.** `FL7` Security (OQ-154)
- [x] **59.** `FL9` Membership Management (OQ-155)
- [x] **60.** `S1` App Shell (OQ-156: React Router v7; chrome data injected by its owners)
- [x] **61.** `X1` Authenticate (OQ-157: hosts the resumed MFA enrollment; Sign Out ends locally even if the logout fails)
- [x] **62.** `X2` Onboard (Registration, MFA, Household Setup) (OQ-158: the route picks the stretch; the server's state is the progression)
- [x] **63.** `X3` Manage Profile (OQ-159: brings in Manage Household's households list; preferences apply at once, undone if refused)
- [x] **64.** `X4` Manage Household (OQ-160: Leave Household is its own card; leaving or deleting lands on the next household's Dashboard, or Onboard)
- [x] **65.** `I1` IdentityManager seam suite (the M1 suites already cover 100% of the Manager; I1 adds the permission matrix — Delete User's scenarios wait for `M1D`)
- [x] **66.** `I7` Frontend ↔ backend: identity (OQ-161: journeys tagged by BDT tier, arranged through the API; a new account starts in the language it registered in)
- [x] **R1.** Slice 1 review (`docs/architecture/12-code-review-2026-10.md`, PRs #72–#75; OQ-162, OQ-163, OQ-164)

## Slice 2 — Account setup

*Done when:* accounts, cards, categories, budgets, goals, plus the full onboarding wizard.

- [x] **67.** `U3` ValidationUtility (OQ-165: only what the contract can't say; v1 currencies BRL/USD in the contract; slice 1's name checks moved onto it)
- [x] **68.** `A10` BudgetAccessor (OQ-166: claims per scope, a spend accrues to its Account's scope; target sets written atomically; periods opened at creation, then lazily with the target in effect)
- [x] **69.** `A12` ValuationSnapshotAccessor (OQ-167: keyed by Holding, the Manager guards the household; manual edits refuse automatic rows; `latestAsOf` for reporting, the later-written same-day snapshot wins)
- [x] **70.** `A13` GoalAccessor (OQ-168: Goals store percentages only; one replace-all allocation write; a buy's split re-weights by value at the buy's price; visibility and the completed-Goal rule are the Managers')
- [x] **71.** `A5` AccountAccessor (OQ-169: the starting balance is the balance on the creation day — an older transaction only rebuilds history; the month chain has no gaps; `applyMovement` takes the date)
- [x] **72.** `A6` CreditCardAccessor (OQ-170: a cycle is named by the month it closes in; a closing-day edit never moves the past; one signed `applyMovement` with the date — a bill payment also debits its Account)
- [x] **73.** `A11` InvestmentHoldingAccessor (OQ-171: the Manager signs quantity and cost-basis deltas; a re-buy reopens a zeroed Holding and the buy's re-weighting clears its old Goal split; a schedule is replaced until an entry posts, each entry posted once; a shared matured Holding's recipients are the Manager's)
- [x] **74.** `A14` IndexRateAccessor (OQ-172: one value per index per day, refused on record and on a date edit; no future dates, so the latest is the highest date; the Rates tab's list is AccountManager's)
- [x] **75.** `A9` CategoryAccessor (OQ-173: one atomic edit incl. Subcategories; icon/colour refused outside the in-code sets; defaults seeded once per household; names not unique)
- [x] **76.** `M2` AccountManager (built in five parts, PRs #85–#89 — OQ-174..178: household data under `/households/{householdId}`; Accounts+cards and Budget edits in one transaction; Goal progress is InsightsManager's; a Holding takes its Account's access, hidden Goal shares are carried over, only a matured Holding is archived by hand)
- [x] **77.** `FU6` FormattingUtility
- [x] **78.** `K15` Switch (OQ-180: visibility stays the mockup's two-choice pick; label left, switch right)
- [x] **79.** `K33` Progress bar (OQ-181: pill with its text two-toned over the fill; thin bar stacks segments, held to 100%)
- [x] **80.** `K42` Expandable row / accordion (OQ-182: `row` and `card` surfaces; panel mounted only while open; own or caller-held state)
- [x] **81.** `K49` Stepper (OQ-183: done / current / next from `current`; a row of dots below `lg`; display only)
- [x] **82.** `K50` Category chip (OQ-184: `CategoryDisc` xs/sm/md/lg + `CategoryChip` pill; colour + `/15` tint inline via ThemeUtility; display only)
- [ ] **83.** `K18` Icon picker
- [ ] **84.** `K19` Colour swatch picker
- [ ] **85.** `K48` Credit-card preview
- [ ] **86.** `K7` Money input
- [ ] **87.** `K8` Number / percent / rate input
- [ ] **88.** `K9` Date input
- [ ] **89.** `FL11` Account & Card Management (explain the starting balance on Add Account — OQ-169)
- [ ] **90.** `FL12` Category Management
- [ ] **91.** `FL13` Budget Management
- [ ] **92.** `FL14` Goal Management
- [ ] **93.** `FL6` Guided Setup
- [ ] **94.** `X5` Account Setup
- [ ] **95.** `X2G` Onboard: Guided Setup step (explain the starting balance on Add Account — OQ-169)
- [ ] **96.** `I2` AccountManager seam suite
- [ ] **97.** `I5` Manager pub/sub (household.created, holding.matured)
- [ ] **98.** `I8` Frontend ↔ backend: account setup
- [ ] **R2.** Slice 2 review (gate — `docs/architecture/13-slice-review.md`)

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
- [ ] **R3.** Slice 3 review (gate)

## Slice 4 — Investments

*Done when:* holdings, market values, rates, payouts; the daily job.

- [ ] **123.** `N9` Local scheduler for investmentsDaily
- [x] **124.** `K24` Tooltip (built early with task 64, OQ-160; chart-point tooltips stay with the charts)
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
- [ ] **R4.** Slice 4 review (gate)

## Slice 5 — Insights & notifications

*Done when:* dashboard, audit export, notification bell routing, delete account.

- [ ] **136.** `M1D` IdentityManager: Delete User cascade (then turn on `profile.deleteAccount` in the web settings and drop `DELETE /users/me` from the contract-routes test's plan list, OQ-163)
- [ ] **137.** `K21` Dialog
- [ ] **138.** `FL21` Dashboard
- [ ] **139.** `X8` Review Insights
- [ ] **140.** `I11` Frontend ↔ backend: insights
- [ ] **141.** `I12` Shell notification routing
- [ ] **142.** `I13` Delete account end to end
- [ ] **R5.** Slice 5 review (gate)

## Slice 6 — Hardening & first use

*Done when:* reviews, full test suites, then your real data.

- [ ] **143.** `N10` Security review (light)
- [ ] **144.** `N11` Accessibility audit
- [ ] **145.** `V1` Smoke suite
- [ ] **146.** `V2` Core E2E (14 journeys)
- [ ] **147.** `V3` Full E2E (incl. the password-reset journey, once a test email sink is chosen — OQ-164)
- [ ] **148.** `N13` First real use + stabilization
- [ ] **149.** `V4` Load tests (k6)
- [ ] **R6.** Slice 6 review (gate — before the release)
