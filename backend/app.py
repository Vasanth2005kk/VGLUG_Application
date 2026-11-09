"""Local development entry point: `uv run app.py`.

Applies database migrations, seeds the initial admin and site content (never overwriting
existing rows), then starts the Flask development server. Settings come from backend/.env.

For production use gunicorn with wsgi:app instead (see the README).
"""

import os
import sys

from flask_migrate import upgrade
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

# The `app` package in this folder takes precedence over this file when importing.
from app import create_app
from app.cli import ensure_initial_admin, seed_footer, seed_navigation, seed_pages

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5000"))


def prepare_database(app):
    """Bring the schema up to date and add any missing initial content."""
    with app.app_context():
        upgrade()
        if ensure_initial_admin():
            print(f"Created initial administrator '{app.config['INITIAL_ADMIN_USERNAME']}'. "
                  "The password must be changed at first sign-in.")
        pages = seed_pages()
        if pages:
            print(f"Seeded pages: {', '.join(pages)} (draft — review and publish in the admin panel).")
        if seed_navigation():
            print("Seeded navigation.")
        if seed_footer():
            print("Seeded footer.")


def main():
    try:
        app = create_app()
    except RuntimeError as exc:
        sys.exit(f"Configuration error: {exc}")

    if app.config["ENV_NAME"] == "production":
        sys.exit("APP_ENV=production: the development server is not for production. "
                 "Run `uv run gunicorn -w 3 -b 127.0.0.1:8000 wsgi:app` instead.")

    # With debug on, the reloader runs this file again in a child process; prepare only once.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        try:
            prepare_database(app)
        except OperationalError:
            db_url = make_url(app.config["SQLALCHEMY_DATABASE_URI"]).render_as_string(hide_password=True)
            sys.exit(f"Cannot connect to the database at {db_url}.\n"
                     "Check DATABASE_URL in backend/.env and that PostgreSQL is running "
                     "(for a local one: `docker compose up -d db` from the project root).")

    app.run(host=HOST, port=PORT, debug=True)


if __name__ == "__main__":
    main()
