-- Existing sessions have no expiry or rotation history: end them (users sign in
-- again) so expires_at can be NOT NULL without inventing a value (OQ-106).
DELETE FROM "sessions";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "previous_refresh_token_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_previous_refresh_token_hash_unique" UNIQUE("previous_refresh_token_hash");