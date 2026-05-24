#!/usr/bin/env sh
set -eu

if [ -f db.sqlite ]; then
  cp db.sqlite "db.sqlite.pre-migrate-$(date +%s)"
fi

echo "Applying database migrations..."
npm run db:migrate

echo "Starting production server..."
npm run start:next
