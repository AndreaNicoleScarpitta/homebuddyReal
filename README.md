# HomeBuddy

HomeBuddy is the intelligent operating record of a home. It helps homeowners understand what needs attention, act on maintenance, and retain useful system and document information. It is a mobile-first progressive web app.

**Production:** https://www.homebuddy.space  
**Staging:** https://homebuddy-web-staging.up.railway.app

## Start locally

Prerequisites: Node.js 20 (20.19+), npm, and Docker with Compose. **Never use the production database, Cloudflare R2 bucket, or live Stripe keys for development.**

```sh
git clone https://github.com/AndreaNicoleScarpitta/homebuddyReal.git
cd homebuddyReal
npm ci
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

On Windows PowerShell, replace `cp` with `Copy-Item .env.example .env`. Before running migrations, edit `.env` to set a unique local `SESSION_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). The template already points to a **local** PostgreSQL database on `localhost:5433`.

Open http://localhost:5000 and create a disposable account using Sign up. No shared demo password or production account is needed. External integrations (AI, email, R2 document storage, Google sign-in, Stripe) are optional and are intentionally unconfigured for the core local workflow. Those specific features need separate sandbox credentials and their own verification.

For troubleshooting, Windows-specific notes, optional integrations, and cleanup, see **[Local development](docs/LOCAL_DEVELOPMENT.md)**.

## Stack and source map

- **Client:** React 19, TypeScript, Vite, Tailwind CSS, Wouter, and a PWA shell — `client/src/`.
- **Server:** Express + TypeScript, session authentication, API routes — `server/`.
- **Data:** PostgreSQL 16 for local/CI, Drizzle ORM schema in `shared/schema.ts`, reviewed SQL migrations under `migrations/`.
- **Services:** Cloudflare R2 (production documents), Stripe (optional one-time donations), Resend, Google OAuth, and AI providers; configuration is per environment.
- **Hosting and delivery:** Railway, protected `staging`/`main` branches, GitHub Actions with `release-gate`.

Read **[Architecture](docs/ARCHITECTURE.md)** before editing domain logic; `/api` and `/v2` coexist and require careful ownership checks.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the full-stack development server on port 5000 |
| `npm run db:migrate` | Apply reviewed migrations to the database in your local `.env` |
| `npm run check` | TypeScript type check |
| `npm test` | Unit and API tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright; install Chromium first) |
| `npm run build` | Production build |
| `docker compose down` | Stop local PostgreSQL without deleting its data |

The application and database must be running for DB-backed tests. CI runs a fresh isolated database and uses synthetic accounts. Do not point tests at production.

## Contributing and releasing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for branch naming, test expectations, PR checklist, migration review, and a first contribution.

Path: feature branch → PR to **staging** → CI and live staging smoke tests → promotion PR from **staging** to protected **main** → Railway production waits for CI, deploys, and undergoes health verification. Never push directly to `main` or bypass the release gates.

Operations: [Environments](docs/ENVIRONMENTS.md) · [Release gate](docs/RELEASE_GATE.md) · [Backups and recovery](docs/OPERATIONS_RECOVERY.md).

**Security:** Never commit `.env`, credentials, real homeowner files, database dumps, or customer personal data. Use synthetic data in local development and staging.
