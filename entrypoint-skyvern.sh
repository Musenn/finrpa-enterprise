#!/bin/bash

set -e

# Install enterprise dependencies not in base image
pip install -q "passlib[bcrypt]>=1.7.4" "bcrypt==4.0.1" "PyJWT>=2.8.0" "minio>=7.2.0" 2>/dev/null || true

ALLOWED_SKIP_DB_MIGRATION_VERSION=${ALLOWED_SKIP_DB_MIGRATION_VERSION:-}

run_migration=true

if [ -n "$ALLOWED_SKIP_DB_MIGRATION_VERSION" ]; then
    current_version=$(alembic current 2>&1 | grep -Eo "[0-9a-f]{12,}" | tail -n 1 || echo "")
    echo "Current DB version: $current_version"

    if [ "$current_version" = "$ALLOWED_SKIP_DB_MIGRATION_VERSION" ]; then
        echo "WARNING: Skipping database migrations"
        run_migration=false
    fi
fi

if [ "$run_migration" = true ]; then
    echo "Running database migrations..."
    alembic upgrade head
    # Skip alembic check — enterprise tables are managed outside of Alembic migrations
fi

# Create enterprise tables and seed data if needed
echo "Ensuring enterprise schema..."
python /app/scripts/ensure_enterprise_schema.py

if [ ! -f ".streamlit/secrets.toml" ]; then
    echo "Creating organization and API token..."
    org_output=$(python scripts/create_organization.py Skyvern-Open-Source)
    api_token=$(echo "$org_output" | awk '/token=/{gsub(/.*token='\''|'\''.*/, ""); print}')
    echo -e "[skyvern]\nconfigs = [\n    {\"env\" = \"local\", \"host\" = \"http://skyvern:8000/api/v1\", \"orgs\" = [{name=\"Skyvern\", cred=\"$api_token\"}]}\n]" > .streamlit/secrets.toml
    echo ".streamlit/secrets.toml file updated with organization details."
fi

_kill_xvfb_on_term() {
  kill -TERM $xvfb
}

trap _kill_xvfb_on_term TERM

echo "Starting Xvfb..."
rm -f /tmp/.X99-lock
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x16 &
xvfb=$!

DISPLAY=:99 xterm 2>/dev/null &
python run_streaming.py > /dev/null &

python -m skyvern.forge
