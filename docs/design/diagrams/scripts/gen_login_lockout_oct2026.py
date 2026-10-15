"""Apply the login lockout (OQ-114) and two-step sign-in (OQ-145) to the Login
and MFA Recovery call chains.

The failed-login counter lives in a `login_attempts` table owned by
UserAccessor (credentials and their protections), and the MFA challenge is a
stateless JWT from AuthenticationUtility, so no component is added and the
layout is unchanged. The Login, MFA Recovery and Refresh Tokens sequences live
in gen_identity_household.py. Idempotent: rerunning produces the same output.
"""
import pathlib

from gen_call_chains_oct2026_lib import E, write

CC = pathlib.Path(__file__).parent.parent / "call-chains"

write(CC / "identity-household" / "uc-14-login.html", "Call Chain — Login",
      "Use case 14 of 21 in the Identity &amp; Household set (CUC-2, FR-1.2). Create pattern (Session), two requests (password, then MFA code — OQ-145), security-sensitive. Updated for the login lockout (OQ-114).",
      E((1, "mgr-identity", "acc-user"), (2, "mgr-identity", "util-authn"), (3, "mgr-identity", "acc-user"),
        (4, "mgr-identity", "util-authn"), (5, "mgr-identity", "acc-session"), (6, "mgr-identity", "util-logging", "a")),
      ["<strong>Chain, step 1 (<code>POST /auth/login</code>):</strong> <code>IdentityManager</code> ① <code>UserAccessor.findLoginLock(emailKey)</code> — locked → 429 — then <code>findByEmail</code> → ② <code>AuthenticationUtility.verifyPassword</code> (a dummy hash when there&#39;s no user), then <code>signChallengeToken</code> on success → ③ <code>UserAccessor.recordLoginFailure</code> (+ <code>lockLogin</code> at the threshold) on failure.",
       "<strong>Chain, step 2 (<code>POST /auth/mfa/verify</code>):</strong> ② <code>AuthenticationUtility.verifyChallengeToken</code> → ① <code>UserAccessor.findLoginLock</code> / <code>findByEmail</code> → ② <code>verifyTotp</code> → ③ <code>recordLoginFailure</code> on a wrong code, <code>clearLoginFailures</code> on success → ④ <code>AuthenticationUtility.issueOpaqueToken</code> / <code>signAccessToken</code> → ⑤ <code>SessionAccessor.insert</code> → ⑥ <code>LoggingUtility</code> (async, audit).",
       "<strong>No new component:</strong> the failure counter (<code>login_attempts</code>, per address) is a protection on the user&#39;s credentials, so <code>UserAccessor</code> owns it alongside the hashes, MFA secret, recovery codes and reset tokens (OQ-114). The challenge token is a stateless JWT — an identity-proof primitive, so <code>AuthenticationUtility</code>&#39;s, with no storage (OQ-145). The Manager decides the threshold, window and lock length (<code>config/constants.ts</code>); the Accessor counts atomically, locks and clears (OQ-107 pattern).",
       "<strong>Changed (OQ-145):</strong> the chain took password and MFA code in one request (OQ-30); it is two again, so a wrong code can be retried alone. Wrong codes count against the same lockout as wrong passwords."])

write(CC / "identity-household" / "uc-20-mfa-recovery.html", "Call Chain — Recover MFA via Backup Code",
      "Use case 20 of 21 in the Identity &amp; Household set (FR-1.16). Login&#39;s second step with a single-use recovery code (OQ-145).",
      E((1, "mgr-identity", "util-authn"), (2, "mgr-identity", "acc-user"), (3, "mgr-identity", "util-authn"),
        (4, "mgr-identity", "acc-session"), (5, "mgr-identity", "util-logging", "a")),
      ["<strong>Chain (<code>POST /auth/mfa/recover</code>):</strong> <code>IdentityManager</code> ① <code>AuthenticationUtility.verifyChallengeToken</code> / <code>hashRecoveryCode</code> → ② <code>UserAccessor.findLoginLock</code> / <code>findByEmail</code> / <code>consumeRecoveryCode</code> (atomic, single-use), then <code>recordLoginFailure</code> on a used or unknown code or <code>clearLoginFailures</code> on success → ③ <code>AuthenticationUtility.issueOpaqueToken</code> / <code>signAccessToken</code> → ④ <code>SessionAccessor.insert</code> → ⑤ <code>LoggingUtility</code> (async, audit).",
       "<strong>No smell:</strong> a variant of Login&#39;s second step — the same challenge check and lockout, a different factor — entering the same Create(Session) pattern, not a separate flow. The previous chain left out <code>UserAccessor</code>, which owns the recovery codes; corrected."])
