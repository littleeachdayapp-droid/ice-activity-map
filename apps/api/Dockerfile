# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# Install dependencies
RUN npm ci --workspace=apps/api --workspace=packages/database

# Copy source
COPY packages/database ./packages/database
COPY apps/api ./apps/api

# Build
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# Install production dependencies only
RUN npm ci --workspace=apps/api --workspace=packages/database --omit=dev

# Copy built files
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
