CREATE TABLE "valuation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"holding_id" uuid NOT NULL,
	"valuation" bigint NOT NULL,
	"as_of_date" date NOT NULL,
	"source" text NOT NULL,
	"account_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valuation_snapshots_account_transaction_id_unique" UNIQUE("account_transaction_id"),
	CONSTRAINT "valuation_snapshots_source_check" CHECK ("valuation_snapshots"."source" IN ('manual', 'transaction')),
	CONSTRAINT "valuation_snapshots_source_link_check" CHECK (("valuation_snapshots"."source" = 'transaction') = ("valuation_snapshots"."account_transaction_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "account_month_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"opening_balance" bigint NOT NULL,
	"ending_balance" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_month_balances_month_check" CHECK ("account_month_balances"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"currency" text NOT NULL,
	"visibility" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" IN ('checking', 'savings', 'credit_card_only', 'investment')),
	CONSTRAINT "accounts_visibility_check" CHECK ("accounts"."visibility" IN ('personal', 'shared')),
	CONSTRAINT "accounts_currency_check" CHECK ("accounts"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "credit_card_month_balances" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"opening_outstanding_balance" bigint NOT NULL,
	"ending_outstanding_balance" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_card_month_balances_month_check" CHECK ("credit_card_month_balances"."month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"network" text NOT NULL,
	"last4" text NOT NULL,
	"closing_day" smallint NOT NULL,
	"due_day" smallint NOT NULL,
	"expiration_month" smallint NOT NULL,
	"expiration_year" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_cards_last4_check" CHECK ("credit_cards"."last4" ~ '^[0-9]{4}$'),
	CONSTRAINT "credit_cards_closing_day_check" CHECK ("credit_cards"."closing_day" BETWEEN 1 AND 31),
	CONSTRAINT "credit_cards_due_day_check" CHECK ("credit_cards"."due_day" BETWEEN 1 AND 31),
	CONSTRAINT "credit_cards_expiration_month_check" CHECK ("credit_cards"."expiration_month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "budget_periods" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"budget_id" uuid,
	"household_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"target_amount" bigint NOT NULL,
	"spend_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_periods_month_check" CHECK ("budget_periods"."month" BETWEEN 1 AND 12),
	CONSTRAINT "budget_periods_currency_check" CHECK ("budget_periods"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "budget_targets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"household_id" uuid NOT NULL,
	"visibility" text NOT NULL,
	"owner_user_id" uuid,
	CONSTRAINT "budget_targets_one_target_check" CHECK (("budget_targets"."category_id" IS NULL) <> ("budget_targets"."subcategory_id" IS NULL)),
	CONSTRAINT "budget_targets_visibility_check" CHECK ("budget_targets"."visibility" IN ('personal', 'shared'))
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"target_amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"visibility" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_visibility_check" CHECK ("budgets"."visibility" IN ('personal', 'shared')),
	CONSTRAINT "budgets_currency_check" CHECK ("budgets"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_memberships_role_check" CHECK ("household_memberships"."role" IN ('Owner', 'Admin', 'Member', 'Viewer'))
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"invited_user_id" uuid NOT NULL,
	"invited_by_user_id" uuid,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" IN ('Admin', 'Member', 'Viewer')),
	CONSTRAINT "invitations_status_check" CHECK ("invitations"."status" IN ('pending', 'accepted', 'declined', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_info" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"mfa_secret" text NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_theme_check" CHECK ("users"."theme" IN ('dark', 'light', 'system')),
	CONSTRAINT "users_language_check" CHECK ("users"."language" IN ('pt-BR', 'en-US'))
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_id" uuid,
	"household_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_allocations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"holding_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"percentage" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_allocations_percentage_check" CHECK ("goal_allocations"."percentage" BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"target_amount" bigint NOT NULL,
	"target_currency" text NOT NULL,
	"due_date" date NOT NULL,
	"visibility" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_visibility_check" CHECK ("goals"."visibility" IN ('personal', 'shared')),
	CONSTRAINT "goals_currency_check" CHECK ("goals"."target_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "index_rate_values" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"household_id" uuid NOT NULL,
	"index_code" text NOT NULL,
	"value" bigint NOT NULL,
	"as_of_date" date NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_holdings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"asset_type" text NOT NULL,
	"ticker" text,
	"quantity" bigint NOT NULL,
	"cost_basis" bigint NOT NULL,
	"rate_type" text,
	"rate_value" bigint,
	"incentivised" boolean,
	"archived_at" timestamp with time zone,
	"archived_by" text,
	"matured_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_holdings_rate_type_check" CHECK ("investment_holdings"."rate_type" IN ('fixed', 'cdi', 'ipca', 'igpm', 'selic')),
	CONSTRAINT "investment_holdings_rate_pair_check" CHECK (("investment_holdings"."rate_type" IS NULL) = ("investment_holdings"."rate_value" IS NULL)),
	CONSTRAINT "investment_holdings_archived_by_check" CHECK ("investment_holdings"."archived_by" IN ('system', 'user')),
	CONSTRAINT "investment_holdings_archive_pair_check" CHECK (("investment_holdings"."archived_at" IS NULL) = ("investment_holdings"."archived_by" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "investment_schedule_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"holding_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"effect" text NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"description" text,
	"holding_id" uuid,
	"credit_card_id" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_transactions_effect_check" CHECK ("account_transactions"."effect" IN ('movement', 'transfer', 'bill_payment', 'investment_trade')),
	CONSTRAINT "account_transactions_source_check" CHECK ("account_transactions"."source" IN ('manual', 'schedule')),
	CONSTRAINT "account_transactions_currency_check" CHECK ("account_transactions"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "card_transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"category_id" uuid,
	"subcategory_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_transactions_currency_check" CHECK ("card_transactions"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshots" ADD CONSTRAINT "valuation_snapshots_account_transaction_id_account_transactions_id_fk" FOREIGN KEY ("account_transaction_id") REFERENCES "public"."account_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_month_balances" ADD CONSTRAINT "account_month_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_month_balances" ADD CONSTRAINT "credit_card_month_balances_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_targets" ADD CONSTRAINT "budget_targets_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_targets" ADD CONSTRAINT "budget_targets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_targets" ADD CONSTRAINT "budget_targets_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_targets" ADD CONSTRAINT "budget_targets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_targets" ADD CONSTRAINT "budget_targets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_memberships" ADD CONSTRAINT "household_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD CONSTRAINT "goal_allocations_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_allocations" ADD CONSTRAINT "goal_allocations_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_rate_values" ADD CONSTRAINT "index_rate_values_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_rate_values" ADD CONSTRAINT "index_rate_values_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_holdings" ADD CONSTRAINT "investment_holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_schedule_entries" ADD CONSTRAINT "investment_schedule_entries_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_holding_id_investment_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."investment_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transactions" ADD CONSTRAINT "account_transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_transactions" ADD CONSTRAINT "card_transactions_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_month_balances_month_key" ON "account_month_balances" USING btree ("account_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_month_balances_month_key" ON "credit_card_month_balances" USING btree ("credit_card_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_periods_month_key" ON "budget_periods" USING btree ("budget_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_targets_shared_category_key" ON "budget_targets" USING btree ("household_id","category_id") WHERE "budget_targets"."visibility" = 'shared' AND "budget_targets"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_targets_personal_category_key" ON "budget_targets" USING btree ("household_id","owner_user_id","category_id") WHERE "budget_targets"."visibility" = 'personal' AND "budget_targets"."category_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_targets_shared_subcategory_key" ON "budget_targets" USING btree ("household_id","subcategory_id") WHERE "budget_targets"."visibility" = 'shared' AND "budget_targets"."subcategory_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_targets_personal_subcategory_key" ON "budget_targets" USING btree ("household_id","owner_user_id","subcategory_id") WHERE "budget_targets"."visibility" = 'personal' AND "budget_targets"."subcategory_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "household_memberships_member_key" ON "household_memberships" USING btree ("household_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_memberships_one_owner_key" ON "household_memberships" USING btree ("household_id") WHERE "household_memberships"."role" = 'Owner';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "audit_log_entries_export_idx" ON "audit_log_entries" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("user_id","seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_allocations_pair_key" ON "goal_allocations" USING btree ("holding_id","goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "index_rate_values_day_key" ON "index_rate_values" USING btree ("household_id","index_code","as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "investment_schedule_entries_event_key" ON "investment_schedule_entries" USING btree ("holding_id","date","kind");--> statement-breakpoint
CREATE INDEX "account_transactions_browse_idx" ON "account_transactions" USING btree ("account_id","date" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "account_transactions_holding_idx" ON "account_transactions" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "card_transactions_browse_idx" ON "card_transactions" USING btree ("credit_card_id","date" DESC NULLS LAST,"id");