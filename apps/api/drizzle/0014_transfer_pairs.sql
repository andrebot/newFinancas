-- A transfer between the household's own accounts is recorded as a pair that
-- shares `transfer_id` and keeps `effect = transfer`, out of In/Out (OQ-222).
-- Transfers recorded before pairs existed were never linked, so none is known
-- to be between the household's own accounts: they become external transfers
-- (`movement`) and count toward In/Out.
ALTER TABLE "account_transactions" ADD COLUMN "transfer_id" uuid;--> statement-breakpoint
CREATE INDEX "account_transactions_transfer_idx" ON "account_transactions" USING btree ("transfer_id");--> statement-breakpoint
UPDATE "account_transactions" SET "effect" = 'movement' WHERE "effect" = 'transfer';
