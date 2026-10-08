# API Design

The layer below the data model (`docs/architecture/02-data-model.md`) and
the sequence-diagram sweep (`docs/design/diagrams/sequences/`, 48 of 48 use cases),
and the layer above implementation. This document is the *why*; the
contract itself — every route, request/response schema, and status
code — is `docs/architecture/api/openapi.yaml`, a complete OpenAPI 3.1
document (validated with `openapi-spec-validator`). Read that file to
implement against; read this one to understand a convention or trace a
decision back to its reasoning.

**Derivation, in order:** every route and status code already decided in
the 48 sequence diagrams is carried over unchanged — this document
doesn't re-litigate those. What's new here is (1) the handful of
cross-cutting conventions that apply to *every* endpoint, decided once
rather than per-domain, and (2) the endpoints no sequence diagram ever
covered, because the use-case sweep was about state-changing actions,
not bulk retrieval — every `GET` list/collection endpoint in the spec is
new design surface from this pass, flagged below.

Open Banking (FR-2.5/2.6/3.3) and the Portfolio Builder (CUC-7) are
deferred whole, same as everywhere else in this project — no endpoints
exist for either.

## Cross-cutting conventions

- **Base path `/api/v1`.** No versioning decision was forced by any
  requirement — this is a default-good-practice call, cheap to make now,
  expensive to retrofit later.
- **Auth: stateless JWT bearer token** (`Authorization: Bearer <token>`),
  matching OQ-30's confirmed mechanism. Public (no auth required):
  `POST /auth/register`, `POST /auth/login`, `POST /auth/password-reset/request`,
  `POST /auth/password-reset/confirm`, `POST /auth/mfa/recover` — every
  other endpoint requires a valid access token.
- **Money is an integer — a count of the currency's minor unit (cents
  for USD/BRL) — never a decimal, and never a string.** `$1,234.56` is
  transmitted as `123456`. **Revised from the original decision**
  (decimal-as-string, to dodge IEEE-754 float precision loss): a
  frontend doing normal arithmetic on a string still has to parse it
  into a number and re-stringify the result on every operation, which
  just relocates the friction rather than removing it. Integers don't
  have that problem — JS numbers are exact for any realistic monetary
  value (household finances never approach `Number.MAX_SAFE_INTEGER`
  cents), so `+`/`-`/`*` work with zero ceremony on either side of the
  API. This isn't API-layer-only: **the Postgres columns themselves are
  `bigint`, not `numeric`/`decimal`** (`02-data-model.md`'s money
  representation note) — DB, backend, API, and frontend all hold the
  exact same integer, so there is no conversion step anywhere in the
  stack to get wrong. The one thing given up is writing `WHERE amount >
  10.50` instead of `WHERE amount > 1050` in raw SQL — trivial.
- **`investment_holdings.quantity` gets the identical treatment, closing
  the question the money revision first left open** — also an integer,
  also `bigint` at the DB layer, but scaled by **1e-8 (8 decimal places,
  factor 100,000,000)** rather than currency's 2. `10` shares transmits
  as `1000000000`; Tesouro Direto's `0.01` minimum increment is
  `100000`. Quantity has no ISO-4217-style standard giving it a natural
  per-instrument exponent the way currency has minor units — a
  whole-share stock, a 0.01-precision Treasury bond, and a
  finer-grained fund unit all coexist under FR-5.1/FR-11.1 — so this
  picks one fixed exponent generous enough for every `assetType` in
  scope, rather than a per-instrument lookup table. Same reasoning as
  money's 2-decimal assumption: one fixed convention now, revisit only
  if a real instrument needs more precision than 1e-8 offers (none in
  v1's scope do).
- **`percentage` (Goal allocations) — revised Oct 2026: whole-percent
  integer** (`60` = 60%, 1–100, OQ-87), no longer a native number — exact
  sums for FR-8.3's 100% cap and identical rounding front and back
  (contribution = value × pct / 100, half-up to the cent). Basis points
  were considered and rejected: no real use case for fractional splits. **Rates** (`rate.value`, index
  values) are integers too: percent × 10,000 (OQ-86).
- **Reference-data fields (`kind`, `assetType`, `widgetType`, `effect`'s
  underlying `EFFECT_BY_KIND` values, `network`, `frequency`) are plain
  `string` in the schema, not a closed OpenAPI `enum`**, wherever the
  requirements explicitly call the field extensible ("a new Transaction
  Kind is a data addition, not a schema/code change," FR-3.1; same
  language for Widget Type FR-6.7, Credit Card network FR-2.8). An
  `enum` constraint would silently contradict that design principle —
  client-side codegen would treat a new value as a contract break it
  isn't. Genuinely **closed** sets (household `role`, invitation
  `status`, account `type`, `visibility`, card transaction `kind`
  charge/refund) do use `enum`, since those are real fixed vocabularies
  per FR-1.6/1.10/2.1/2.3/3.9.
- **Error envelope**, one shape everywhere — **revised Oct 2026 (OQ-83,
  NFR-I18N-3):**
  ```json
  {"error": {"code": "goal.allocation_exceeds_100", "params": {"current": 8500, "requested": 3000},
             "message": "dev-only English", "details": [{"field": "allocations[1].percentage", "code": "number.max", "params": {"max": 1500}}],
             "correlationId": "…"}}
  ```
  `code` is specific and namespaced (`domain.reason`), `params` carries
  raw values, `details[]` has field-level `{field, code, params}`.
  **`message` is English for developers/logs only — the UI never shows
  it**; the frontend localizes `code` + `params` from the shared i18n
  catalog, and a test fails if any code lacks a translation.
  `correlationId` matches the server logs (NFR-OBS-1). The generic codes
  (`validation.failed`, `request.invalid`, `route.not_found`,
  `internal.unexpected`) and the field-level `details[].code` values are
  listed in OQ-93.
- **Status code conventions, applied consistently rather than per-file:**
  `403` for "authenticated but not permitted" (authorization failures —
  `AuthorizationUtility` rejections); `404` for "doesn't exist, or isn't
  yours" — used deliberately over `403` wherever confirming existence to
  a non-owner would leak information (sessions, notifications — matches
  the enumeration-avoidance instinct already used for Login's identical
  401 on bad-email-vs-bad-password); `409` for a request that conflicts
  with current state (budget target overlap FR-4.7, allocation over 100%
  FR-8.3, invitation no longer pending, duplicate registration email);
  `422` for request-body validation failures; `401` for authentication
  failures (bad credentials, expired/missing token).
- **Pagination — cursor for the transaction list (Oct 2026):** `GET
  /transactions` merges both ledgers newest-first and paginates with an
  opaque `cursor` (keyset on `(date, id)`, response `nextCursor`) —
  offsets would shift as new transactions arrive while scrolling.
  Everything else keeps the offset scheme below.
- **Pagination**: `limit`/`offset` query params (default `limit=20`,
  max `100`), response shape `{"data": [...], "pagination": {"limit",
  "offset", "total"}}`. Applied to every collection that can plausibly
  grow large (accounts, budgets, goals, transactions of both
  ledgers) — not applied to collections that are structurally small by
  construction (a household's members, a category's subcategories, a
  budget's targets), which return a bare `{"data": [...]}` with no
  pagination envelope at all.
- **Dates**: `date` (`YYYY-MM-DD`) for date-only fields (`date`,
  `dueDate`, `asOfDate`, `nextRunDate`) matching the data model's own
  `date`-vs-`timestamp` column split; `date-time` (full ISO 8601) for
  every `created_at`/`updated_at`/`archived_at`-shaped field.
- **IDs are UUIDs** everywhere, matching the data model's `uuid` PK/FK
  convention throughout.
- **JSON field names are camelCase**; the OpenAPI schemas translate every
  snake_case DB column 1:1 (`owner_user_id` → `ownerUserId`,
  `target_amount` → `targetAmount`) — no field is renamed beyond the
  casing convention, so a column's meaning in `02-data-model.md` is
  always the same meaning at this layer.

## Patterns worth calling out explicitly

- **One endpoint, two actor relationships, where the architecture
  already treats them as one operation.** `DELETE
  /households/{householdId}/members/{userId}` serves both Remove Member
  (Owner/Admin acting on someone else) and Leave Household (self-service,
  `userId` equals the caller) — this mirrors `IdentityManager`'s own
  `removeMember(...)` taking the same shape for both (VBD doc §3.1a), not
  a simplification invented at this layer.
- ~~Recurring transactions as a field on `POST /transactions`~~ —
  **removed Oct 2026** (FR-3.5 dropped, OQ-55); no recurring field or
  endpoints remain.
- **Allocation is only ever written through `PATCH /holdings/{holdingId}`**,
  never through any Goal endpoint — OQ-48's direction-of-control
  decision, carried through literally: there is no
  `POST /goals/{id}/allocations` endpoint at all, by design, not
  oversight. `GET /goals/{id}/allocations` exists for display only.
- **`PATCH /categories/{id}` folds in Subcategory create/rename**, the
  same combined-request pattern FR-2.9/OQ-35 established for
  Account+Credit-Card edits — applied here by extension, since the
  underlying shape (one parent entity, a list of child entities managed
  inline) is identical.

## New design surface beyond the sequence-diagram sweep

Every endpoint below has no corresponding sequence diagram — the 48
diagrams covered state-changing use cases, not listing/retrieval. These
follow the conventions above but are flagged as genuinely new decisions
worth a review pass, same spirit as flagging the REST route surface
itself when it was first introduced:

- `GET /households`, `GET /households/{id}/members`,
  `GET /households/{id}/invitations`, `GET /users/me/invitations` —
  needed the moment a real UI has to render a household switcher, a
  member list, or a "pending invites" screen; FR-1.8 (multi-household
  membership) implies the first one directly.
- `GET /accounts/{id}/credit-cards`, `GET /accounts/{id}/balances`,
  `GET /credit-cards/{id}/balances` — balance history endpoints back
  FR-5.4/FR-6.6 directly; no new stored data, per that FR's own text.
- `GET /budgets/{id}/periods` — backs the FR-4.3 status display.
- `GET /accounts/{id}/holdings`, `GET /holdings/{id}/valuation-snapshots`,
  `GET /holdings/{id}/schedule-entries` — the latter is read-only from
  this API on purpose; entries are written only by
  `InvestmentProductEngine` at purchase time (OQ-53), never created
  directly through a client request.
- `GET /goals/{id}/allocations`, `GET /goals/{id}/progress` —
  progress computation per FR-8.5/8.7, returning per-currency
  contributions and leaving the cross-currency blend to the frontend
  (OQ-49), unchanged from how `ReportingEngine` already works.
- `GET /transactions` — **Oct 2026:** Browse & Filter over **both**
  ledgers merged (kinds, accounts, cards, categories, holding, any date
  range; cursor pagination). `GET /credit-cards/{id}/transactions` stays
  for a single card's ledger. Storage stays two ledgers (OQ-16).
- **New in Oct 2026:** `POST/PATCH/DELETE /holdings/{id}/valuation-snapshots[/{snapshotId}]`
  (manual market values, OQ-56), `GET /index-rates` and
  `POST/PATCH/DELETE /index-rates/{index}/values[/{valueId}]` (FR-11.6),
  `DELETE /users/me/sessions` (sign out all others), `PATCH /users/me`
  preferences, `/goals/*` (renamed from `/goals/*`, complete/reopen).
  Deferred operations carry `x-deferred` (`PATCH /dashboard/widgets` v3,
  `/reports/transactions/export` v2).
- `GET /reports/{reportType}` — **v1 (Oct 2026):** the fixed types
  `month-overview`, `investments-overview` and `payouts` (sequence review
  Q1 — reports expand later); ad-hoc types below are **v2** (OQ-71).
  Originally: one generic endpoint standing in for
  every FR-6.7 Widget-backed report (spend-by-category, income-vs-expense,
  account-balance-by-month, net-worth-trend, budget-status); `reportType`
  is reference data, not a hardcoded branch, matching FR-6.7's own
  framing of Widget type.

## Not yet done

- `openapi.yaml` has no example values on most schemas — worth adding
  before handing this to a frontend team for parallel mock-based
  development, not blocking backend implementation.
- Rate limiting, request-size limits, and CORS policy are infrastructure
  decisions, not modeled here — same category as the scheduled-trigger
  infrastructure questions already parked in the VBD backend doc's §7.
- ~~No `operationId` values are set~~: done in N7. Every operation has
  one, and they name the generated code (OQ-93). Also corrected in N7:
  `nullable: true` (not valid OpenAPI 3.1) became `type: [X, "null"]`
  type unions.
