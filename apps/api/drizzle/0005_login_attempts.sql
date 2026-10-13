-- Login lockout (OQ-114): failed sign-ins per email address, not per user, so an
-- address with no account locks exactly like a real one.
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email_key" text NOT NULL,
	"failed_count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "login_attempts_email_key_unique" UNIQUE("email_key"),
	CONSTRAINT "login_attempts_failed_count_check" CHECK ("login_attempts"."failed_count" >= 0)
);
