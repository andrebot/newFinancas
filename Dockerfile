# The API, serving the built web app on its own origin (N10 S1, OQ-250).
# Built and run by compose.prod.yaml on the self-hosting LXC; see
# docs/operations/self-hosting.md.
FROM node:24-slim

# pnpm at the version package.json pins; no git hooks inside the image.
ENV HUSKY=0 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @financas/web build

ENV NODE_ENV=production \
    WEB_DIST_DIR=/app/apps/web/dist \
    LOG_DIR=/var/log/financas
# Runs as the image's unprivileged user (uid 1000): the code stays root-owned
# and read-only to it; only the log folder is its own (owned 1000 on the host).
RUN mkdir -p /var/log/financas && chown node:node /var/log/financas
USER node
EXPOSE 3000
ENTRYPOINT ["/app/infra/api/entrypoint.sh"]
