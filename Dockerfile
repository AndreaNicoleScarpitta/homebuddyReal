# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-slim AS production
WORKDIR /app

ENV NODE_ENV=production

# Install ALL deps (including tsx) — needed for db:migrate at startup.
# Trade-off: larger image, but avoids a separate migrations job.
COPY package.json package-lock.json* ./
RUN npm ci --include=dev && npm cache clean --force

# Copy built artifacts + files needed by db:migrate and startup scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/script ./script
COPY --from=build /app/migrations ./migrations

EXPOSE 5000

# Apply reviewed migration files, then start. If db:migrate fails, the
# container exits non-zero so Railway flags a bad deploy instead of running
# with stale schema. (db:push was abandoned here: it prompts interactively
# on destructive diffs, which silently breaks in a non-TTY container — see
# script/migrate.ts.)
CMD ["sh", "-c", "npm run db:migrate && node dist/index.cjs"]
