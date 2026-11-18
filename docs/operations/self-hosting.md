# Self-hosting runbook

How the app runs for real (N10 S1, OQ-250): LXC 104 `financas` on the
Proxmox host, at `https://financas.andrealmeida.tech`, the same address on
the LAN and over Tailscale. The progress of the first setup is tracked in the
checklist under task 143 (`docs/planning/03-pd-execution-order.md`).

```
LAN device ───────────────────────────────┐
tailnet device away ── subnet route ──────┤   financas.andrealmeida.tech → 192.168.68.65
                                          ▼
LXC 104 financas ─ Docker Compose (compose.prod.yaml)
  caddy :80 → :443   TLS: Let's Encrypt via Cloudflare DNS-01
    └─ api :3000     the web app, /api/v1, security headers + CSP
         └─ db       postgres:18, data on the encrypted dataset fastpool/financas-db
```

| What | Where |
|---|---|
| Proxmox host | `root@192.168.68.63` |
| LXC | 104 `financas`, `192.168.68.65/22`, Ubuntu 24.04, unprivileged |
| App checkout | `/opt/financas/app` (inside the LXC) |
| Settings | `/opt/financas/app/.env.production` (from `.env.production.example`, `chmod 600`) |
| Database files | dataset `fastpool/financas-db` → LXC `/mnt/financas-db` |
| Dataset key | `/root/keys/financas-db.key` on the host (`rpool`), **plus a copy off the server** |
| API logs | `/opt/financas/logs` (14 days) |

## First setup

Each step is one item of the task 143 checklist. Run them in order.

### 1. Encrypted dataset (Proxmox host)

The database lives on its own ZFS dataset, encrypted with AES-256-GCM (S6).
The key is a file on `rpool`, which is a different disk from `fastpool`, so
the dataset unlocks at boot without anyone typing anything. It protects
against a stolen or discarded data disk, not a stolen server.

```sh
install -d -m 700 /root/keys
openssl rand -out /root/keys/financas-db.key 32
chmod 400 /root/keys/financas-db.key
zfs create -o encryption=aes-256-gcm -o keyformat=raw \
  -o keylocation=file:///root/keys/financas-db.key fastpool/financas-db
# The LXC's root (uid 0 inside) is uid 100000 on the host.
chown 100000:100000 /fastpool/financas-db
```

**Copy the key off the server now** (e.g. `base64 /root/keys/financas-db.key`
into your password manager). Without it the database can never be read again.

Proxmox masks the stock `zfs-load-key.service`, so a unit of our own loads the
key at boot, after the pools are imported and before datasets are mounted and
guests start:

```sh
cat > /etc/systemd/system/zfs-load-financas-key.service <<'EOF'
[Unit]
Description=Load the encryption key of fastpool/financas-db
DefaultDependencies=no
After=zfs-import.target
Before=zfs-mount.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/zfs load-key fastpool/financas-db

[Install]
WantedBy=zfs-mount.service
EOF
systemctl daemon-reload && systemctl enable zfs-load-financas-key.service
```

Check: `zfs get -H keystatus,mounted fastpool/financas-db` shows `available`
and `yes`. After the next planned reboot of the host, check it again.

### 2. LXC 104 (Proxmox host)

Like the other LXCs: unprivileged Ubuntu, nesting for Docker, plus
`/dev/net/tun` for Tailscale (as LXC 103 has).

```sh
pct create 104 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname financas --ostype ubuntu --unprivileged 1 \
  --features nesting=1,keyctl=1 --cores 2 --memory 2048 --swap 512 \
  --rootfs fast-vm:16 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.68.65/22,gw=192.168.68.1 \
  --nameserver 1.1.1.1 --onboot 1 \
  --mp0 /fastpool/financas-db,mp=/mnt/financas-db
cat >> /etc/pve/lxc/104.conf <<'EOF'
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
EOF
pct start 104
```

Then reserve `192.168.68.65` for it in the router.

### 3. Docker and Tailscale (inside the LXC: `pct enter 104`)

```sh
apt update && apt full-upgrade -y && apt install -y curl git
curl -fsSL https://get.docker.com | sh
curl -fsSL https://tailscale.com/install.sh | sh
# Tailscale recommends forwarding on for a subnet router.
printf 'net.ipv4.ip_forward = 1\nnet.ipv6.conf.all.forwarding = 1\n' \
  > /etc/sysctl.d/99-tailscale.conf && sysctl -p /etc/sysctl.d/99-tailscale.conf
tailscale up --hostname financas --advertise-routes=192.168.68.65/32
```

In the Tailscale admin console, open the `financas` machine → **Edit route
settings** → approve `192.168.68.65/32`, and turn off key expiry for it.
Phones use subnet routes on their own; a Linux laptop needs
`tailscale set --accept-routes`.

### 4. Cloudflare

- **DNS:** an `A` record `financas` → `192.168.68.65`, **DNS only** (grey
  cloud). Never proxied, and no tunnel: the app is never public.
- **API token:** My Profile → API Tokens → Create Token → template **Edit
  zone DNS**, zone `andrealmeida.tech`. Caddy uses it only to prove the domain
  to Let's Encrypt (DNS-01). It goes in `CLOUDFLARE_API_TOKEN`.

### 5. First deploy (inside the LXC)

```sh
install -d /opt/financas
git clone <repo URL> /opt/financas/app   # a read-only deploy key if the repo is private
install -d -o 1000 -g 1000 /opt/financas/logs   # the API runs as uid 1000
cd /opt/financas/app
cp .env.production.example .env.production && chmod 600 .env.production
# Fill in every value; the file says how to generate each secret.
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

The first build takes a few minutes. The API runs the migrations before it
starts; Caddy asks Let's Encrypt for the certificate on its first start.

### 6. Checks

- `docker compose -f compose.prod.yaml ps`: `api` and `db` healthy, `caddy` up.
- On a LAN device without Tailscale, open `https://financas.andrealmeida.tech`:
  the padlock shows a valid certificate and Sign In loads.
- On a phone with Wi-Fi off and Tailscale on: the same address loads.
- Headers: `curl -sI https://financas.andrealmeida.tech/` shows
  `content-security-policy`, `strict-transport-security`, `x-frame-options: DENY`.
- `http://financas.andrealmeida.tech` redirects to `https://`.
- Register the first account and enroll MFA.

## Updating

```sh
cd /opt/financas/app
git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

Migrations run on the API's start. The page is never cached, so browsers pick
up the new version on their next load.

## Day to day

| To | Run (inside the LXC, in `/opt/financas/app`) |
|---|---|
| See the state | `docker compose -f compose.prod.yaml ps` |
| Follow the API's log | `docker compose -f compose.prod.yaml logs -f api` |
| Restart everything | `docker compose -f compose.prod.yaml --env-file .env.production restart` |
| Stop / start | `… down` / `… up -d` (the data stays on the dataset) |

## Troubleshooting

- **No certificate / Caddy errors:** `docker compose -f compose.prod.yaml logs
  caddy`. Usually the API token's permissions, or the A record missing.
- **The name doesn't resolve on the LAN:** some routers refuse DNS answers that
  point to a private IP (DNS rebinding protection). Check with
  `nslookup financas.andrealmeida.tech 1.1.1.1` and again with the router as
  the server.
- **Works at home, not away:** the subnet route isn't approved, or the device
  doesn't accept routes (`tailscale status` on the LXC lists the route).
- **Internet down:** a device that has no cached DNS answer can't find the name,
  even at home. This is accepted (OQ-250); it comes back with the connection.
- **The LXC doesn't start after a host reboot:** the dataset key didn't load.
  `systemctl status zfs-load-financas-key`, then by hand:
  `zfs load-key fastpool/financas-db && zfs mount fastpool/financas-db && pct start 104`.
- **Key file lost on the host:** restore it from the off-server copy
  (`base64 -d > /root/keys/financas-db.key`, `chmod 400`), then load it as above.

## Backups

Not set up yet: the stakeholder will set them up later (OQ-250). They should be
encrypted (S6) and have an off-site copy, e.g. the VPS over Tailscale.
