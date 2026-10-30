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
- [x] **83.** `K18` Icon picker (OQ-185: six fixed quick picks as a radio row + "More icons" popover with all 57; `categoryIcons` catalog section)
- [x] **84.** `K19` Colour swatch picker (OQ-186: all 18 palette colours inline, in palette order, as a radio group; `paletteColors` catalog section)
- [x] **85.** `K48` Credit-card preview (OQ-187: network detected from BIN ranges as data, network-aware grouping, Luhn check; live `CardPreview`, `CardNumberInput`, saved-card `CardRow`; one dark gradient per network)
- [x] **86.** `K7` Money input (OQ-188: digits fill from the right, cents first, in the currency's conventions; field and hero looks; minor units in and out)
- [x] **87.** `K8` Number / percent / rate input (OQ-189: the point typed with `,` or `.`, no grouping; fixed-point integers in and out — quantity × 10⁸, rate × 10,000, whole percent; field and compact sizes; a Quantity stops below the safe-integer ceiling)
- [x] **88.** `K9` Date input (OQ-190: typed in the interface language's order with the separators added, a `/` after one digit pads it; `YYYY-MM-DD` out, the pieces typed so far while incomplete so `isoDate` flags them; format placeholder from the catalog)
- [x] **107.** `K20` Drawer / sheet — moved up before FL11, the first Flow whose form opens in one (OQ-191: a modal dialog on Floating UI; right-hand 520px panel under the header from `md`, full-screen sheet below; the caller holds `open`, Esc / scrim / ✕ ask it to close; focus on the body's first field and back to the opener; 200ms slide, none under reduced motion)
- [x] **89.** `FL11` Account & Card Management (OQ-192: the Accounts tab of `/account-setup` is live, the other tabs placeholders; the opening balance is OQ-169's anchor with its hint; checking, savings and credit-card accounts carry their cards inline — the number never leaves the form, a new card is drawn live, an attached card's billing and expiry edit while its network and last four stay fixed; every member adds accounts, a Viewer's personal; type and currency lock at creation, visibility moves only in the creator's hands; archiving behind a destructive confirm; a failure shows in the drawer's banner only)
- [x] **90.** `FL12` Category Management (OQ-193: the card turns into its form in place; a subcategory joins through the category's own atomic PATCH; archiving cascades behind a confirm that names the count; Members create, Owner/Admin manage; the category list is the Experience's, fetched again after each write)
- [x] **91.** `FL13` Budget Management (OQ-194: one drawer for Add and Edit, currency and visibility locked on Edit; the claim-aware picker groups subcategories under their category with a chevron, weighs claims in the form's scope and names who holds a taken row; the budgets are the Experience's, fetched again after each write and after a failure that says they moved; delete behind the card's inline confirm; names at most 40 characters)
- [x] **92.** `FL14` Goal Management (OQ-195: built to the contract — the definitions show alone, under a banner, until `M4` builds `goal-progress`; the whole card opens its edit drawer, which holds Mark completed / Reopen and Delete behind inline confirms (mockup 43's icon buttons superseded), the rate field lifted above the card's hit area; the exchange rate a new K8 `exchange` kind, kept in the Flow by pair and never sent; names at most 40 characters; the ownership rule shared with Budgets)
- [x] **93.** `FL6` Guided Setup (OQ-196: mockups 11–14 followed — the account and budget forms inline in the step card, not in drawers; both with a Personal / Shared field, Shared to start; Category Management as it is, rendered by Onboard and handed into the wizard; the account step has no way on until an account is in use; a budget typed and not saved is asked about before finishing; card billing days and expiry from dropdowns)
- [x] **94.** `X5` Account Setup (OQ-197: the header after the open section, Add kept in each Flow; the open tab in the address, `?tab=`, replaced on a switch; a tab mounted at first opening and only hidden after, so a switch keeps its state)
- [x] **95.** `X2G` Onboard: Guided Setup step (explain the starting balance on Add Account — OQ-169) (OQ-198: its own address, `/setup/guided`, replacing Household Setup in the history; the household gate opens it for an active household with no account in use, so the first account is enforced after a drop-off (FR-1.22) — the rule kept in the frontend, read through `AccountManager`'s plain accounts list, not a `MyHousehold` field; Account Setup's account, category and budget requests shared through `setupRequests.ts`)
- [x] **96.** `I2` AccountManager seam suite (the M2 suites already cover 100% of the Manager; I2 adds the permission matrix across all 39 use cases — a refusal reads only what decides access — and the route refusing a fifth Account type)
- [x] **97.** `I5` Manager pub/sub (household.created, holding.matured) (OQ-199: the real bus between the real Managers, built and subscribed by `createManagers`, in `tests/integration/managers/pubsub.test.ts`, `holding.matured` published as the daily job will until N9; the default Categories checked through the API in core journey #1 (en-US) and Smoke #3 (pt-BR), polled after the household's 201)
- [x] **98.** `I8` Frontend ↔ backend: account setup (OQ-200: X5's four Flows and Guided Setup's resume and budget step, arranged and checked through the API; core journey #9 tagged `@core` — a Category claimed meanwhile, refused by the partial unique index; the rest Full E2E)
- [x] **R2.** Slice 2 review (gate — `docs/architecture/13-slice-review.md`, findings in `14-slice-2-review.md`, decisions OQ-202): mutation testing (PR #120), the Playwright suite (PR #121), code and architecture (this PR) — `captureLogs` now ends with its test (the OQ-199 carry-over), `src/api/` depends on nothing above it (an ESLint boundary)

## Slice 3 — Day-to-day finances

*Done when:* record, browse, filter and edit transactions; month overview.

- [x] **99.** `A7` AccountTransactionAccessor (OQ-201: adds `quantity_delta`, `cost_basis_delta`, `created_by_user_id`; Browse's day totals and month counts over the whole filtered set) — migration 0010 (the deltas both-or-neither); edit/delete guarded by the values read (`stale`); the picker matches a bill payment by its card; day totals by kind, signed by the Manager; `monthlySums` for ReportingEngine
- [x] **100.** `A8` CardTransactionAccessor (OQ-201: adds `created_by_user_id`; the per-card list endpoint is gone) — migration 0011 (+ the browse index in Browse's order, as A7); the cards come narrowed by the Manager (scope ∩ picker); both ledgers share `accessors/ledgerQuery.ts`
- [x] **101.** `E1` InvestmentProductEngine (OQ-201: `interestPayment` terms; Brazil on business days with coded holidays, US actual/365; index-linked amounts projected; maturity = interest + tax + redemption; no IOF; adds `interest_payment` to `investment_holdings`) — OQ-205: an index with no value refuses (`index_missing` — a buy 422 `index_rate.missing`, the Holding read degrades), payments roll to the following business day, coupons count back from the due date, regressive IR per payment; migration 0012 also keeps `due_date` and a CDI/Selic `rate_spread` on the Holding; a period whose index fell pays 0; `schedule` and `project` take the same terms
- [x] **102.** `E2` ReportingEngine — slice 3's part (OQ-206): the Month Overview and Goal progress (current and by month); a fixed-term Holding's value on a date from its trades' cost-basis deltas (`AccountTransactionAccessor.costBasisAsOf`); funding the viewer can't see counts unnamed; the investments shapes land with task 133, the Dashboard's with task 139
- [x] **103.** `M3` TransactionManager (OQ-207: allocations on all three trade kinds, a user-archived scheduled entry closes out, zeroed-Holding settlement by reference count, a lost race answers `transaction.changed`)
- [x] **104.** `M4` InsightsManager — slice 3's part (OQ-208: the report route is the contract's parameterized operation from day one, deferred types answer 400; Holdings read straight from their Accessor with E1 projections): `month-overview`, Goal progress (current and by month), the Holding reads with projections; `investments-overview`/`payouts` land with task 133, the Dashboard, inbox and audit-export routes in slice 5
- [x] **105.** `K32` Progress ring (OQ-209: SVG, not the conic gradient — a see-through hole and an animated sweep; held to 100% with the real figure in the label; the ring derives the label's colour — coral over budget, muted at 0 (not the mockups' faint); helpers shared via `kit/progress`; the auth preview now uses it)
- [x] **106.** `K44` Key–value list (OQ-210: `<dl>` of `<div>` pairs, the transaction mockups' row-split markup dropped; captions `type-label` in muted; no text in `faint` anywhere in the app — it stays for icons, dividers and borders; `sm`/`lg` sizes; the caller sets 2 or 3 columns; typed items — tone, suffix, tabular figures, a muted "—" when empty)
- [x] **108.** `K29` Amount (OQ-211: minor units through `formatMoney`, tabular on one line, no minus on −0; tones `plain` (default), `signed` (mint / coral by sign) and `inflow` (mint above zero only — the ledger's day totals); a coloured amount writes its `+`; size and weight from the caller's `className`; the account-setup money spans moved onto it)
- [x] **109.** `K35` Card rail (OQ-212: the whole section — SectionHeader, arrows and track; arrows page by the cards' positions so none is skipped, disabled at their end, gone when every card fits and below `md`, focus handed to the other arrow or the track; the edge fade a mask on whichever side has more, the snap padded clear of it; edges re-read through a ResizeObserver; the track a focusable region, its ring on an unmasked frame; the rail owns its loading placeholders; SectionHeader centres a one-line header)
- [x] **110.** `K10` Date range picker (OQ-213: the mockups' preset chips over a typed From / To — no calendar, correcting OQ-190; the caller's presets with Custom always last, resolved ending today; typing a date switches to Custom, Custom keeps the dates; the caller validates — `isoDate` on From, the new `dateRangeEnd(from)` on To, `date.before_start` client-only)
- [x] **111.** `K12` Multi-select with search + presets (OQ-214: a disclosure of K16 checkboxes, not a listbox; K11's entries and search; live — every tick reaches `onChange` in display order, Done only closes; All, the caller's presets and Clear replace the choice, disabled rows untouched; the box sums up "7 of 12 holdings · names +n" through the caller's `summary`; groups as columns with n/m counts; the caller's note beside Done, muted)
- [x] **112.** `K36` Rail cards (balance / budget / goal) (OQ-215: three display-only cards in `kit/railCard/` at the mockups' widths, narrower below `md`; a budget mint, sun from 75%, coral only above its target — used up exactly is sun; whole percents rounded down, on the Goals page too; only the name is cut off — figures and status wrap; mockup 34's phone sizes, the ring's new `rail` size; a goal reached says so in mint, one no Holding funds reads "Not funded yet", one other currencies fund notes the rate in place of "to go" — all read through the shared `experiences/goalFunding.ts`; the balance card's icon and colour are the caller's)
- [x] **113.** `K40` Period bar (OQ-216: the whole card with a `summary` slot Month Overview fills — In / Out / Total and the $ / R$ switch; bars scaled to the year's largest figure in the chosen currency; months after today's disabled, the year switch keeps the month, held back to today's; the caller's `firstYear` bounds the past; below `xl` mockup 34's month stepper over a swiped strip centring the selected month; the page makes it sticky; each month heard with its year and money in and out)
- [x] **114.** `K41` Grouped list + infinite scroll (OQ-217: the kit groups the caller's ordered items under sticky month headers and day bands — asides, rows and order the caller's; two currencies' day totals side by side, R$ first; headers stick under the App Shell's header (`--spacing-shell-header`), on phones under the period bar too (`stickyTop`); `Card size="none"` clips with `overflow-clip`; a sentinel asks for the next page once per page, never the first; skeleton rows only while loading, no guessed header; a failed page offers "Try again"; the caller's empty state when nothing loaded and nothing follows)
- [x] **115.** `K47` Allocation editor (OQ-218: one component for the buy drawer and Holding Maintenance — the caller holds the split and owns the frame; the row's ring optional (K32's new `xs`); "Add goal" a menu of the Goals left, naming the last one; the total may pass 100% while typing, coral, the caller blocks the write with `isAllocationValid`; an empty or 0% share errs on `showErrors`; a completed Goal's share fixed and removable; only the visible split, hidden shares the server's)
- [x] **116.** `FL15` Record Transaction (OQ-201: a Holding picker for sell/redemption/dividend/interest/tax; a sell's Goal split pre-filled and editable, OQ-206; interest payment on a fixed-term buy; edit locks kind and target) (OQ-219: any open account but a credit-card-only one pays a card's bill, in its currency — the backend follows; a purchase abroad recorded as billed; a buy offers its currency's fixed-term types; a fixed-term buy's edit reads its schedule and locks what D8 keeps; chips up to 10, a select beyond — the kit's new `ChipGroup`; a sell's split sent only once changed)
- [x] **117.** `FL16` Browse Transactions (OQ-220: the Experience's infinite query holds the applied filters and the pages, refetched whole after every write; the Flow holds the drawer's draft, the open row and its delete; "Show transactions" with no count; a Holding filter as a removable chip; Edit/Delete only where every touched account may be managed, an archived one noted; the kit's new `ChipChecks` and `MultiChoiceField`; kind and card names shared through `transactionNames.ts`)
- [x] **118.** `FL17` Month Overview (OQ-201: a mixed-currency Goal shows its own currency + a note; cards show the month-end outstanding) (OQ-221: one Flow, two grid regions — `overview-bar`, `overview-rails` — placed by X6 around the ledger; the month the Experience's query, the $ / R$ switch the Flow's, remembered, R$ the first time; the bar back to the earliest account or the household; balance colours hashed by id; an empty rail says so; a failed month a banner with Try again, never last month's figures; rails and balance cards shared with the Dashboard)
- [x] **119.** `X6` Manage Finances (OQ-222: a Holding's "See in Transactions" as `?holding=` in the address, named by its ticker, the other filters the page's; writes refresh the ledger, the month and the Goals by cache tags — a delete of a row already gone too; an edited buy opens once its Holding is read, a failure toasted; on a phone Filter in the ledger's heading and Record floating, the bar sticky with the month headers under it)
- [ ] **120.** `I3` TransactionManager seam suite
- [ ] **121.** `I4` InsightsManager seam suite
- [ ] **122.** `I9` Frontend ↔ backend: finances (OQ-201: smoke #4; core #5 up to Month Overview, #7, #11, and #6's Holding + schedule)
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
- [ ] **133.** `X7` Track Investments (with InsightsManager's `investments-overview` and `payouts` reports — OQ-201 — and ReportingEngine's investments shapes, OQ-206)
- [ ] **134.** `I6` investmentsDaily trigger end to end
- [ ] **135.** `I10` Frontend ↔ backend: investments
- [ ] **R4.** Slice 4 review (gate)

## Slice 5 — Insights & notifications

*Done when:* dashboard, audit export, notification bell routing, delete account.

- [ ] **136.** `M1D` IdentityManager: Delete User cascade (then turn on `profile.deleteAccount` in the web settings and drop `DELETE /users/me` from the contract-routes test's plan list, OQ-163)
- [ ] **137.** `K21` Dialog
- [ ] **138.** `FL21` Dashboard
- [ ] **139.** `X8` Review Insights (with InsightsManager's Dashboard, notification inbox and audit-log export routes — OQ-201 — and ReportingEngine's Dashboard shape, OQ-206)
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
