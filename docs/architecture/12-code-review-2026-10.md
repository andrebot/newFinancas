# Code review — slice 1, October 2026

A review of everything built so far (slice 1: identity backend, the web
kit, Flows, Experiences and App Shell, the shared packages), asked for by
the stakeholder after task 66 (`I7`). Coverage stays at 100%; the question
is whether the tests actually check the logic and its edge cases.
**Status: in progress — phase 1, step 1 (backend mutation testing) done,
triaged and fixed; step 2 (web app and packages) next.** Work happens on the `review/slice-1` branch, cut from
`task/66-frontend-backend-identity`.

## Plan

One phase at a time; the stakeholder confirms each before the next.
Findings are recorded here (file:line, why it matters, proposed fix); no
fix is made until the stakeholder has seen them, and fixes land as
separate commits afterwards.

1. **Unit and integration tests — are they meaningful?**
   - Step 1: mutation testing of the backend (`apps/api/src`) with
     StrykerJS. Every surviving mutant is triaged: a real test gap, an
     equivalent mutant (cannot change behaviour), or a defensive path not
     worth a test.
   - Step 2: the same for the web app (`apps/web/src`, ~16k lines) and the
     shared packages (`packages/*`, `tools/*`).
   - A manual read of the highest-risk tests alongside (sign-in, membership
     decisions, the Experiences).
2. **Playwright suite** — the smoke tests and the I7 identity journeys
   (`tests/e2e/`): are they asserting outcomes, stable, at the right tier.
3. **Code and architecture** — VBD/EBD call rules, boundaries, nothing
   broken (a `harmonic-review` pass over the codebase).

## Phase 1 — tests

### Manual read so far

The tests are BDT-shaped and assert outcomes and side effects, including
what must *not* happen (no session opened, nothing counted, nothing
cleared) — not just executed lines. Gaps found so far:

| # | Where | Gap | Proposed fix |
|---|---|---|---|
| T1 | `apps/api/src/managers/identity/signIn.ts` `refuseIfLocked` | The lock boundary is untested: only a lock 1 minute in the past is checked, never `lockedUntil == now`. A `>` → `>=` change would pass. | Add the boundary case. |
| T2 | `signIn.ts` `confirmMfaEnrollment` | "The email now belongs to another account" (`user.id !== claims.userId`) is tested for the MFA step, not for enrollment confirmation. | Add the case to the confirmation suite. |
| T3 | `signIn.ts` `logout` | The `Logout` log line is not asserted. | Assert it, or accept as low value. |

### Mutation testing — how to run it safely

Tooling (added on the review branch): `@stryker-mutator/core` as a root
devDependency; `stryker.api.config.json` at the repo root; `reports/` and
`.stryker-tmp/` git-ignored. Reports go to `reports/mutation/api/` (HTML +
JSON).

**Test runner: Stryker's `command` runner, not the Vitest runner.**
`@stryker-mutator/vitest-runner` 10.0.0 (the latest) does not work with
Vitest 5.0.3, although its peer range (`vitest >= 2.0.0`) accepts it: it
reuses one Vitest instance across runs, and under Vitest 5 the mutant runs
do not re-execute the tests. A probe test ran once in the dry run and never
in the mutant runs. Only the "static" mutants (which get a restarted
worker) were killed. The result was a silent false report: `userAccessor.ts`
scored 2.5% (117 of 120 survived), yet a surviving mutant applied by hand
fails its test. Its debug logging also crashes (circular JSON). The
`command` runner instead runs `cd apps/api && npx vitest run --maxWorkers=2
--bail=1` per mutant, activating the mutant through an environment variable.
The same file then scored 100%, with real assertion failures as kill
reasons. The cost: no per-test coverage, so each mutant runs the whole API
suite (~6 s; `--bail=1` stops killed ones early).

Lessons from the first attempts:

- **Run from the repo root**, not from `apps/api`: Stryker copies the
  project into a sandbox, and from `apps/api` alone the relative path to
  `tsconfig.base.json` breaks. The config sets
  `vitest.configFile: apps/api/vitest.config.ts` and `vitest.dir: apps/api`
  (without `dir`, no test is found), and `ignorePatterns` keeps `docs`,
  `apps/web`, `.superdesign`, `storybook-static` and other bulk out of the
  sandbox.
- **Memory, not CPU, is the limit.** The first full run used 16 workers;
  each runs its own Vitest, and the DB-backed tests start an in-memory
  Postgres (PGlite) of a few hundred MB each. It exhausted 30 GB of RAM and
  most of the swap and crashed the machine.
- **Measured cost: ~2.5 GB per worker.** A one-file trial on the command
  runner (2 workers, each Vitest with 2 forks; one PGlite per DB test file,
  closed in `afterAll`) took available memory from 21.6 GB to 16.6 GB. The
  config is at `concurrency: 4` (~10 GB). Always cap Vitest's own pool
  (`--maxWorkers`): its default is one fork per core, multiplied by every
  Stryker worker.
- Long runs go in the background with a watchdog that kills Stryker when
  available memory drops below 6 GB.

Run it with `npx stryker run stryker.api.config.json` (~30 minutes).

When triaging, read the mutant's exact span: a `ConditionalExpression →
true` on `a && b` may replace only `a`. Hand-apply a doubtful survivor and
run its test before calling it a gap or a tooling fault.

### Mutation testing — results

Full backend run, 2026-10-16: **87.2%** (2,249 mutants: 1,956 killed,
5 timed out, 288 survived), 29 minutes at 4 workers; available memory went
from 21.8 GB to 9.1 GB at its lowest (~3.2 GB per worker). Report:
`reports/mutation/api/` (git-ignored; rerun to regenerate).

| Area | Score | Survivors |
|---|---|---|
| Engines, HTTP routes, `errorHandler`, user/session/invitation accessors | 100% | 0 |
| Accessors overall | 98.8% | 4 |
| HTTP overall | 97.2% | 11 |
| Utilities | 94.2% | 22 (+5 timeouts) |
| Managers (identity) | 88.0% | 63 |
| `config/env.ts` | 78.1% | 7 |
| `db/schema/*` | 58.9% | 167 |

#### Schema (`db/schema/*`, 167 survivors)

The tests build the database from the SQL migrations, never from the TS
schema, and Drizzle falls back to the property key when a column name is
empty (`email: text('')` is still column `email`). So:

| # | What | Survivors | Verdict |
|---|---|---|---|
| S1 | Column defaults, constraint and index names, `check(...)` and partial-index expressions, whole extra-config arrays (`(table) => [...]` → `[]`) — in every schema file, `identity.ts` included | ~120 | **Gap (tooling)** — none of this runs at runtime; `drizzle-kit generate` reads it. Nothing checks that the TS schema still matches the migrations, so they can drift silently (the next `db:generate` would then emit a surprise migration). Fix: a `check:schema` script — `drizzle-kit generate` must produce no new migration — added to `pnpm check`, like `check:contract`. |
| S2 | Column names equal to their property key (`kind: text('kind')`) | ~31 | Equivalent — Drizzle uses the key. |
| S3 | snake_case column names in tables slice 1 never queries (`target_amount`, `asset_type`, `cost_basis`, `as_of_date`…) | 16 | Deferred — killed once the slice-2 accessors and their tests exist. |

#### Managers (63 survivors)

| # | Where | Survivors | Verdict | Why / proposed fix |
|---|---|---|---|---|
| M1 | `signIn.ts:116` `lockedUntil > now` → `>=` | 1 | **Gap** | Confirms T1: the lock boundary is untested. Add `lockedUntil == now`. |
| M2 | `passwords.ts:35`, `registration.ts:47` `length < minLength` → `<=` | 2 | **Gap** | A password of exactly the minimum length is never tried. Add the boundary (minLength accepted, minLength − 1 refused) to change-password, reset and registration. |
| M3 | `invitations.ts:160` `invitation?.householdId` → `invitation.householdId` | 1 | **Gap** | Revoking an invitation id that doesn't exist is untested (only one from another household is). The mutant turns the 404 into a TypeError/500. Add the case. |
| M4 | `profile.ts:31` `lastName?.trim()` → `lastName` | 1 | **Gap** | Only the first name is sent padded; the last-name trim is unchecked. Pad both in the test. |
| M5 | Audit entries in `households.ts`, `invitations.ts`, `members.ts`, `passwords.ts`, `profile.ts` | 23 | **Gap** | Most audit assertions use `objectContaining` with the action name only. `entityType`, `entityId` and `householdId` go unchecked (the whole payload can become `{}`), and for `RevokeInvitation`, `AcceptInvitation` and `ChangeMemberRole` not even the action name is asserted. The audit log is a requirement (FR-7) and feeds the audit report. Fix: one shared helper asserting the full audit entry (action, entityType, entityId, householdId, actor), used for every audited action. |
| M6 | `passwords.ts:56` `if (!user) return` → never returns | 1 | Gap (low) | For an unknown address the background task would crash on `user.id`, be caught, and log an error. The answer is unchanged, so only the log shows it. Assert that an unknown address logs no error. |
| M7 | Operational log lines: `invitations.ts:87,205`, `passwords.ts:67,105`, `sessions.ts:53,64`, `signIn.ts:245,387` | 11 | Not worth a test | Message text and fields of info/warn/error lines. The behaviour around each (replay ends the session, revocation, failures swallowed) is tested. Covers T3 (`Logout`), which is accepted as low value. |
| M8 | `errors.ts` — every error `message` | 21 | Not worth a test | The contract says clients never display `message`; they localize `code` + `params` (OQ-83, NFR-I18N-3). Codes and statuses are killed. |
| M9 | `members.ts:43,58` `'left'` → `''` | 2 | Equivalent | `leave()` only branches on `'stale'` and `'dissolved'`; any other outcome is audited as `LeaveHousehold`. |

Gaps to fix from the managers: M1–M6 (plus T2 from the manual read).

#### Accessors, HTTP, utilities, config, seed (58 survivors, 5 timeouts)

The 5 timeouts (`serviceBus` drain loop) count as killed: the mutant hung
the run, so it was detected.

| # | Where | Survivors | Verdict | Why / proposed fix |
|---|---|---|---|---|
| H1 | `tests/db/support/database.ts` `withRollback` (found via `householdAccessor.ts:249`) | 1 | **Gap — test harness, high** | `withRollback` ends each test with `tx.rollback()` and swallows *every* `TransactionRollbackError`, including one escaping from the code under test. Removing `swapOwner`'s `catch` lets that error out; the test stops at that line and is reported **passed**, with every assertion after it skipped (checked by hand: 15/15 pass). Today only `swapOwner` rolls back, but every slice-2 guarded write will. Fix: tell the harness's own rollback apart (a flag set after `work` returns, or a private sentinel error) and rethrow anything else; add a test proving an escaping rollback fails the test. |
| U1 | `auditSink.ts:114` `done()` removed | 1 | **Gap — high** | Without `done()` the stream never asks for the next entry: only the first audit entry would ever be stored. Every test writes a single entry. Fix: write two entries, expect both delivered. |
| U2 | `auditSink.ts:111` `if (!stored)` → always | 1 | **Gap** | `onGiveUp` (entry lost, kept for reconciliation) would fire for stored entries too. Fix: assert it is not called on success. |
| U3 | `auditSink.ts:104` transport `level: 'info'` → `''` | 1 | **Gap** | The comment promises audit entries are stored whatever `LOG_LEVEL` the console uses; with no level the sink inherits the logger's, and at `LOG_LEVEL=warn` audit (level 2) would be dropped. Fix: a test at `warn`. |
| U4 | `correlationId.ts:12` UUID regex without `^` (or `$`) | 1 | **Gap — security, low cost** | The check exists so nothing but a UUID reaches the logs (no newlines/markup); unanchored, `"<junk>\n" + uuid` passes. Fix: reject a UUID with a prefix and with a suffix. |
| U5 | `permissions.ts:50,52` `data.create` / `data.delete` roles | 3 | **Gap** | The matrix test doesn't pin every action. Fix: one table test of the whole `PERMISSIONS` matrix against the FR role table. |
| U6 | `validation.ts:62` `target === 'query'` → always | 1 | **Gap** | Query-string coercion would also apply to JSON bodies and params (`"true"`/`"1"` accepted for boolean/number fields). Fix: a body test where a string is refused for a number field. |
| U7 | `serviceBus/index.ts:66` `?? []` → a filler handler | 1 | Gap (low) | Publishing to a topic with no subscribers would report a handler error. Fix: publish with no subscribers, expect no `onHandlerError`. |
| U8 | `env.ts:9,19,60` protocol regex anchors; `http` WEB_APP_URL; several trailing slashes | 6 | Gap (low) | `xpostgres://`, `postgresx://`, `xhttps://` would be accepted; an explicit `http://` URL is never tried; only one trailing slash is. Fix: a few `it.each` cases. |
| U9 | `reconcile.ts:53` `.endsWith('.log')` → `''` | 1 | Gap (low) | Non-`.log` files with the prefix (rotated archives) would be reconciled. Fix: one more name in the list. |
| U10 | `tokens.ts:79,154` `typeof userId === 'string'` → `true` | 2 | Gap (low) | A validly signed token with a non-string `sub` would be accepted. Defence in depth (we sign every token). Fix: sign such a token, expect `undefined`. |
| U11 | `mfa.ts:108` `new Secret({ buffer })` → `new Secret({})` | 1 | Gap (low) | The TOTP secret would come from the library's RNG, not the injected `randomBytes`; no test pins the secret derived from fixed bytes. Fix: fixed bytes → expected base32. |
| U12 | `fieldDetail.ts:11,15` `int → 'number'`, `set → 'array'` | 2 | Gap (low) | Those `params.expected` mappings are never exercised. Fix: add them to the table test. |
| E | `householdAccessor.ts:264` (select list inside `NOT EXISTS`), `notificationInboxAccessor.ts:90` (empty-list short-cut; Drizzle's `inArray([])` is `false`), `mfa.ts:18,36,130`, `secretBox.ts:37,39` (×2), `tokens.ts:82,157` (empty `catch` still returns `undefined`), `fieldDetail.ts:46,89`, `queryCoercion.ts:38`, `correlationId.ts:23`, `reconcile.ts:68`, `db/errors.ts:17` | 17 | Equivalent / defensive | Cannot change observable behaviour with the inputs the system can produce. |
| N | Message/label text: `errors`/`authentication.ts` messages (×3), `authentication.ts:63`, `validation.ts:30`, `env.ts:23`, `app.ts:25` (×2), `emailAccessor.ts:26`; demo seed names and id arithmetic (`demoSeed.ts`, 11 — dev data; ids stay unique) | 20 | Not worth a test | Log labels, never-displayed messages, demo data. `authentication.ts:16` (`Bearer` regex without `^`) belongs here too: the token is still verified. |

### Phase 1, step 1 — summary

288 survivors: **51 are real test gaps** (M1–M6, H1, U1–U12), plus one
tooling gap behind ~120 schema survivors (S1). The rest are equivalent,
defensive, deferred or not worth a test. Counting only mutants that can
change runtime behaviour, the score is about 97%.

By priority:

1. **H1** — the DB test harness can report a test as passed after skipping
   its assertions. Fix first: it undermines every accessor test, and slice 2
   adds many guarded writes.
2. **Audit trail (U1, U2, U3, M5)** — the audit sink's delivery and level,
   and what each audited action records, are largely unasserted, although the
   audit log is a requirement (FR-7).
3. **Security edges (M1/T1, U4, U10)** — lock boundary, correlation-ID
   anchoring, token claim shape.
4. **Contract and validation (M2, M3, U5, U6, U12)** — password boundary,
   unknown invitation, permission matrix, body coercion.
5. **Tooling (S1)** — schema-vs-migrations drift check in `pnpm check`.
6. **Low (M4, M6, U7–U9, U11, T2)** — small, cheap additions.

### Phase 1, step 1 — fixes

All gaps above are fixed on `review/slice-1`, one commit per group. Only
tests and tooling changed; no production code needed a fix.

| Commit | Findings |
|---|---|
| Review H1 | `withRollback` ends the test with a private sentinel and rethrows anything else, including a `TransactionRollbackError` from the code under test; the harness has its own tests (`tests/db/support.test.ts`). |
| Review U1–U3 | Audit sink: a second entry is stored, a stored entry is never reported lost, entries are stored at `LOG_LEVEL=warn`. |
| Review M1–M6, T2 | `expectAudited` asserts the full FR-7.1 entry for every audited identity action; lock ending exactly now; 12/11-character passwords; unknown invitation; last-name trim; silent unknown reset address; enrollment for an address now owned by another account. |
| Review U4–U12 | Correlation-ID prefix, full shared-data permission matrix, no coercion of JSON bodies, bus with no subscribers, anchored URL schemes and trailing slashes, `.log`-only reconcile, token claim types, MFA secret from the injected randomness, `set`/`int` size mappings. |
| Review S1 | `pnpm check:schema` (in `pnpm check`, so in CI): fails when `drizzle-kit generate` would write a migration. Proven by changing a default. |

T3 (`Logout` log line) stays accepted as low value (M7).

**Verified by a second full run (2026-10-16):** 89.5% (2,007 killed,
5 timed out, 237 survived), 28 minutes. The 51 mutants behind the gaps
are now killed, none of the targeted lines has a survivor left, and no
new survivor appeared. The 237 remaining are the ones triaged above as
equivalent, deferred or not worth a test.

## Phase 2 — Playwright

*(Pending.)*

## Phase 3 — code and architecture

*(Pending.)*
