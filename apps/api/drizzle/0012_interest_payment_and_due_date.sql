-- OQ-201/OQ-205: when a fixed-term contract pays interest and its maturity date,
-- kept on its Holding so the Engine can recompute the schedule when the buy is
-- edited. Fixed-term Holdings recorded before pay at maturity (the default) and
-- take their redemption entry's date as the due date.
ALTER TABLE "investment_holdings" ADD COLUMN "interest_payment" text;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD COLUMN "due_date" date;--> statement-breakpoint
UPDATE "investment_holdings" SET "interest_payment" = 'at_maturity' WHERE "rate_type" IS NOT NULL;--> statement-breakpoint
UPDATE "investment_holdings" SET "due_date" = COALESCE(
  (SELECT max("date") FROM "investment_schedule_entries"
    WHERE "holding_id" = "investment_holdings"."id" AND "kind" = 'redemption'),
  "created_at"::date
) WHERE "rate_type" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_interest_payment_check" CHECK ("investment_holdings"."interest_payment" IN ('at_maturity', 'monthly', 'semiannual'));--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_interest_payment_pair_check" CHECK (("investment_holdings"."rate_type" IS NULL) = ("investment_holdings"."interest_payment" IS NULL));--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_due_date_pair_check" CHECK (("investment_holdings"."rate_type" IS NULL) = ("investment_holdings"."due_date" IS NULL));