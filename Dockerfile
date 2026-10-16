# ============================================================================
# Bot by mogent (bot.mogent.tech) Production Dockerfile
# Optimized for $7/mo AWS Lightsail VPS (<300MB RAM budget)
# ============================================================================

FROM node:22-slim AS builder

WORKDIR /app

# Install native build tools for SQLite compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install build dependencies
COPY package*.json ./
RUN npm install

# Build client
COPY client/package*.json ./client/
RUN cd client && npm install

COPY . .
RUN npm run build

# Production Runner
FROM node:22-slim AS runner

WORKDIR /app

# Install python3/make/g++ for native modules in runner
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000
ENV NODE_OPTIONS="--max-old-space-size=256"

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/bot ./bot
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./

# Persistent storage for SQLite WAL database
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 5000

# Start server using tsx
CMD ["npx", "tsx", "server/src/index.ts"]
