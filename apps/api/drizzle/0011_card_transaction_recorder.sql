-- OQ-201: who recorded a Card Transaction (OQ-111), and the browse index in
-- Browse's order, (date, id) newest first, as account_transactions got in 0010.
DROP INDEX "card_transactions_browse_idx";--> statement-breakpoint
ALTER TABLE "card_transactions" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_transactions_browse_idx" ON "card_transactions" USING btree ("credit_card_id","date" DESC NULLS FIRST,"id" DESC NULLS FIRST);