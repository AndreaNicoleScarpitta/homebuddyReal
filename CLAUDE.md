# Home Buddy

## Quick Start (Local Development on Windows)

```bash
# Start PostgreSQL (Docker)
docker start homebuddy-postgres
# Or create fresh: docker run -d --name homebuddy-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=home_buddy -p 5432:5432 postgres:16

# Set env vars and run
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/home_buddy"
export PORT=5000
export NODE_ENV=development
npx tsx server/index.ts
```

App runs at http://localhost:5000. Login with test/password123.

## Architecture

- **Backend**: Express + TypeScript, PostgreSQL with Drizzle ORM, event-sourced architecture
- **Frontend**: React 19 + Vite + Tailwind CSS v4 + Radix UI, Wouter router
- **AI**: OpenAI GPT-4o (document analysis, task suggestions, chat)
- **Auth**: Replit OIDC (production) + test login (local dev)
- **Session**: PostgreSQL via connect-pg-simple

## Key Paths

- `server/index.ts` — Server entry point
- `server/routes.ts` — Main API routes
- `server/routes_v2.ts` — V2 event-sourced API routes
- `server/db.ts` — Database connection (Pool + Drizzle)
- `shared/schema.ts` — Drizzle schema (all tables)
- `client/src/App.tsx` — Client routing & auth gate
- `client/src/pages/` — Page components
- `vite.config.ts` — Vite build config (root: client/, aliases: @/*, @shared/*, @assets/*)
- `drizzle.config.ts` — Drizzle Kit config

## Commands

- `npm run dev` — Full-stack dev (requires NODE_ENV=development set separately on Windows)
- `npm run build` — Production build (client to dist/public, server to dist/index.cjs)
- `npm run start` — Run production build
- `npm run db:push` — Push schema changes to DB
- `npm run check` — TypeScript check

## Windows-Specific Notes

- `reusePort` removed from server listen (ENOTSUP on Windows)
- `npm run dev` script uses inline `NODE_ENV=development` which doesn't work on Windows cmd; use `export` in bash or set env vars separately
- Replit OIDC disabled locally (no REPL_ID); use test login

## Environment Variables

Required: `DATABASE_URL`
Optional: `AI_INTEGRATIONS_OPENAI_API_KEY`, `VITE_GOOGLE_PLACES_API_KEY`, `RESEND_API_KEY`, `STRIPE_API_KEY`, `SESSION_SECRET`

## Design System

- "Modern Utility" aesthetic, construction orange (#f97316)
- Plus Jakarta Sans (headings), Inter (UI)
- Minimalist, no cards, pill-style components
- Anxiety-aware UX, calm professional tone
