-- OQ-201: a trade's signed changes to its Holding (the exact undo, OQ-171),
-- set together or not at all, and who recorded the transaction (OQ-111).
ALTER TABLE "account_transactions" ADD COLUMN "quantity_delta" bigint;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD COLUMN "cost_basis_delta" bigint;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_trade_deltas_check" CHECK (("account_transactions"."quantity_delta" IS NULL) = ("account_transactions"."cost_basis_delta" IS NULL));