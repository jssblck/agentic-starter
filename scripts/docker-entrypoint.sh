#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  bun libs/db/src/migrate.ts
fi

exec "$@"
