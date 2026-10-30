-- 1. A transfer pair is one sent and one received side, and only a pair is a
--    `transfer` (OQ-222): migration 0014 left no unlinked `transfer` row.
CREATE UNIQUE INDEX "account_transactions_transfer_side_key" ON "account_transactions" USING btree ("transfer_id","kind") WHERE "account_transactions"."transfer_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_transfer_pair_check" CHECK (("account_transactions"."transfer_id" IS NOT NULL) = ("account_transactions"."effect" = 'transfer'));--> statement-breakpoint
-- 2. A trade's automatic snapshot is the Holding's money, not a unit price
--    (OQ-222): the snapshots written before stored `amount / quantity` over
--    units × 10⁸, about 0. Each is recomputed as TransactionManager now
--    keeps it (managers/holdingValues.ts): walking the Holding's history in
--    order — date, then time written — a market value typed in sets the
--    value, a buy adds its amount, a sell or redemption takes its amount off,
--    and a position sold out is worth nothing. (Here a value that dips below
--    zero mid-way is floored once, at the trade, not at each step.)
WITH "events" AS (
  SELECT t."holding_id", t."date", t."created_at", t."id" AS "transaction_id",
    NULL::bigint AS "typed_value",
    CASE WHEN t."kind" = 'investment_buy' THEN t."amount" ELSE -t."amount" END AS "moved",
    t."quantity_delta" AS "units"
  FROM "account_transactions" t
  WHERE t."holding_id" IS NOT NULL AND t."quantity_delta" IS NOT NULL
  UNION ALL
  SELECT s."holding_id", s."as_of_date", s."created_at", NULL, s."valuation", 0, 0
  FROM "valuation_snapshots" s
  WHERE s."source" = 'manual'
), "ordered" AS (
  SELECT e.*,
    COUNT(e."typed_value") OVER "history" AS "since_typed",
    SUM(e."units") OVER "history" AS "held"
  FROM "events" e
  WINDOW "history" AS (
    PARTITION BY e."holding_id" ORDER BY e."date", e."created_at"
    ROWS UNBOUNDED PRECEDING
  )
), "valued" AS (
  SELECT o."transaction_id", o."held",
    COALESCE(MAX(o."typed_value") OVER "stretch", 0)
      + SUM(o."moved") OVER ("stretch" ORDER BY o."date", o."created_at" ROWS UNBOUNDED PRECEDING)
      AS "value"
  FROM "ordered" o
  WINDOW "stretch" AS (PARTITION BY o."holding_id", o."since_typed")
)
UPDATE "valuation_snapshots" s
SET "valuation" = CASE WHEN v."held" = 0 THEN 0 ELSE GREATEST(0, v."value") END
FROM "valued" v
WHERE s."account_transaction_id" = v."transaction_id";
