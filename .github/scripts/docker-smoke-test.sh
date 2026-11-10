#!/usr/bin/env bash
# End-to-end check of the Docker Compose stack.
#
#   .github/scripts/docker-smoke-test.sh
#
# Expects the stack to be running (`docker compose up -d --wait`) on a FRESH database: it signs in
# as the bootstrap admin from .env, uploads a test image and runs a backup/restore drill.
# Never run it against a stack holding real data.
set -euo pipefail

cd "$(dirname "$0")/../.."
[ -f .env ] || { echo "No .env found (copy .env.example)." >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a
BASE="http://localhost:${APP_PORT:-8080}"
JAR="$(mktemp)"
trap 'rm -f "$JAR" /tmp/vglug-smoke.png' EXIT

in_ci() { [ "${GITHUB_ACTIONS:-}" = "true" ]; }
group() { if in_ci; then echo "::group::$1"; else echo "== $1"; fi; }
endgroup() { if in_ci; then echo "::endgroup::"; fi; }
fail() {
    if in_ci; then echo "::error title=Docker smoke test::$1"; else echo "FAIL: $1" >&2; fi
    exit 1
}
pass() { echo "  ok  $1"; }

# expect_status <expected> <description> <curl args...>
expect_status() {
    local want="$1" what="$2"; shift 2
    local got
    got=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" "$@") || got="curl-error"
    [ "$got" = "$want" ] || fail "$what: expected HTTP $want, got $got ($*)"
    pass "$what ($got)"
}

json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)"; }

api() { # api <METHOD> <path> [json-body]  -> prints response body
    local args=(-sS -b "$JAR" -c "$JAR" -X "$1" -H 'X-Requested-With: fetch' -H 'Accept: application/json')
    [ -n "${CSRF:-}" ] && args+=(-H "X-CSRF-Token: $CSRF")
    [ -n "${3:-}" ] && args+=(-H 'Content-Type: application/json' -d "$3")
    curl "${args[@]}" "$BASE$2"
}

group "Safety check"
existing=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from media"') \
    || fail "cannot query the database"
[ "$existing" = "0" ] || fail "refusing to run: the database already has $existing media rows (not a fresh test stack)"
pass "fresh database"
endgroup

group "Containers"
for svc in db backend email-worker frontend; do
    state=$(docker compose ps --format '{{.Service}} {{.Health}}' | awk -v s="$svc" '$1==s {print $2}')
    [ "$state" = "healthy" ] || fail "service '$svc' is not healthy (state: ${state:-missing})"
    pass "$svc healthy"
done
endgroup

group "Frontend (nginx)"
expect_status 200 "home page" "$BASE/"
expect_status 200 "client-side route falls back to index.html" "$BASE/admin/login"
curl -sI "$BASE/" | grep -qi '^content-security-policy:' || fail "Content-Security-Policy header missing on /"
pass "CSP header present"
endgroup

group "Backend API through the proxy"
expect_status 200 "health endpoint" "$BASE/api/health"
expect_status 200 "site settings" "$BASE/api/site"
expect_status 200 "content listing" "$BASE/api/content"
expect_status 401 "admin endpoint requires sign-in" "$BASE/api/admin/auth/me"
expect_status 403 "unsafe request without X-Requested-With is rejected" -X POST "$BASE/api/admin/auth/logout"
expect_status 404 "unknown media file" "$BASE/media/blogs/does-not-exist.png"
endgroup

group "Database migrations"
head=$(docker compose exec -T backend flask db heads 2>/dev/null | awk '{print $1}')
current=$(docker compose exec -T backend flask db current 2>/dev/null | awk '{print $1}')
if [ -z "$head" ] || [ "$head" != "$current" ]; then
    fail "database is at '$current' but the latest migration is '$head'"
fi
pass "database at latest migration ($current)"
endgroup

group "Admin sign-in, password change and media upload"
resp=$(api POST /api/admin/auth/login \
    "{\"username\":\"${INITIAL_ADMIN_USERNAME:-vglug}\",\"password\":\"${INITIAL_ADMIN_PASSWORD:-vglug@123}\"}")
CSRF=$(echo "$resp" | json_field "['data']['csrf_token']") || fail "bootstrap admin login failed: $resp"
pass "bootstrap admin signed in"
NEW_PW="Smoke-$(openssl rand -hex 12)!"
resp=$(api POST /api/admin/auth/password \
    "{\"current_password\":\"${INITIAL_ADMIN_PASSWORD:-vglug@123}\",\"new_password\":\"$NEW_PW\"}")
CSRF=$(echo "$resp" | json_field "['data']['csrf_token']") || fail "forced password change failed: $resp"
pass "forced password change"

python3 - <<'PY'
import struct, zlib
def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
raw = b"".join(b"\x00" + b"\xc8\x10\x2e" * 16 for _ in range(16))
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 16, 16, 8, 2, 0, 0, 0)) \
      + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
open("/tmp/vglug-smoke.png", "wb").write(png)
PY
resp=$(curl -sS -b "$JAR" -c "$JAR" -H 'X-Requested-With: fetch' -H "X-CSRF-Token: $CSRF" \
    -F category=blogs -F alt_text="CI smoke test" -F "file=@/tmp/vglug-smoke.png;type=image/png" \
    "$BASE/api/admin/media")
MEDIA_URL=$(echo "$resp" | json_field "['data']['url']") || fail "media upload failed: $resp"
MEDIA_PATH="${MEDIA_URL#/media/}"
pass "image uploaded ($MEDIA_PATH)"
expect_status 200 "uploaded file is served to the admin" "$BASE/media/$MEDIA_PATH"
anon=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/media/$MEDIA_PATH")
[ "$anon" = "404" ] || fail "draft-only file must be hidden from anonymous visitors, got HTTP $anon"
pass "draft-only file is hidden from anonymous visitors (404)"
endgroup

group "Persistence across docker compose down/up"
docker compose down
docker compose up -d --wait
docker compose exec -T backend test -f "/data/uploads/$MEDIA_PATH" || fail "uploaded file lost after down/up"
count=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from media"')
[ "$count" = "1" ] || fail "media row lost after down/up (count=$count)"
pass "database row and uploaded file survived"
endgroup

group "Backup and restore drill"
BK="backups/ci-smoke"
rm -rf "$BK"
scripts/backup.sh "$BK"
docker compose exec -T backend rm "/data/uploads/$MEDIA_PATH"
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qc "delete from media"'
scripts/restore.sh "$BK" --yes
docker compose exec -T backend test -f "/data/uploads/$MEDIA_PATH" || fail "restore did not bring back the uploaded file"
count=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from media"')
[ "$count" = "1" ] || fail "restore did not bring back the media row (count=$count)"
expect_status 200 "health after restore" "$BASE/api/health"
pass "backup and restore round trip"
endgroup

echo "All Docker smoke tests passed."
