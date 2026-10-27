-- A Holding's Goal split is kept by version (OQ-206): each split is in effect
-- from `valid_from` until `valid_to` (exclusive; null for the current one), so
-- progress on a past date reads the split of that day. Existing allocations
-- take the day they were written; only a current one is unique per pair.
DROP INDEX "goal_allocations_pair_key";--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD COLUMN "valid_from" date;--> statement-breakpoint
UPDATE "goal_allocations" SET "valid_from" = "created_at"::date;--> statement-breakpoint
ALTER TABLE "goal_allocations" ALTER COLUMN "valid_from" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD COLUMN "valid_to" date;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_allocations_pair_key" ON "goal_allocations" USING btree ("holding_id","goal_id") WHERE "goal_allocations"."valid_to" IS NULL;--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD CONSTRAINT "goal_allocations_period_check" CHECK ("goal_allocations"."valid_to" IS NULL OR "goal_allocations"."valid_to" > "goal_allocations"."valid_from");
