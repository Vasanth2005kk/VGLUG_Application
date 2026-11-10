# Running VGLUG with Docker

The whole site runs as four containers:

| Service        | What it does                                                          |
|----------------|-----------------------------------------------------------------------|
| `frontend`     | nginx serving the built React app; proxies `/api` and `/media` to the backend |
| `backend`      | Flask API on gunicorn. Applies migrations and seeds *missing* content on start |
| `email-worker` | Delivers queued subscription/announcement emails (`flask email-worker`) |
| `db`           | PostgreSQL 16                                                         |

Data is kept in two named Docker volumes, which survive stops, restarts, rebuilds and `docker compose down`:

| Volume          | Contents                                   |
|-----------------|--------------------------------------------|
| `vglug_pgdata`  | PostgreSQL data                            |
| `vglug_uploads` | Uploaded images, videos and documents (`/data/uploads`) |

> ⚠️ Only `docker compose down -v` or `docker volume rm` deletes them. **Never use `-v`** unless you mean to wipe all data.

## 1. Install

- Docker Engine 24+ with the Compose plugin (`docker compose version`), or Docker Desktop.
- To migrate an existing installation, you also need `pg_dump` (package `postgresql-client`) on the old machine.

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`. At minimum, set:

- `SECRET_KEY`: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`
- `POSTGRES_PASSWORD`: `python3 -c "import secrets; print(secrets.token_hex(24))"` (use letters/digits only; it goes into a URL)
- `PUBLIC_BASE_URL`: the address people use to reach the site (used in email links)

Notes:

- `.env` is git-ignored. Keep it private (`chmod 600 .env`). Compose refuses to start if `SECRET_KEY` or `POSTGRES_PASSWORD` is missing.
- `backend/.env` is **not** used by Docker. It's only for running the backend directly with `uv run app.py`.
- Behind HTTPS, set `SESSION_COOKIE_SECURE=true`, and use `TRUST_PROXY_COUNT=2` if another reverse proxy sits in front of the `frontend` container.
- Change `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` **before the first start**. PostgreSQL applies them only when the volume is created.

## 3. Run

```bash
docker compose up -d --build      # build and start everything
```

Open **http://localhost:8080** (or the `APP_PORT` you set). The admin panel is at `/admin`.

On a brand-new, empty database, the bootstrap admin `vglug` / `vglug@123` is created and must change the password at first sign-in. Change it before going public.

```bash
docker compose ps                 # status (all services should be "healthy")
docker compose logs -f backend    # follow logs (also: frontend, db, email-worker)
docker compose restart backend    # restart one service
docker compose stop               # stop, keep containers and data
docker compose down               # stop and remove containers, KEEP data volumes
```

### Updating to a new version of the code

```bash
scripts/backup.sh                 # always back up first
git pull
docker compose up -d --build      # the backend applies new migrations automatically
```

### Useful commands

```bash
docker compose exec backend flask db current                  # applied migration
docker compose exec backend flask media-cleanup --dry-run     # list unused media files
docker compose exec backend flask seed --publish-pages        # seed and publish missing pages
docker compose exec db sh -c 'psql -U $POSTGRES_USER $POSTGRES_DB'   # SQL shell
```

PostgreSQL is also reachable from the host at `127.0.0.1:5433` (set by `DB_HOST_PORT`, bound to localhost only).

## 4. Backup

```bash
scripts/backup.sh                         # -> backups/YYYY-MM-DD_HHMMSS/
scripts/backup.sh /mnt/usb/vglug-backup   # custom location
```

Each backup folder contains:

- `database.dump`: `pg_dump` custom format
- `uploads.tar.gz`: all uploaded files
- `SHA256SUMS`

The database and the files are backed up together because the `media` rows must match the files on disk. Copy backup folders off the machine regularly.

To back up on a schedule, add a cron job (`crontab -e`):

```
0 2 * * * cd /path/to/VGLUG_Application && scripts/backup.sh >> backups/cron.log 2>&1
```

## 5. Restore

```bash
scripts/restore.sh backups/2026-11-10_020000
```

The script:

1. Asks you to type `restore` (or pass `--yes`).
2. Saves the **current** state to `backups/pre-restore-<timestamp>`, so a restore can be undone.
3. Stops the app and replaces the database (`pg_restore`) and the uploads volume.
4. Starts everything again, applying any newer migrations.

## 6. Migrating the existing (non-Docker) installation

Your current data is in the host PostgreSQL (`DATABASE_URL` in `backend/.env`) and in `backend/uploads/`. The import **only reads** both and doesn't modify or delete anything there.

```bash
cp .env.example .env              # set SECRET_KEY / POSTGRES_PASSWORD (see step 2)
scripts/import-existing.sh        # dumps host DB + copies backend/uploads into Docker
docker compose up -d --build
```

What `import-existing.sh` does:

1. Runs `pg_dump` of the database from `backend/.env`. Use `--source-url postgresql://user:pass@host:5432/vglug` for another source, or `--dump file.dump` if you already have a dump.
2. Archives `backend/uploads` (`--uploads <dir>` to change it).
3. Saves both to `backups/import-<timestamp>/`. **Keep this folder** as your migration backup.
4. Restores them into the Docker volumes with `restore.sh`, which first saves whatever is already in Docker.

Ownership is reassigned to the Docker database user (`--no-owner`). Schema, migrations, admin accounts and password hashes, sessions settings, content and media metadata are copied as-is.

After importing, verify:

```bash
docker compose logs backend | grep -E "already exists|migration"     # seeding must say "not modified"
docker compose exec db sh -c 'psql -U $POSTGRES_USER $POSTGRES_DB -c "select count(*) from media"'
docker compose exec backend find /data/uploads -type f | wc -l
```

Then sign in to `/admin` with your **existing** admin password and check that images load.

Once you've confirmed everything works, you may stop the host PostgreSQL service (`sudo systemctl disable --now postgresql`). Keep its data and the import backup until you're certain you no longer need them.

### Moving to another computer

1. On the old machine, run `scripts/backup.sh`.
2. Copy the project folder, your `.env` and the backup folder to the new machine.
3. On the new machine, run `docker compose up -d --build`, then `scripts/restore.sh backups/<folder>`.

Copy the same `.env`: `SECRET_KEY` signs sessions, email links and like de-duplication, so keeping it preserves them.

## Troubleshooting

- **Port already in use:** change `APP_PORT` or `DB_HOST_PORT` in `.env`.
- **`Set SECRET_KEY in .env`:** you're missing `.env` (copy `.env.example`).
- **Database password changed in `.env` but login fails:** the password is fixed when the volume is created. Change it inside PostgreSQL (`ALTER USER vglug PASSWORD '...'`) or restore into a fresh volume.
- **Uploads fail for large videos:** raise `MAX_VIDEO_MB` in `.env`, and `client_max_body_size` in `frontend/nginx.conf` if above 250 MB.
- **More than one gunicorn worker:** with `RATELIMIT_STORAGE_URI=memory://`, each worker counts rate limits separately. Keep `GUNICORN_WORKERS=1` unless you use a shared store.
