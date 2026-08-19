#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies"
pnpm install

echo "==> Copying .env.example to .env (skipped if already exists)"
[ -f .env ] || cp .env.example .env

echo "==> Starting PostgreSQL + Redis"
docker-compose up -d

echo "==> Waiting for Postgres to be healthy"
until docker exec cybersim-postgres pg_isready -U user -d cybersim > /dev/null 2>&1; do
  sleep 1
done

echo "==> Pushing Prisma schema"
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push

echo "==> Seeding database"
pnpm --filter @cybersim/api db:seed

echo "==> Setup complete. Run 'pnpm dev' to start the app."
