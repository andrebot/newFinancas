-- The day an Account's starting balance was true (OQ-169): a movement dated
-- before it only rebuilds the history behind the balance. Existing Accounts
-- take the day they were created.
ALTER TABLE "accounts" ADD COLUMN "starting_balance_date" date;--> statement-breakpoint
UPDATE "accounts" SET "starting_balance_date" = "created_at"::date;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "starting_balance_date" SET NOT NULL;
