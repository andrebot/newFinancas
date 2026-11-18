# Caddy with the Cloudflare DNS plugin (OQ-250): it obtains and renews the
# Let's Encrypt certificate through Cloudflare's DNS API (DNS-01), so the
# server needs no port open to the internet.
FROM caddy:2.10-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2.10
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
