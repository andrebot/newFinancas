# Non-Functional Requirements

Grouped by concern. Several of these (Security, Auditability, Observability)
are cross-cutting per VBD and will surface as Utility components in the
backend decomposition rather than logic embedded in each Manager/Engine.

## Security

- **NFR-SEC-1** MFA is mandatory for every user account (TOTP at minimum).
- **NFR-SEC-2** All data in transit is encrypted via TLS 1.2+.
- **NFR-SEC-3** Sensitive data at rest (credentials, Open Banking tokens,
  PII) is encrypted at rest.
- **NFR-SEC-4** Passwords are stored using a strong adaptive hash
  (e.g., Argon2/bcrypt) — never plaintext or reversibly encrypted.
  Passwords must be **at least 12 characters** — enforced on registration,
  password change, and password reset (see OQ-64). The UI shows a strength
  indicator; the 12-character minimum is the only hard rule.
- **NFR-SEC-5** Users can view and revoke their own active sessions/devices
  (supports FR-1.3).
- **NFR-SEC-6** Role-based access control is enforced at the API boundary
  for every household-scoped resource — not just in the UI.
- **NFR-SEC-7** The system stores only non-sensitive credit card
  identifiers — network/brand, last 4 digits, and expiration date (FR-2.8)
  — and never stores the full card number (PAN), CVV/CVC, or any other
  cardholder data that would bring the system into PCI-DSS
  cardholder-data-environment scope.

## Compliance

> **v1 note (OQ-89):** v1 is for personal / family use and runs locally
> (OQ-88), so no compliance review is performed. NFR-COMP-1/2 apply only
> if the app is ever offered to other people; NFR-COMP-3/4 are kept as
> design choices.

- **NFR-COMP-1** Data handling must comply with **LGPD** (Brazil, primary
  market) and with whichever US-side privacy/financial-data regulations
  apply to US-based users (state-level privacy laws at minimum). The exact
  US-side scope needs legal review — see OQ-4 — but the design already
  treats "applicable compliance regime" as a per-region variable, not a
  single hardcoded assumption.
- **NFR-COMP-2** The Open Banking integration must conform to the
  technical/security standard of **each** region's provider/framework in
  use (e.g., Open Finance Brasil for BRL accounts; the equivalent US
  framework/provider for USD accounts) — not just one.
- **NFR-COMP-3** Storing only last-4-digits/network/expiration for credit
  cards (NFR-SEC-7) is a deliberate scope decision to keep the system out
  of **PCI-DSS** cardholder-data-environment obligations. If full card
  capture or card-present processing is ever added, this exemption no
  longer holds and PCI-DSS applies.
- **NFR-COMP-4** LGPD/GDPR-style right-to-erasure is satisfied via FR-1.17
  (hard delete of a user's personal data). No compensating audit-log
  cleanup is required: the Audit Log (FR-7.1) stores no PII by design, so
  erasing a user never requires rewriting or purging audit history — see
  OQ-25.

## Auditability

- **NFR-AUD-1** Audit log entries (FR-7.1) are append-only; the application
  provides no path to edit or delete them.
- **NFR-AUD-2** Audit log entries are retained **indefinitely** for now —
  no automatic purge/deletion. Revisit if a future regulatory review (see
  NFR-COMP-1) mandates a maximum retention period.

## Reliability & Availability

- **NFR-REL-1** Open Banking sync failures must never corrupt or lose
  manually entered data; the system degrades gracefully and surfaces sync
  status/staleness to the user.
- **NFR-REL-2** Sync jobs use retry-with-backoff and never block core
  manual-entry functionality when a provider is unavailable.

## Performance

- **NFR-PERF-1** Dashboard and report views remain responsive for a
  household with multiple years of transaction history. (Concrete
  thresholds to be quantified once data-volume assumptions exist — see
  PD step.)

## Scalability

- **NFR-SCALE-1** The data model and API are household-scoped so the system
  scales horizontally by household, without cross-tenant coupling.

## Maintainability / Engineering Constraints

- **NFR-MAINT-1** All code is TypeScript, written in a purely functional
  style — no classes.
- **NFR-MAINT-2** Cyclomatic complexity per function is ≤ 7 and parameter
  count per function is ≤ 7, except where explicitly justified in review.
- **NFR-MAINT-3** ESLint with the Airbnb style guide is enabled from the
  first commit, front and back end.
- **NFR-MAINT-4** Backend architecture follows VBD (Managers / Engines /
  Resource Accessors / Utilities); frontend follows EBD (Experiences /
  Flows / Interactions / Utilities).
- **NFR-MAINT-5** Test code is physically separated from source code (a
  distinct test tree, not co-located `*.test.ts` files).

## Testability

- **NFR-TEST-1** Test strategy follows BDT: test level (unit / integration
  / E2E) and mock placement are derived from each component's VBD/EBD tier,
  not chosen ad hoc.
- **NFR-TEST-2** Backend unit/integration tests use Vitest + Supertest;
  frontend unit tests use Vitest; end-to-end tests use Playwright.

## Observability

Two logs exist, serving different audiences — see the note under CUC-9 in
`01-core-use-cases.md`. The **Audit Log** (FR-7.1) is business/compliance
facing and scoped to financial/household data mutations. The
**Application Log** below is broader and purely engineering-facing: it
exists to reconstruct what happened and diagnose bugs.

- **NFR-OBS-1** The backend logs a structured event, via Winston, for
  **every** request/action the system processes — not only
  security-sensitive ones — including a correlation identifier that traces
  a request across Manager → Engine → Resource Accessor calls.
- **NFR-OBS-2** Every log entry (activity or error) includes the **ID of
  the acting user**, or an explicit `system`/`unauthenticated` marker when
  there is none, so any event can be traced back to who triggered it.
- **NFR-OBS-3** All errors and unhandled exceptions are logged with enough
  context (stack trace, correlation ID, acting user ID, action being
  performed) to diagnose and track the underlying bug. This is required
  specifically to support bug tracking, independent of the Audit Log.
- **NFR-OBS-4** Security-sensitive events (login, MFA challenge, permission
  change, Open Banking connect/disconnect) are additionally routed to feed
  the Audit Log (NFR-AUD-1) — every audited action is a subset of the
  Application Log, but not vice versa.
- **NFR-OBS-5** Log destinations are configured via Winston's native
  **Transport** mechanism, not a custom-built abstraction — Winston already
  supports multiple simultaneous transports. v1 ships with a
  human-readable console transport **plus a daily-rotated JSON-lines file
  transport** (`LOG_DIR`, 14 days — OQ-97) **and an audit transport**
  storing audit events in the database (OQ-110); adding a hosted log/observability service or a
  self-hosted stack later is a configuration change (a new transport), not
  an application-architecture change (see OQ-10).

## Internationalization / Localization

- **NFR-I18N-1** The frontend copy/formatting layer supports at least
  **pt-BR** (primary market, Brazil) and **en-US** (secondary market, US
  users) from the start — not retrofitted after a single-locale v1.
  **Volatility: [under-specified, flagged during volatility
  reconciliation]** "at least" and "not retrofitted" already imply the
  locale set is expected to grow — this should be tagged `[volatile]`
  like every other growing enumeration in this project (locale strings as
  reference data, not two hardcoded bundles), not left implicit.
- **NFR-I18N-3** All user-facing text comes from frontend message
  catalogs (shared `packages/i18n`, ICU MessageFormat). The backend
  never returns display text: notifications are **type + parameters**
  (OQ-82) and API errors are **code + parameters** (OQ-83); the frontend
  localizes both. A test enforces that every type/code has an entry in
  every supported locale.
- **NFR-I18N-2** Number, date, and currency formatting follow the
  conventions of the account/holding's own currency and the user's locale
  independently of each other (e.g., a BRL account balance is formatted per
  BRL/pt-BR conventions even when viewed by a user whose UI locale is
  en-US).

## Usability / Accessibility

- **NFR-UX-1** The UI is built with **Tailwind CSS and the project's own
  reusable component kit** (replacing MUI — see OQ-65), using headless,
  accessible primitives (e.g. Radix UI / Headless UI) for drawers, menus,
  and switches. It is responsive for desktop and mobile browsers. Native
  mobile is a later phase; EBD Flows/Interactions should avoid web-only
  assumptions where doing so costs nothing now. The approved visual design
  is `docs/design/mockups/` (see `docs/design/mockups/README.md`).
- **NFR-UX-2** All colours come from **design tokens** (CSS variables) so
  the UI supports a **dark** (default) and a **light** theme without
  per-page styling; text keeps ≥ 4.5:1 contrast in both (see OQ-65,
  FR-1.21).
