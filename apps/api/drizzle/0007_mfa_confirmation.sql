-- MFA enrollment confirmation (OQ-149): an account signs in only once its first
-- authenticator code is confirmed. Accounts that exist already were enrolled
-- before this rule, so they count as confirmed from their creation.
ALTER TABLE "users" ADD COLUMN "mfa_confirmed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "users" SET "mfa_confirmed_at" = "created_at";
