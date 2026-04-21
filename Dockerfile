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

# Install ALL deps (including drizzle-kit, tsx) — needed for db:push at startup.
# Trade-off: larger image, but avoids a separate migrations job.
COPY package.json package-lock.json* ./
RUN npm ci --include=dev && npm cache clean --force

# Copy built artifacts + files needed by db:push and startup scripts
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/shared ./shared
COPY --from=build /app/script ./script

EXPOSE 5000

# Push schema, then start. If db:push fails, the container still exits non-zero
# so Railway flags a bad deploy instead of running with stale schema.
CMD ["sh", "-c", "npm run db:push && node dist/index.cjs"]
