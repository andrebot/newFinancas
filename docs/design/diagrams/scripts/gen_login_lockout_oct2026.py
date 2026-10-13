"""Apply the login lockout (OQ-114) to the Login call chain.

The failed-login counter lives in a new `login_attempts` table owned by
UserAccessor (credentials and their protections), so no component is added and
the layout is unchanged. The Login and Refresh Tokens sequences live in
gen_identity_household.py. Idempotent: rerunning produces the same output.
"""
import pathlib

from gen_call_chains_oct2026_lib import E, write

CC = pathlib.Path(__file__).parent.parent / "call-chains"

write(CC / "identity-household" / "uc-14-login.html", "Call Chain — Login",
      "Use case 14 of 21 in the Identity &amp; Household set (CUC-2, FR-1.2). Create pattern (Session), one request (password + MFA code together), security-sensitive. Updated for the login lockout (OQ-114).",
      E((1, "mgr-identity", "acc-user"), (2, "mgr-identity", "util-authn"), (3, "mgr-identity", "acc-user"),
        (4, "mgr-identity", "util-authn"), (5, "mgr-identity", "acc-session"), (6, "mgr-identity", "util-logging", "a")),
      ["<strong>Chain:</strong> <code>IdentityManager</code> ① <code>UserAccessor.findLoginLock(emailKey)</code> — locked → 429 — then <code>findByEmail</code> → ② <code>AuthenticationUtility.verifyPassword</code> / <code>verifyTotp</code> (a dummy hash when there&#39;s no user) → ③ <code>UserAccessor.recordLoginFailure</code> (+ <code>lockLogin</code> at the threshold) on any failure, <code>clearLoginFailures</code> on success → ④ <code>AuthenticationUtility.issueOpaqueToken</code> / <code>signAccessToken</code> → ⑤ <code>SessionAccessor.insert</code> → ⑥ <code>LoggingUtility</code> (async, audit).",
       "<strong>No new component:</strong> the failure counter (<code>login_attempts</code>, per address) is a protection on the user&#39;s credentials, so <code>UserAccessor</code> owns it alongside the hashes, MFA secret, recovery codes and reset tokens (OQ-114). The Manager decides the threshold, window and lock length (<code>config/constants.ts</code>); the Accessor counts atomically, locks and clears (OQ-107 pattern).",
       "<strong>Corrected:</strong> the previous chain described two round-trips (password, then MFA); the contract has always taken both in one request (OQ-30)."])
