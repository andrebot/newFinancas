# Backup & restore runbook

How to back up, restore and verify the local Postgres database (task N12,
OQ-97). Every command runs the Postgres client tools **inside the `db`
container**, so it always matches the server version (18) and needs
nothing installed on your machine. The container must be running
(`pnpm db:up`).

## Where backups live

| Setting | Default | Override (`.env`) |
|---|---|---|
| Directory | `~/.local/share/financas/backups` (`$XDG_DATA_HOME` if set) | `BACKUP_DIR` |
| Kept | the newest 30; each backup prunes older ones | `BACKUP_KEEP` |

- **Outside the repository on purpose:** deleting or re-cloning the
  repository can't take the backups with it, and they can never be
  committed.
- **Owner-only:** the directory is `700` and each file is `600`, because
  backups contain household financial data.
- **File format:** `financas-<UTC timestamp>.dump`, in Postgres'
  compressed custom format. Each file includes the schema, the data, the
  grants and the default privileges.

## Back up

```sh
pnpm db:backup
```

Run it before anything risky: an upgrade, a migration, a bulk import.
Backups are manual only; there is no schedule.

## Restore

```sh
pnpm db:restore                          # newest backup → scratch database "financas_restore"
pnpm db:restore financas-…Z.dump         # a specific backup (name or path) → scratch
pnpm db:restore --into-live              # newest backup → OVERWRITES "financas"
```

- **By default, nothing live is touched.** The backup goes into
  `financas_restore`, where you can inspect it:

  ```sh
  docker compose exec db psql -U financas -d financas_restore
  ```

  Drop it when you're done:

  ```sh
  docker compose exec db dropdb -U financas financas_restore
  ```
- **`--into-live` replaces the real database:**
  1. It first takes a **safety backup** of the current live data, so
     restoring the wrong file can be undone with another `--into-live`.
  2. It then disconnects clients, drops and recreates `financas`, and
     restores.

  Stop the API first.

## Restore drill

```sh
pnpm db:restore-drill
```

What it does:
1. Backs up the live database.
2. Restores that backup into the scratch database.
3. Compares **row counts table by table**, and fails on any difference.
4. Drops the scratch copy.

Run it after changing anything in this tooling, and occasionally once
real data is in (N13).

### Drill log

| Date | Result | Notes |
|---|---|---|
| 2026-10-08 | ✅ 26 tables, 0 mismatches | Development data (sample users and a household, removed afterwards). Also checked by hand: a scratch restore had the rows and the app role's grants (`INSERT`/`SELECT` only on `audit_log_entries`), and `--into-live` took its safety backup, then restored. |
