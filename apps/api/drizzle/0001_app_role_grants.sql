-- Privileges of the application role (OQ-92): the API connects as financas_app,
-- which owns nothing and can only read and write rows. Migrations run as the
-- owner role, so these grants live here rather than in the init script.
GRANT USAGE ON SCHEMA public TO financas_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO financas_app;--> statement-breakpoint
-- Tables created by later migrations get the same privileges automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO financas_app;--> statement-breakpoint
-- Append-only audit log (NFR-AUD-1): enforced by privilege, so it holds even
-- against a bug in application code.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM financas_app;
