#!/bin/sh
# Container entry point.
#   web     apply migrations, seed missing content (never overwrites), start gunicorn
#   worker  run the email outbox worker
#   other   run the given command (e.g. `flask db current`)
set -e

wait_for_db() {
    python - <<'PY'
import os, sys, time
from sqlalchemy import create_engine, text
url = os.environ.get("DATABASE_URL", "")
for attempt in range(60):
    try:
        with create_engine(url).connect() as conn:
            conn.execute(text("SELECT 1"))
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001
        if attempt == 0:
            print(f"Waiting for the database: {exc.__class__.__name__}", flush=True)
        time.sleep(2)
sys.exit("Database is not reachable after 120 seconds. Check POSTGRES_* in .env.")
PY
}

case "$1" in
    web)
        wait_for_db
        echo "Applying database migrations..."
        flask db upgrade
        if [ "${RUN_SEED:-true}" = "true" ]; then
            # Only adds rows that are missing (bootstrap admin, pages, navigation, footer).
            flask seed
        fi
        exec gunicorn wsgi:app \
            --bind 0.0.0.0:8000 \
            --workers "${GUNICORN_WORKERS:-1}" \
            --threads "${GUNICORN_THREADS:-8}" \
            --timeout "${GUNICORN_TIMEOUT:-120}" \
            --control-socket /tmp/gunicorn.ctl \
            --access-logfile - \
            --error-logfile -
        ;;
    worker)
        wait_for_db
        exec flask email-worker --interval "${EMAIL_WORKER_INTERVAL:-30}"
        ;;
    *)
        exec "$@"
        ;;
esac
