#!/usr/bin/env sh
set -eu

echo "Applying database schema updates..."
npm run db:push:force

echo "Starting production server..."
npm run start:next
