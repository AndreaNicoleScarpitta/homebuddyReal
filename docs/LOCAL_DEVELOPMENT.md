# Local development

This guide describes an isolated developer workstation, **not** a production deployment.

## Requirements

- Node.js **20.19 or later in the Node 20 line**, npm, and Docker Compose.
- PostgreSQL is supplied by Docker using the same major version as CI: **16**.
- Windows PowerShell / Windows Terminal, macOS, and Linux are supported. Windows users can run the commands in PowerShell; they do **not** need an old machine-specific batch file.

## First run

```sh
git clone https://github.com/AndreaNicoleScarpitta/homebuddyReal.git
cd homebuddyReal
npm ci
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

On PowerShell use `Copy-Item .env.example .env` instead of `cp`. On either platform, **before** `db:migrate`, set `SESSION_SECRET` in `.env` to a random local-only string generated with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The template sets `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/home_buddy`, `NODE_ENV=development`, and `PORT=5000`. Docker binds PostgreSQL **only to 127.0.0.1**, avoiding conflict with a different local database on port 5432. Do not paste a Railway connection string into `.env`.

Check database health with `docker compose ps`, and application health at http://localhost:5000/api/health. Open http://localhost:5000/signup, use a unique disposable email and password (8+ characters), then complete the local quick setup to obtain starter maintenance tasks.

You can stop the server with Ctrl-C and PostgreSQL with `docker compose down`. To **discard local test data only**, run `docker compose down -v` after confirming you're in this project's compose directory. Never use volume deletion against Railway.

## Running checks

```sh
npm run check
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The Vitest API/integration tests depend on a migrated local database. Playwright uses `http://localhost:5000` by default and starts a dev server when one is not running. Test sign-up/account deletion flows **only against synthetic local data**. Remote Playwright tests are explicitly limited to the approved staging host.

## Optional integrations

Leave API credentials **empty** until you actually need to test an integration. You can develop navigation, basic auth, core home records and standard maintenance without live provider keys.

- **Documents:** use a **dedicated development-only S3-compatible bucket**, with a dev-scoped token and compatible CORS configuration, then populate the `R2_*` variables. Never use `homebuddy-prod` or production object credentials.
- **AI:** add a separately budgeted development provider key to `AI_INTEGRATIONS_OPENAI_API_KEY`; don't send real customer documents.
- **Email:** use a dedicated Resend test/sandbox setup. Password reset requires working email delivery; local signup itself does not require a production sender.
- **Stripe:** leave `STRIPE_SECRET_KEY` unset unless using a **test-mode** key. Never set `STRIPE_SYNC_ENABLED=1` for local work. Donations are optional and no subscriptions are sold to new users.
- **Google OAuth:** optional; configure dev OAuth callback and `OAUTH_BASE_URL=http://localhost:5000` when needed. Normal local email/password signup works without it.

If the server refuses to start, inspect the terminal for `DATABASE_URL` / migration errors, verify Docker is healthy, then confirm `.env` has `NODE_ENV=development`. Do not fix local setup by switching to production credentials.

## Schema changes

Edit `shared/schema.ts`, generate an additive migration with `npx drizzle-kit generate --name <short-description>`, inspect every SQL statement, and run `npm run db:migrate` on a disposable local database. Commit schema and migration files together. **Never run `db:push` on staging or production:** it may drop handwritten constraints and other objects that migrations preserve.

## Troubleshooting

- **Port 5433 in use:** stop the conflicting service or change both the Docker host port and local `DATABASE_URL`; keep the database internal port at 5432.
- **Port 5000 in use:** stop the other web process or coordinate a port change with Playwright's `baseURL`.
- **Missing AI/R2/email integrations:** expected with the blank sandbox variables; test only features for which you have isolated integration credentials.
- **Windows shell error:** `npm run dev` is cross-platform and does not use POSIX `NODE_ENV=...` assignment.
- **Reset a broken local database:** inspect your compose project and volume name first; do not run destructive cleanup against external resources.
