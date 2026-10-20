FROM node:24-alpine

WORKDIR /app

# Build tools for native modules (better-sqlite3, sharp) when no prebuilt binary matches
RUN apk add --no-cache python3 make g++

# Install dependencies from the lockfile first for better layer caching.
# devDependencies stay installed: the start script runs drizzle-kit migrations.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Dummy values so Next.js can prerender at build time; real values come from the
# runtime env. Set on the build step only: a public dummy NEXTAUTH_SECRET left in
# the image would become the JWT secret if AUTH_SECRET were ever missing.
RUN DATABASE_URL="file:./local.db" \
    NEXTAUTH_SECRET="dummy_secret_for_build_purposes_only" \
    NEXTAUTH_URL="http://localhost:3000" \
    npm run build

# No root inside the container. The app dir itself must be writable: the start
# script copies db.sqlite before migrating and SQLite creates its journal next to
# the bind-mounted database. Next writes its image cache to .next/cache.
RUN chown node:node /app && chown -R node:node /app/.next
USER node

EXPOSE 3000

# Applies Drizzle migrations, then starts Next.js (see scripts/start-prod.sh)
CMD ["npm", "run", "start"]
