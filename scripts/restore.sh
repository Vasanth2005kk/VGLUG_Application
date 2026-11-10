#!/usr/bin/env bash
# Restore a backup made by scripts/backup.sh (database + uploads, kept in sync).
#
#   scripts/restore.sh backups/2026-11-10_120000 [--yes]
#
# Before anything is replaced, the CURRENT state is saved to backups/pre-restore-<timestamp>,
# so a restore can always be undone by restoring that folder.
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="${1:-}"
ASSUME_YES="${2:-}"

if [ -z "$SRC" ] || [ ! -f "$SRC/database.dump" ]; then
    echo "Usage: $0 <backup-dir> [--yes]   (the folder must contain database.dump)" >&2
    exit 1
fi
if [ -f "$SRC/SHA256SUMS" ]; then
    (cd "$SRC" && sha256sum --quiet -c SHA256SUMS) || { echo "Checksum mismatch in $SRC" >&2; exit 1; }
fi

echo "This replaces the Docker database and uploads with the backup in: $SRC"
if [ "$ASSUME_YES" != "--yes" ]; then
    read -r -p "Type 'restore' to continue: " answer
    [ "$answer" = "restore" ] || { echo "Aborted."; exit 1; }
fi

docker compose up -d --wait db

SAFETY="backups/pre-restore-$(date +%Y-%m-%d_%H%M%S)"
echo "Saving the current state to $SAFETY first..."
scripts/backup.sh "$SAFETY"

echo "Stopping the application (database stays up)..."
docker compose stop frontend email-worker backend

echo "Restoring database..."
docker compose exec -T db sh -c '
    set -e
    dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB"
    createdb -U "$POSTGRES_USER" -O "$POSTGRES_USER" "$POSTGRES_DB"
    pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error
' < "$SRC/database.dump"

if [ -f "$SRC/uploads.tar.gz" ]; then
    echo "Restoring uploads..."
    docker compose run --rm --no-deps -T --entrypoint sh backend -c \
        'find /data/uploads -mindepth 1 -delete && tar -xzf - -C /data' < "$SRC/uploads.tar.gz"
else
    echo "No uploads.tar.gz in $SRC; uploads left unchanged."
fi

echo "Starting the application (applies any newer migrations)..."
docker compose up -d --wait
echo "Restore complete. The previous state is saved in $SAFETY"
