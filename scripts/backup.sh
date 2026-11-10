#!/usr/bin/env bash
# Back up the PostgreSQL database and all uploaded media files together.
#
#   scripts/backup.sh [output-dir]      (default: backups/YYYY-MM-DD_HHMMSS)
#
# Produces:
#   database.dump   pg_dump custom format (restore with scripts/restore.sh / pg_restore)
#   uploads.tar.gz  every uploaded image, video and document
#   SHA256SUMS      checksums of both files
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="${1:-backups/$(date +%Y-%m-%d_%H%M%S)}"
mkdir -p "$OUT"

if ! docker compose ps --status running --services | grep -qx db; then
    echo "Starting the database container..."
    docker compose up -d --wait db
fi

echo "Dumping database -> $OUT/database.dump"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
    > "$OUT/database.dump.partial"
mv "$OUT/database.dump.partial" "$OUT/database.dump"

echo "Archiving uploads -> $OUT/uploads.tar.gz"
# Runs in a throwaway backend container, so it works whether or not the app is running.
docker compose run --rm --no-deps -T --entrypoint tar backend -czf - -C /data uploads \
    > "$OUT/uploads.tar.gz.partial"
mv "$OUT/uploads.tar.gz.partial" "$OUT/uploads.tar.gz"

# Sanity-check both artifacts before declaring success.
docker compose exec -T db pg_restore --list < "$OUT/database.dump" > /dev/null
tar -tzf "$OUT/uploads.tar.gz" > /dev/null
(cd "$OUT" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)

FILES=$(tar -tzf "$OUT/uploads.tar.gz" | grep -vc '/$' || true)
echo "Backup complete: $OUT"
echo "  database.dump  $(du -h "$OUT/database.dump" | cut -f1)"
echo "  uploads.tar.gz $(du -h "$OUT/uploads.tar.gz" | cut -f1) ($FILES files)"
