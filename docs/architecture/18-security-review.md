# Security review (light) — task 143 (`N10`), November 2026

A light security review before the app holds real data. It covers
authentication, MFA, tokens, sessions, the authorization table and a
dependency audit (`01-pd-activity-list.md`). The method is the same as the
slice gates: **findings first, then the stakeholder's decisions (OQ), then the
fixes.** It doesn't include a scanner run. OWASP ZAP against the running app
is deferred to a later pass (stakeholder, Nov 2026).
**Status: S2, S3 and S7 fixed; S1 (self-hosting) open for a later discussion; the rest decided (OQ-249). Task 143 stays open until S1 is settled.**

## Threat model

From the stakeholder (Nov 2026), refining OQ-88:

- **Where it runs:** self-hosted on the stakeholder's Proxmox server.
- **Who reaches it:** mostly the home network, and from outside only through
  **Tailscale** (WireGuard, so it's encrypted between devices). It is never
  published to the internet (no Tailscale Funnel, no port forward).
- **Who uses it:** the stakeholder's family. The data is money data, so it
  is worth protecting even with a small audience.
- So the main attacker is any device on the home network or the tailnet
  (a compromised phone, a guest on the Wi-Fi), not the whole internet.
  Brute force and abuse from the internet aren't the main risk; plain HTTP on
  the LAN, XSS and misconfiguration are.

## Scope and how it was checked

- **Code read:** `utilities/authentication/` (passwords, tokens, MFA,
  `secretBox`), `utilities/authorization/`, `managers/access.ts`,
  `managers/identity/` (sign-in, passwords, sessions), the household loaders
  (`transaction/reversal.ts`, `account/holdingAccess.ts`), `http/`
  (authentication middleware, error handler, request log), `app.ts`,
  `server.ts`, `config/`, `compose.yaml`, `infra/db/init`, `tools/ops`, the
  web app's token store (`apps/web/src/api/tokens.ts`).
- **Route guard probe (throwaway script):** the real `createApp` with Managers
  that throw if reached, called once for every operation in `openapi.yaml`
  with no token. **79 of 79 protected operations answer 401.** The 8 public
  ones are the `/auth/*` sign-in, MFA, refresh and reset steps. A second
  probe tried encoded line terminators (`%0A`, `%0D`, `%E2%80%A8`),
  backslashes and doubled slashes on household routes, after the Hono
  advisories below. None reached a Manager (401 or 404).
- **Dependency audit:** `pnpm audit --prod` (8 advisories) and `pnpm audit`
  (31, with dev tooling).

## What checked clean

| Area | What holds |
|---|---|
| Passwords (NFR-SEC-4) | Argon2id at the OWASP parameters (19 MiB, t=2, p=1), stored in each hash so they can be raised; 12-character minimum on register, change and reset. |
| Sign-in (OQ-114, OQ-145) | One answer for every password failure; an unknown email still costs a hash check (dummy hash); per-address lockout over both steps, counted for addresses with no account too. |
| MFA (NFR-SEC-1) | Required: an unconfirmed enrollment gets a new enrollment, never a session. TOTP steps are consumed (`consumeTotpStep`), so a code can't be replayed. Recovery codes are hashed, compared in constant time and single-use. The TOTP secret is AES-256-GCM at rest. |
| Tokens (OQ-30, OQ-100) | JWT algorithm pinned (HS256), issuer and audience checked; challenge and enrollment tokens have their own audiences, so neither passes as an access token. Opaque tokens are 256-bit and stored only as SHA-256 hashes. |
| Sessions (NFR-SEC-5) | Refresh tokens rotate; a reused one ends the session (10 s reload grace, OQ-162). Listing and revoking are scoped to the actor. A password change ends every other session; a reset ends all of them. |
| Password reset | 30-minute, single-use link; the request answers the same whether or not the email exists, and the work runs after the response. |
| Authorization (NFR-SEC-6) | Every household lookup is by `(householdId, id)`; every Manager use case goes through `requireAccess`; a non-member gets `household.not_found`, so a household's existence isn't confirmed; personal data of others is the entity's own not-found. |
| Errors and logs | Unexpected errors answer `internal.unexpected` with no stack; the stack goes only to the log. The request log records method, path, status and duration: no query string, no body, so no tokens. |
| Database | The API connects as `financas_app`, which has no UPDATE/DELETE on the audit log (NFR-AUD-1). Postgres listens on `127.0.0.1` only. |
| Secrets | `.env` is git-ignored; `pnpm env:secrets` generates them and writes the file `0600`; backups are `0600` in a `0700` folder. |
| Browser | No third-party requests (self-hosted fonts, OQ-125). Same-origin API, so no CORS. |

## Findings

| # | Sev. | Finding |
|---|---|---|
| S1 | High | **There's no way to run the app outside development, so TLS, security headers and CSP have nowhere to live.** The web app is only ever served by the Vite dev server, and `03-api-design.md` parks request-size limits and CORS as "infrastructure decisions" that nothing ever made. On the Proxmox host, a LAN browser would talk plain HTTP (NFR-SEC-2 unmet; Tailscale encrypts only tailnet traffic). The refresh token sits in `localStorage` for 30 days (OQ-124's accepted trade-off), so a strict CSP is the main defence against XSS reading it. Today there is no CSP, no `X-Content-Type-Options`, no `frame-ancestors`/`X-Frame-Options`, and no `Referrer-Policy`. The password reset link carries its token in the URL, so the referrer policy matters too. |
| S2 | Medium | **Production dependencies have known advisories.** `zod` < 4.6.6 (**high**: memory exhaustion on oversized constrained collections); `hono` < 4.13.16 (5: wildcard middleware skipped by the RegExpRouter, `mount()` bypass, `csrf()`, multipart validation, `css` helper); `@hono/node-server` < 2.1.6 (2: backslash path bypass, crash on `ECONNRESET`). Our guards are wildcard middleware (`/households/*`, OQ-174), the class two advisories target. The probe found no bypass on our routes, but the patched versions are minor bumps. Dev-only tooling has 23 more (`js-yaml` via the API type generator, `undici` via `jsdom`, `picomatch` via ESLint). Nothing runs an audit in CI, so new advisories go unnoticed. |
| S3 | Medium | **The API has no limit on request size.** Any request is read whole, including unauthenticated ones like `/auth/login` and `/auth/register`. One large JSON body can exhaust the API's memory, and with S2's `zod` advisory, so can a large array inside a normal-size body. `password` also has no upper length in the contract. Argon2 copes with long inputs, but nothing bounds them. |
| S4 | Medium | **The demo seed can put a known login into the real database.** `pnpm db:seed:demo` writes to whatever `DATABASE_URL` points at, adding a user whose password and TOTP secret are in `config/constants.ts`, and it's idempotent. Run once against the Proxmox database by mistake, it leaves a working account anyone who reads the repo can sign in to. |
| S5 | Medium | **The API starts with the example secrets.** `.env.example`'s `JWT_SECRET` and `MFA_ENCRYPTION_KEY` pass validation. With a copied example `.env`, anyone can forge an access token for any user, skipping the password and MFA. They can also decrypt every TOTP secret. Nothing refuses or warns. |
| S6 | Low | **Data at rest isn't encrypted (NFR-SEC-3).** Only the TOTP secret is. Names, emails and all financial data are plain in Postgres, and so are the `pg_dump` backups (`tools/ops`). The NFR says personal data is encrypted at rest. On a self-hosted box this is usually met at the storage layer (ZFS native encryption or LUKS on the Proxmox host or VM disk) plus encrypted backups, not column encryption, but it is a decision to record. |
| S7 | Low | **Nothing pins "every protected operation needs a token".** It holds today (the probe: 79/79). But the household-data routes depend on mount order in `app.ts` for their guard (OQ-174), so a reorder or a new router would silently open them, and no test would fail. |
| S8 | Low | **Only the login steps are rate-limited.** `/auth/password-reset/request` and `/auth/register` take any number of requests, and lockout is per address, so anyone who knows a family member's email can keep them locked out (OQ-114 traded this for not confirming emails). With the console email provider and a LAN/tailnet-only app this costs little. It matters once a real email provider is configured (each reset request sends an email). |

## Already accepted, rechecked

- **Refresh token in `localStorage` (OQ-124).** Still a reasonable trade-off
  against an httpOnly cookie plus CSRF protection, **provided S1 adds a strict
  CSP.** Without it, any XSS takes a 30-day session.
- **A revoked session lasts up to 15 minutes** (`accessToken.ttlSeconds`).
  Access tokens aren't checked against the session table; documented in
  `config/constants.ts`. Fine at this scale.

## Proposed fixes (for decision)

| # | Proposal |
|---|---|
| S1 | A self-hosting setup for Proxmox, as **a new task before `V4`** (load tests should run against it): the built web app and the API behind one reverse proxy (e.g. Caddy) on one origin; HTTPS with a certificate from `tailscale cert` on the MagicDNS name, or the proxy's internal CA; HTTP redirected to HTTPS. Security headers in the API through Hono's `secureHeaders`, so they're tested, and for the static app in the proxy: a strict CSP (`default-src 'self'`, no inline script), `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, and HSTS once HTTPS is the only way in. |
| S2 | Bump `zod`, `hono`, `@hono/node-server` (and the dev tooling where a patched version exists); add `pnpm audit --prod --audit-level high` to `ci.yml`, and the full audit to `nightly.yml` as a report. |
| S3 | Hono `bodyLimit` on `/api/v1`, the size in `config/constants.ts` (e.g. 1 MB; the largest real body is a Goal split or a transaction). `maxLength` on `password` in the contract (e.g. 128, shown by the form like the minimum), plus caps on the free-text fields and arrays that have none. |
| S4 | The demo seed refuses unless the database is empty of real users, or unless `DEMO_SEED=allow` is set, and it says why. |
| S5 | `loadEnv` rejects the `.env.example` values for `JWT_SECRET` and `MFA_ENCRYPTION_KEY` (and the example DB passwords for the ops tool) unless `NODE_ENV=development`, pointing to `pnpm env:secrets`. |
| S6 | Record that NFR-SEC-3 is met at the storage layer for v1: an encrypted dataset or disk for the database volume on Proxmox and encrypted backups (e.g. `age` in `tools/ops`). The setup goes in S1's task. |
| S7 | An integration test that reads `openapi.yaml`, calls every operation on `createApp` with no token and expects 401 for all but a named public list, like the probe. |
| S8 | Accept for v1 (LAN and tailnet only). Revisit when a real email provider is configured: per-IP or per-address throttling on reset requests and registration. |

## Decisions (OQ-249) and fixes (2026-11-18)

| # | Decision | What changed |
|---|---|---|
| S1 | **Open: to discuss later.** | Nothing yet. |
| S2 | Fix | `zod` 4.6.6, `hono` 4.13.16, `@hono/node-server` 2.1.6, plus transitive dev updates. `pnpm audit --prod` is clean; 31 advisories in total are down to 11, all dev-only and pinned by their parents. New `pnpm check:deps`, run by a `dependency-audit` job in `ci.yml` and `nightly.yml`. |
| S3 | Fix | `http/bodySize.ts`: Hono `bodyLimit` on `/api/*` at `http.maxBodyBytes` (1 MB), refusing with the new generic code `request.too_large` (413; both catalogs, `STATUS_OF`). New passwords are at most 128 (`authentication.password.maxLength`): the contract, the route overrides in `routes/identity.ts`, the web `password` rule. The identity sequences and call chains for uc-11, uc-18 and uc-19 show the route's check. |
| S4 | Won't fix | The real database is never seeded. |
| S5 | Won't fix | Real secrets come from `pnpm env:secrets`. |
| S6 | Accept | NFR-SEC-3 at the storage layer (encrypted disk and backups), set up with S1. |
| S7 | Fix | `tests/integration/routeGuards.test.ts`: 79 protected operations, each 401 `auth.unauthenticated` with no Manager reached. Dropping the `/households/*` guard fails 65 of them. |
| S8 | Accept for v1 | Revisit with a real email provider. |
