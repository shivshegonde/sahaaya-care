# Multi-stage production Dockerfile for Sahaaya Care on Google Cloud Run
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY server/ ./server/
COPY client/ ./client/
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Build client and server
RUN npm run build

# Runtime Stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4003

# Copy production package.json and install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/src/db/schema.sql ./server/src/db/schema.sql

EXPOSE 4003

# Run production server
CMD ["node", "server/dist/index.js"]
