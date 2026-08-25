#!/usr/bin/env bash
# Port 5433 on purpose — see scripts/dev-start.cjs
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/home_buddy"
export NODE_ENV=development
export PORT=5000
npx tsx server/index.ts
