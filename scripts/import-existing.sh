#!/usr/bin/env bash
# One-time migration of an EXISTING (non-Docker) installation into the Docker stack.
#
#   scripts/import-existing.sh                    # reads DATABASE_URL from backend/.env
#   scripts/import-existing.sh --source-url postgresql://user:pass@localhost:5432/vglug
#   scripts/import-existing.sh --dump existing.dump   # use a pg_dump -Fc file you already made
#   options:  --uploads <dir>  (default backend/uploads)   --yes  (skip confirmation)
#
# The source database and upload folder are only READ, never modified. The result is saved
# as a normal backup folder (backups/import-<timestamp>) and then restored with restore.sh,
# which first saves whatever is currently in the Docker volumes.
set -euo pipefail

cd "$(dirname "$0")/.."
SOURCE_URL=""
DUMP=""
UPLOADS="backend/uploads"
YES=""
while [ $# -gt 0 ]; do
    case "$1" in
        --source-url) SOURCE_URL="$2"; shift 2 ;;
        --dump) DUMP="$2"; shift 2 ;;
        --uploads) UPLOADS="$2"; shift 2 ;;
        --yes) YES="--yes"; shift ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

OUT="backups/import-$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$OUT"

if [ -n "$DUMP" ]; then
    cp "$DUMP" "$OUT/database.dump"
else
    if [ -z "$SOURCE_URL" ]; then
        [ -f backend/.env ] || { echo "No --source-url given and backend/.env not found." >&2; exit 1; }
        SOURCE_URL=$(grep -E '^DATABASE_URL=' backend/.env | tail -1 | cut -d= -f2- | tr -d '"'"'")
    fi
    # pg_dump needs a plain libpq URL, not the SQLAlchemy "+psycopg" form.
    SOURCE_URL="${SOURCE_URL/postgresql+psycopg:/postgresql:}"
    command -v pg_dump > /dev/null || { echo "pg_dump not found. Install postgresql-client, or use --dump." >&2; exit 1; }
    echo "Dumping the existing database (read-only)..."
    pg_dump "$SOURCE_URL" --format=custom --no-owner --no-privileges > "$OUT/database.dump"
fi

if [ -d "$UPLOADS" ]; then
    echo "Archiving existing uploads from $UPLOADS..."
    tar -czf "$OUT/uploads.tar.gz" -C "$(dirname "$UPLOADS")" --transform "s,^$(basename "$UPLOADS"),uploads," "$(basename "$UPLOADS")"
else
    echo "Upload folder $UPLOADS not found; only the database will be imported."
fi
(cd "$OUT" && if [ -f uploads.tar.gz ]; then sha256sum database.dump uploads.tar.gz; else sha256sum database.dump; fi > SHA256SUMS)

echo "Import bundle saved in $OUT (keep it as your migration backup)."
docker compose build backend
scripts/restore.sh "$OUT" $YES
