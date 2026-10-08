# Design — approved look & feel

The approved UI design for New Finance App, produced in the Superdesign
round of October 2026. It replaces the old Python-generated HTML mockups
(`mockups/`, deleted) as the visual and UX reference for development.

- **Open `index.html`** to browse every page. Each file in `pages/` is a
  self-contained static HTML page (Tailwind CDN + Iconify icons + Google
  Fonts), exported from the Superdesign canvas.
- The pages are **reference designs, not production code.** They show
  representative states (an open drawer, an expanded row, an inline
  confirm), not every state. Where a page shows a simplified form, the
  build must still implement the full form described in the requirements
  (e.g. every investment kind on Record Transaction).
- Superdesign project: "New Finance App — Transactions" (canvas ids in
  `.superdesign/resume.json`, git-ignored).

## Design system

| Aspect | Decision |
|---|---|
| Stack | Tailwind CSS + our own reusable components (replaces MUI — see NFR-UX-1). Headless primitives (Radix UI / Headless UI) for accessibility-heavy pieces: drawers/sheets, menus, switches. |
| Shape | Rounded: cards radius 20px, inputs 14px, buttons and pills fully rounded. |
| Type | Manrope (headings, big numbers) + Inter (text). All amounts use tabular figures. |
| Icons | Material Symbols (outlined) via Iconify; card networks via Iconify `logos` set. |
| Colour | Token-based, dark default + light theme. Every colour is a CSS variable (`--c-*`, RGB channels) so Tailwind opacity modifiers keep working. Theme switches by setting `data-theme="light"` on `<html>`; no per-page redesign. |
| Money semantics | Inflow = mint/green, outflow = coral/red, over budget = coral error state. Currency always explicit (R$ / $); currencies are never summed (no FX). |
| Category colour | Each category has an icon + colour, reused everywhere it appears (ledger, budgets, categories). |
| Motion | 150–250ms ease for hover, drawer slide, progress fills. |
| Responsive | Desktop-first; mobile layout validated on Transactions (sticky period header, swipe rails, overview first, floating Record button, drawers become full-screen sheets). |

### Colour tokens

| Token | Dark | Light |
|---|---|---|
| `--c-bg` | `#0C100F` | `#F4F7F5` |
| `--c-card` | `#131917` | `#FFFFFF` |
| `--c-raised` | `#1A211E` | `#EEF3F0` |
| `--c-line` | `#232C28` | `#DCE4DF` |
| `--c-track` | `#222B27` | `#E3EAE6` |
| `--c-ink` | `#E7ECE9` | `#13201A` |
| `--c-muted` | `#97A39D` | `#56655E` |
| `--c-faint` | `#5F6B65` | `#8A9791` |
| `--c-mint` (primary / inflow) | `#5EE6B8` | `#0E9467` |
| `--c-mintdeep` | `#0F3B2E` | `#DDF4EA` |
| `--c-onmint` | `#062A1F` | `#FFFFFF` |
| `--c-onmint2` | `#00382B` | `#FFFFFF` |
| `--c-coral` (outflow / error) | `#FF6B6B` | `#D2383B` |
| `--c-coraldeep` | `#3A1717` | `#FBE5E5` |
| `--c-oncoral` | `#2A0A0A` | `#FFFFFF` |
| `--c-sky` (goals / BRL series) | `#7CB9FF` | `#2368C9` |
| `--c-onsky` | `#0A1E33` | `#FFFFFF` |
| `--c-sun` | `#FFD166` | `#B07800` |
| `--c-lilac` | `#C792EA` | `#8A4CC6` |
| `--c-peach` | `#FF8C69` | `#D2602B` |
| `--c-deep` | `#0A0E0D` | `#E9F1ED` |

### Category palette (18 colours, OQ-85)

Categories store a **token**, not a hex. Each token has a dark and a light
value; all pass ≥ 4.5:1 contrast on card backgrounds in both themes. The
payout chart's top-5 series use the same palette.

| Token | Dark | Light |
|---|---|---|
| `mint` | `#5EE6B8` | `#0B7A55` |
| `emerald` | `#34D399` | `#047857` |
| `teal` | `#2DD4BF` | `#0F766E` |
| `cyan` | `#22D3EE` | `#0E7490` |
| `sky` | `#7CB9FF` | `#2368C9` |
| `blue` | `#60A5FA` | `#1D4ED8` |
| `indigo` | `#A5B4FC` | `#4338CA` |
| `violet` | `#C4B5FD` | `#6D28D9` |
| `lilac` | `#C792EA` | `#8A4CC6` |
| `fuchsia` | `#F0ABFC` | `#A21CAF` |
| `pink` | `#F9A8D4` | `#BE185D` |
| `rose` | `#FDA4AF` | `#BE123C` |
| `coral` | `#FF6B6B` | `#C2302F` |
| `peach` | `#FF8C69` | `#C2410C` |
| `orange` | `#FDBA74` | `#B45309` |
| `sun` | `#FFD166` | `#946200` |
| `lime` | `#BEF264` | `#4D7C0F` |
| `slate` | `#CBD5E1` | `#475569` |

`source/themeify.py` holds the theme token table above and converts a page to the
variable-based form; `22-dashboard-light-theme.html` is the proof.

## Recurring UI patterns

- **Time context bar** (Transactions): year switcher + 12-month strip with
  in/out mini bars + In/Out/Total summary (single currency at a time via a
  $/R$ switch). Drives balances, budgets and goals — **not** the ledger.
- **Ledger**: all transactions, newest first, lazily loaded, sticky month
  headers + day headers with day totals. Rows expand on click to reveal
  details and Edit/Delete.
- **Card rails**: horizontally scrolling rows of fixed-width cards
  (balances, budgets, goals) with snap, edge fade and arrow buttons.
- **Progress**: rings for budget/goal cards in rails; pill bars with the
  amount inside for goal lists.
- **Drawers**: right-side drawer for every focused form (Record, Filter,
  Edit, Add Budget/Goal, Value history); full-screen sheet on mobile.
- **Inline confirms**: archive/delete (coral, irreversible) and
  mark-completed (mint, reversible) confirm inside the card or row.
- **Setup pages are configuration**: Budgets cards show no spend progress;
  Goals cards do show a completion bar plus "Funded by" holdings.
- **Navigation**: hamburger drawer — identity, household switcher (with
  pending invitations and "Create household"), main nav, Records ("Export
  audit log", Owner/Admin only → date-range dialog), Profile / Sign out.
  Theme lives on Profile only. Reporting is v2, so it isn't in the menu.
- **Header**: logo left, **notification bell** right (unseen count; inbox
  with actionable items — accept/decline an invitation, archive a matured
  holding).
- **Payout over time**: stacked monthly bars from dividend/interest
  transactions, full-width multi-select dropdown (search, presets by type),
  top 5 selected holdings in colour + "Others"; on Dashboard and
  Investments.

## Pages

| # | Page | What it establishes |
|---|---|---|
| 01–09 | Auth | Brand panel with product preview; sign in, register (first/last name, 12-char min password with strength meter), forgot/reset, MFA method/setup/backup codes/code entry. |
| 10–14 | Guided setup | Name household → mandatory first account (4 types: checking, savings, credit card only, investment; add-card form + live card preview) → review starter categories → optional budget → setup complete with next steps. Main nav hidden. |
| 20–24 | Dashboard | Net worth per currency with month-over-month badge, coming-due list, payout over time, balance/budget/goal rails (over-budget first). Variants: nav menu open, light theme, notifications open, audit-log export dialog. |
| 30–34 | Transactions | Main page, Record drawer (cash), Investment buy drawer (full fixed-income + goal allocation), Filter drawer (any date range), mobile layout. |
| 40–43 | Account Setup | Accounts (card grid, mini credit cards, edit drawer form style), Categories (icon + colour, inline subcategories), Budgets (claim-aware category picker), Goals (progress + funded by, Active/Completed, mixed-currency goal with an on-the-fly exchange-rate input). |
| 50–53 | Investments | Overview (payout this month from transactions + payout chart; Portfolio Builders disabled — v2), Holdings by account (read-only positions; fixed-income Contract panel; market value with history chart; editable goal allocation), Value history drawer (edit/delete snapshots), Rates (manual Selic/CDI/IPCA/IGP-M). |
| 60 | Household | Members with role menu, invite + pending invitations, danger zone. |
| 70 | Profile | Personal info, preferences (Dark/Light/System, language), password, sessions (sign out all others), invitations, delete account. |

Known gap: `34-transactions-mobile` predates the "ledger lists all
transactions" decision and still shows a month-scoped ledger title.

## Dashboard widget backlog (future, not committed)

Carried over from the deleted mockups so it isn't lost:

- **Performance & returns:** gain/loss per holding and portfolio-wide
  (cost basis vs current value); realized vs unrealized gains; time/
  money-weighted return (XIRR); best/worst performers.
- **Income:** dividends/interest received over time; upcoming
  fixed-income maturities and cash-event schedule.
- **Allocation & diversification:** currency exposure split;
  concentration-risk callout; actual-vs-target allocation / rebalancing
  (maps to the FII & Stock Portfolio Builders, FR-5.5/5.6). Stocks and
  FIIs allocation cards are already designed on Investments → Overview.
- **Goals cross-reference:** holdings not allocated to any goal;
  projected funding date per goal from its growth trend.
- **Activity:** recent investment transactions; upcoming scheduled cash
  events.
- **Household:** personal vs shared holdings; per-member contribution to
  a shared goal.
- **Later phase (already future-scope in the FRs):** benchmark comparison
  (FR-5.7); watchlist of unowned tickers.
- **Standalone Dashboard candidates:** net-worth trend alone; this month's
  investment activity delta; principal-vs-gains split.
