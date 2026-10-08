#!/bin/sh
# Runs once, when the db volume is first created (docker-entrypoint-initdb.d).
#   financas      owner — created by the image; runs migrations, owns the schema
#   financas_app  application role the API connects as; its table privileges
#                 are granted by the migrations (N5) — e.g. no UPDATE/DELETE on
#                 the audit log (NFR-AUD-1, docs/architecture/02-data-model.md)
#   financas_test second database for E2E runs, so tests never touch dev data
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$DB_APP_PASSWORD" <<'SQL'
CREATE ROLE financas_app LOGIN PASSWORD :'app_password';
CREATE DATABASE financas_test OWNER financas;
SQL
