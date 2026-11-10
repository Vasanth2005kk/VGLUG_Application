#!/bin/sh
# Executed by the postgres image only when its data volume is initialised for the first time.
# Creates the disposable test database used by `uv run pytest`.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -c "CREATE DATABASE \"${POSTGRES_DB}_test\" OWNER \"$POSTGRES_USER\";"
