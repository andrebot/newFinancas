-- OQ-201/OQ-205: a fixed-term contract's terms kept on its Holding, so the Engine
-- can recompute its schedule and project it: when it pays interest, its maturity
-- date as typed, and a CDI/Selic spread on top of the percent of the index.
-- No backfill: only TransactionManager (task 103) opens Holdings, so no
-- fixed-term Holding exists yet; one would fail the pair checks loudly.
ALTER TABLE "investment_holdings" ADD COLUMN "rate_spread" bigint;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD COLUMN "interest_payment" text;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_rate_spread_check" CHECK ("investment_holdings"."rate_spread" IS NULL OR "investment_holdings"."rate_type" IN ('cdi', 'selic'));--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_interest_payment_check" CHECK ("investment_holdings"."interest_payment" IN ('at_maturity', 'monthly', 'semiannual'));--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_interest_payment_pair_check" CHECK (("investment_holdings"."rate_type" IS NULL) = ("investment_holdings"."interest_payment" IS NULL));--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_due_date_pair_check" CHECK (("investment_holdings"."rate_type" IS NULL) = ("investment_holdings"."due_date" IS NULL));