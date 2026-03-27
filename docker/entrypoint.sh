#!/bin/sh
set -e

require_env() {
  var_name="$1"
  value="$(printenv "$var_name" || true)"

  if [ -z "$value" ]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
}

validate_secret() {
  var_name="$1"
  value="$(printenv "$var_name" || true)"

  case "$value" in
    ""|"change-me"|"replace-me"|"super-secret")
      echo "Unsafe value detected for $var_name. Set a strong secret before starting production." >&2
      exit 1
      ;;
  esac
}

if [ "${NODE_ENV:-development}" = "production" ]; then
  require_env DATABASE_URL
  require_env NEXTAUTH_URL
  validate_secret NEXTAUTH_SECRET
  validate_secret JWT_SECRET
  validate_secret SEED_SECRET
fi

if [ "${PRISMA_SKIP_GENERATE:-1}" != "1" ]; then
  echo "Generating Prisma client..."
  yarn prisma:generate
else
  echo "Skipping Prisma client generation..."
fi

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "Applying Prisma migrations..."
  yarn prisma:migrate:deploy
else
  echo "Skipping Prisma migrations..."
fi

exec "$@"
