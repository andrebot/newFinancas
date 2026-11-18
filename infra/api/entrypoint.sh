#!/bin/sh
# The API container's start (OQ-250): bring the schema up to date as the owner
# role (the migrations also grant the app role its privileges, N5), then run
# the API as the least-privileged role. A failed migration stops the start.
set -eu

cd /app/apps/api
node ./node_modules/drizzle-kit/bin.cjs migrate
LOG_FILE_PREFIX=api exec ./node_modules/.bin/tsx src/server.ts
