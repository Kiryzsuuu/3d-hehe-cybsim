#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies"
pnpm install

echo "==> Copying .env.example to .env (skipped if already exists)"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Edit .env now: set DATABASE_URL to your MongoDB Atlas connection string and JWT_SECRET."
fi

echo "==> Starting Redis (MongoDB uses Atlas, configured via DATABASE_URL in .env)"
docker-compose up -d

echo "==> Waiting for Redis to be healthy"
until docker exec cybersim-redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done

echo "==> Pushing Prisma schema"
pnpm --filter @cybersim/api db:generate
pnpm --filter @cybersim/api db:push

echo "==> Seeding database"
pnpm --filter @cybersim/api db:seed

echo "==> Setup complete. Run 'pnpm dev' to start the app."
