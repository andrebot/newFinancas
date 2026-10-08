import { defineConfig } from 'drizzle-kit';

// Migrations run as the owner role (DATABASE_MIGRATION_URL), never as the
// application role the API connects with (OQ-92). Generating needs no database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? '' },
  strict: true,
  verbose: true,
});
