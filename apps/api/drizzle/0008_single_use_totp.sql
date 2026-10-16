-- Single-use authenticator codes (RFC 6238 §5.2, OQ-163): the time step of the
-- last code accepted per user. Null until a code is used, so existing accounts
-- keep signing in.
ALTER TABLE "users" ADD COLUMN "mfa_last_totp_step" integer;
