# Code review — slice 1, October 2026

A review of everything built so far (slice 1: identity backend, the web
kit, Flows, Experiences and App Shell, the shared packages), asked for by
the stakeholder after task 66 (`I7`). Coverage stays at 100%; the question
is whether the tests actually check the logic and its edge cases.
**Status: in progress — phases 1 and 2 done (PRs #72, #73 and the phase-2
PR); phase 3 (code and architecture) next.** Work happens on the `review/slice-1` branch, cut from
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

### Phase 1, step 2 — web app and shared packages

**How it ran (2026-10-16).** The whole web suite runs 1,520 tests in 31 s
at two Vitest workers, too slow to rerun for each of 5,113 mutants. So each
web source file got its own Stryker run (command runner) that executes only
`vitest related <file>`: every test importing the file, directly or
through other modules, so a kit mutant killed by an Experience test counts
as killed. Each package ran its whole suite. 160 runs, 51 minutes, 6
workers; memory low point 13.5 GB available (~1.5 GB per worker). Merged
report: `reports/mutation/web/mutation.json` (git-ignored).

**Score: 90.1%** (6,045 mutants: 5,441 killed, 8 timed out, 596 survived).
At 100%: `config`, `store.ts`, `packages/i18n` and several kit components.
Lowest: `kit/layouts` 61%, `shell/interactions` 66%, `kit/optionCard` 69%,
mostly styling.

#### Not gaps (~490 survivors)

| Kind | Survivors | Why |
|---|---|---|
| Tailwind class strings and class-list joins (`'flex gap-2 …'` → `''`, `[...].join(' ')` → `[]`) | ~185 | Styling. Unit tests can't sensibly pin every class; Storybook (OQ-128) and the mockups are where visuals are reviewed. |
| i18n keys of secondary copy (subtitles, captions, links) and icon names | ~90 | Presentation; titles and every action are asserted. |
| Focus-on-mount effects: `ref.current?.focus()` and constant dependency arrays (`[]` → `['Stryker was here']`) | ~40 | Equivalent: the ref is always set after mount, and a constant array never re-runs the effect. |
| `mounted` guards in data-loading effects | ~12 | Equivalent in React 18: a state update after unmount is ignored. |
| Defensive type checks on API answers (`errors.ts`, `outcome.ts`), log labels, RTK `reset()` / `unsubscribe()`, generated-icon file layout (guarded by `check:icons`), reference data lists | ~60 | Can't change observable behaviour, or covered by another check. |
| Other equivalents (`useMemo` deps, `type=""` = text, impossible caret/selection states, date checks the month test already covers) | ~100 | Cannot change behaviour with real inputs. |

#### Gaps (~105 survivors)

| # | Where | Survivors | Severity | What is untested / proposed fix |
|---|---|---|---|---|
| W1 | `manageProfile/api.ts:115` — `declineInvitation`'s `invalidatesTags` | 2 | **High** | Declining an invitation is never tested at the Experience, so the invitations list could stay stale. (On a closer look the other 12 tag mutants are equivalent: `addTagTypes` doesn't affect invalidation at runtime, nothing invalidates `'Me'`, and `membersTag` builds both the provided and the invalidated tag, so emptying it keeps them matching. Accept and the member changes are already asserted to refetch.) Fix: decline through the Experience and assert the refetch. |
| W2 | `ManageProfileExperience.tsx:178,188` | 2 | **High** | Picking a language could send `{ preferences: {} }`, and the "couldn't save" toast could show on success. Fix: assert the request body for language (theme is covered) and no toast on success. |
| W3 | `HouseholdSwitcher.tsx:79,94,143`, `ManageProfileExperience.tsx:95`, `respondToInvitation.ts:53` | 7 | Medium | Tests have one household / one invitation, so "the active one" is never told apart: every row could get `aria-current` and the check mark; the profile header and the accept toast could name the first household. Fix: two households / two invitations. |
| W4 | `Button.tsx:188`, `SelectPanel.tsx:130,175–177`, `useSelectList.ts:126,128`, `useMenuList.ts:96`, `MenuRows.tsx:104,137`, `entries.ts:158` | 22 | Medium | Accessibility state: a plain button could be `aria-disabled`, every option `aria-disabled`; the roving `tabIndex` / active option after arrow keys and the radio grouping of menu rows are unasserted. Fix: assert `aria-disabled` absent, the active option's `tabIndex`/`aria-selected` after ArrowDown, and the radio `group`. |
| W5 | `shell/routes.ts:64,76` | 2 | Medium | The access level of routes (`household`) is not pinned per route; a route could lose its household gate. Fix: a table test of every route's `access`. |
| W6 | 14 form submit handlers (`CredentialEntry`, `MfaCodeEntry`, `RegistrationFormEntry`, `InviteMember`, `PasswordChange`, …) | 14 | Medium | `event.preventDefault()` could go — the browser would reload the page on submit; jsdom hides it. Fix: assert `fireEvent.submit(form)` returns `false` (default prevented), via a shared test helper. |
| W7 | `membershipState.ts:307,341`, `alerts.ts:73`, `Select.tsx:132`, `PendingInvitations.tsx:80` | 7 | Low–medium | List edge cases: revoking one invitation must keep the others; the invite form resets only after an invite; a toast queue that changes but keeps its length must notify; "no results" only when nothing matches; other rows stay usable while one is revoking. |
| W8 | `utilities/theme.ts:112,113` | 2 | Low–medium | With the `system` theme, an OS theme change while the page is open isn't followed (and the listener isn't removed) — untested. |
| W9 | `useMaskedInput.ts:88,129` | 4 | Low | Masked-input caret: deleting a separator, and a rejected keystroke keeping the caret. |
| W10 | Email trimming in `RecoveryRequest`, `CredentialEntry`, `InviteMember`, `RegistrationFormEntry` | 7 | Equivalent (corrected) | The tests do type padded emails; the trims are redundant because an `<input type="email">` already strips surrounding spaces (browser and jsdom alike). The names' trims feed only the password-strength hints. No fix. |
| W11 | `AuthenticateExperience.tsx:170` | 2 | Low–medium (security) | The reset token is dropped from the URL with `replace: true`, so it doesn't stay in the back history — untested. |
| W12 | `RespondToInvitation.tsx:42`, `refresh.ts:44`, `baseQuery.ts:117` | 8 | Low | Inviter with only a last name; a refresh answer without an access token; which failures are logged as errors. |
| P1 | `packages/logging/src/redact.ts:4` | 1 | Low (security) | Keys with `pass` but not `password` (`passphrase`, `newPass`) aren't covered. |
| P2 | `tools/ops/src/backupFiles.ts:1` | 1 | Low–medium | The backup-name pattern isn't anchored in tests: pruning could delete a file that merely *contains* a backup name. |
| P3 | `tools/ops/src/config.ts:27` | 1 | Low | `BACKUP_KEEP=1` (the minimum) is never accepted in a test. |
| P4 | `tools/ops/src/commands.ts` | 7 | Low | Commands are checked with `toContain`/`arrayContaining`; `--username` and the row-count SQL aren't. Fix: exact arrays. |
| P5 | `packages/logging/src/logger.ts:44,46`, `env.ts:49` | 3 | Low | The daily file name (`<prefix>-%DATE%.log`, which reconcile depends on) and retention aren't asserted; `LOG_FILE_PREFIX` could accept trailing junk (e.g. `/`). |

By priority: W1 and W2 (real user-visible bugs would pass), then W3–W6
(which item is active, accessibility state, route gates, page reloads),
then the rest.

### Phase 1, step 2 — fixes

All gaps fixed on `review/slice-1-web`, one commit per group; only tests
changed.

| Commit | Findings |
|---|---|
| Review W1–W3 | Decline refetches the invitations; a picked language is sent and saved with no failure toast; the profile header, the switcher's current row and the accept toast follow the active household / answered invitation among several. |
| Review W4–W6 | No `aria-disabled` on a plain button or an enabled option; roving `tabIndex` in Select and Menu; only radio rows grouped; the household-gated route list pinned; `submitForm` (shared helper in `tests/support`) checks every form prevents the browser's own submit. |
| Review W7–W12 | Revoke keeps the other invitations; only an invite resets the invite form; the toast queue notifies when only its last shown toast changes; the busy revoke stays enabled; no-results only when empty; the fake colour-scheme query fires only `change`; masked-input edits and repeated rejected keys; the reset token leaves the URL with `REPLACE`; inviter without a first name; refresh answer without an access token; failure log levels. |
| Review P1–P5 | `passphrase` redacted; a file only containing a backup's name is never pruned; `BACKUP_KEEP=1`; exact docker/psql commands; daily log file name and retention; `LOG_FILE_PREFIX` path parts refused. |

**Verified by a second run (2026-10-16):** 91.3% (5,510 killed, 8 timed
out, 527 survived), 49 minutes. 69 survivors from the first run are now
killed and no new survivor appeared. Of the targeted lines, 18 mutants
remain, all styling or equivalent: the row *highlight* in Menu and Select
(`active`/`highlighted` props; the keyboard state itself, focus,
`tabIndex` and `aria-selected`, is now asserted), `count - 1` in the
masked input (still a change, so equivalent), the `?.` guard in the
refresh-answer check (a `null` body fails either way) and one row index
in `SelectPanel.tsx:175` (low; noted, not fixed).

## Phase 2 — Playwright

The suite (`tests/e2e/`): 2 smoke tests and 12 identity journeys (4
tagged `@core`). Preconditions are arranged through the API and elements
are found by role and catalog text, as the BDT plan asks. The journeys
assert real end states, and most check the API afterwards (roles after a
transfer, exactly one Owner). Run locally (2026-10-16) 3× in a row: 42/42
passed in 15 s. Run 10× in a row: 139/140; the failure was a real product
bug (E1), not a flaky test.

| # | Finding | Severity | Proposed fix |
|---|---|---|---|
| E1 | **A reload while the page is rotating its refresh token signs the user out.** Every page load exchanges the refresh token (the access token lives in memory only). If the page is reloaded after the API rotated the token but before the browser stored the new one, the next load presents the old token. The API reads that as a replayed, likely stolen token (OQ-100/107) and ends the session. Reproduced: under load, about 1 in 200 quick reloads lost the session, with "Refresh token replayed — session ended" in the API log. This is what failed one of the 140 runs (the role-change journey's `page.reload()`). | **Medium — product** | A decision, not a test fix. Options: (a) a short reuse grace: within a few seconds of a rotation, the previous token gets the *same* new pair instead of ending the session; (b) keep the access token in `sessionStorage`, so a reload doesn't refresh while it's valid (rarer, not gone); (c) accept it. |
| E2 | **Full E2E never runs.** CI runs `@smoke` on every PR and `@core` after merge. The 8 untagged journeys (Authenticate ×3, Manage Profile ×3, role change, household deletion) run only by hand; the BDT plan puts them nightly / pre-release. | Medium | A scheduled nightly workflow running `pnpm test:e2e`, report uploaded on failure. |
| E3 | **Smoke doesn't match the plan's smoke tier.** It checks the redirect and `/health`. Of the plan's six smoke checks, three apply to slice 1 and are missing: register → confirm MFA → tokens (API), login → verify MFA → tokens (API), and the app loading in both themes and both locales without a missing catalog key. | Medium | Add those three as `@smoke`. |
| E4 | **Some end states are only half proven.** Deleting the household checks the URL, not that the household is gone. Sign out checks the redirect, not that the session ended at the API. Changing the password checks the new one works, not that the old one is refused or that other sessions ended (FR-1.14). Onboard's "still in the language they registered in" can't fail: the browser and the registration are both en-US. | Medium–low | Check each through the API (`GET /households`, the old refresh token refused, the old password refused, a second session ended), and run the language check in pt-BR. |
| E5 | **Slice-1 journeys with no E2E yet** (Full E2E's "every use case once"): remove a member, revoke an invitation, decline an invitation, list/revoke sessions and sign out all others, another household from the switcher, and password reset. Reset needs the email sink the plan mentions; the provider is `console` only. | Medium–low | Add the five that need nothing new. Password reset waits for a test email sink, a small decision of its own. |
| E6 | **Config gaps.** No `forbidOnly` (a stray `test.only` would quietly shrink CI to one test); no trace or screenshot on failure (CI uploads a report with nothing to replay); `workers` and `retries` left implicit. | Low | `forbidOnly: !!process.env.CI`, `trace: 'retain-on-failure'`, `retries: 0` stated on purpose (a flake should be seen, not retried away). |
| E7 | **Fragile selectors.** The setup key is read with `locator('code').first()`; the transfer confirm with `.last()` among two same-named buttons; the "I saved my codes" checkbox is clicked by its text. | Low | The key by its label, the confirm inside its dialog / confirm region, the checkbox with `getByLabel`. |
| E8 | **Small helper issues.** `registerUser` turns a missing access token into `''`, so a broken registration fails later and far away; the household and profile specs share module-level `let` state, fine only while tests in a file run serially. | Low | Throw on a missing token; keep the state in a fixture. |
| E9 | **TOTP codes can be reused within their 30-second window.** Nothing records the last accepted time step, and the suite relies on it: `registerUser` confirms the enrollment with a code, and `signInThroughUi` signs in with the same code moments later. RFC 6238 §5.2 recommends refusing a code that was already accepted. | Note — security, for phase 3 | A decision (store the last accepted step per user and refuse reuse); then the E2E helpers wait for the next window or use a backup code. |

### Phase 2 — fixes

Decisions: E1 gets a short reuse grace (OQ-162); E9 stays for phase 3.

| Commit | Findings |
|---|---|
| Review E1 | OQ-162: within 10 s of a rotation, the replaced refresh token earns a new pair (`SessionAccessor.reissueReplaced`, a guarded write); the token in between becomes the replaced one, the window stays anchored. A journey drops a refresh answer after the API rotated and reloads: it fails with the grace off, passes with it. uc-14b redrawn. |
| Review E2, E6 | `nightly.yml` runs the whole suite nightly and on demand. `forbidOnly` in CI, `retries: 0` on purpose, trace and screenshot kept on failure and uploaded. |
| Review E3, E8 | Smoke adds registration → first code → session and login → code → session (API), and the signed-out pages in both locales × both themes with no missing catalog text (proven to fail on a renamed key). `registerUser` fails on a missing access token. |
| Review E4, E5, E7 | End states at the API (household gone, session ended, old password refused, other devices signed out, registration language stored). New journeys: remove member, revoke invitation, decline invitation, switch household, revoke a device and sign out all others. Selectors made robust. |

The suite is now 26 tests (7 smoke, 4 core, 15 full); 3× in a row at 4
workers: 78/78.

**Still open:** password reset has no journey; it needs a test email sink
(the provider is `console` only), a small decision of its own. E9 (TOTP
reuse within the window) goes to phase 3.

## Phase 3 — code and architecture

*(Pending.)*
