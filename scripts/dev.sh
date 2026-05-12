#!/usr/bin/env bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/home_buddy"
export NODE_ENV=development
export PORT=5000
npx tsx server/index.ts
