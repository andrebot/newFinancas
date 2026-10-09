-- Platform role (OQ-111): every existing and newly registered user is a USER;
-- how an ADMIN is created is decided later.
ALTER TABLE "users" ADD COLUMN "system_role" text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_system_role_check" CHECK ("users"."system_role" IN ('USER', 'ADMIN'));