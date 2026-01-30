# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/ingestion/package*.json ./apps/ingestion/
COPY packages/database/package*.json ./packages/database/

# Install dependencies
RUN npm ci --workspace=apps/ingestion --workspace=packages/database

# Copy source
COPY packages/database ./packages/database
COPY apps/ingestion ./apps/ingestion

# Build
RUN npm run build --workspace=packages/database
RUN npm run build --workspace=apps/ingestion

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY apps/ingestion/package*.json ./apps/ingestion/
COPY packages/database/package*.json ./packages/database/

# Install production dependencies only
RUN npm ci --workspace=apps/ingestion --workspace=packages/database --omit=dev

# Copy built files
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/ingestion/dist ./apps/ingestion/dist

CMD ["node", "apps/ingestion/dist/index.js"]
