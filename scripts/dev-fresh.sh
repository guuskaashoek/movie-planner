#!/usr/bin/env sh
set -eu

echo "Generating migrations..."
npm run db:generate

echo "Pushing schema with --force..."
npm run db:push:force

echo "Starting dev server..."
npm run dev
