# Deployment Guide

This guide covers deploying the ICE Activity Map to production using Fly.io (API + Ingestion) and Vercel (Web).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Fly.io        │     │   Fly.io        │
│   (Web App)     │────▶│   (API)         │◀────│   (Ingestion)   │
│                 │     │                 │     │                 │
│  React + Vite   │     │  Express + WS   │     │  Data Pipeline  │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 ▼                       │
                        ┌─────────────────┐              │
                        │   Fly.io        │◀─────────────┘
                        │   (PostgreSQL)  │
                        │   + PostGIS     │
                        └─────────────────┘
```

## Prerequisites

1. **Fly.io Account**: https://fly.io/
2. **Vercel Account**: https://vercel.com/
3. **GitHub Repository**: Push this code to GitHub
4. **Cloudflare Account** (for Turnstile CAPTCHA): https://dash.cloudflare.com/

## Step 1: Install CLI Tools

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login
```

## Step 2: Create PostgreSQL Database

```bash
# Create a Fly.io Postgres cluster
fly postgres create --name ice-activity-map-db --region sjc

# Note the connection string output - you'll need it!
# Format: postgres://user:password@ice-activity-map-db.internal:5432/ice_activity_map
```

## Step 3: Deploy API Service

```bash
# From project root
cd /path/to/ice-activity-map

# Create the Fly.io app (first time only)
fly apps create ice-activity-map-api

# Attach the database
fly postgres attach ice-activity-map-db --app ice-activity-map-api

# Set environment variables
fly secrets set \
  CORS_ORIGIN="https://your-domain.vercel.app" \
  TURNSTILE_SECRET_KEY="your-turnstile-secret-key" \
  ADMIN_API_KEY="$(openssl rand -hex 32)" \
  --app ice-activity-map-api

# Deploy
fly deploy --config fly.toml
```

## Step 4: Run Database Migrations

```bash
# SSH into the API machine and run migrations
fly ssh console --app ice-activity-map-api

# Inside the container:
node -e "require('./packages/database/dist/schema/migrate.js').migrate()"

# Exit
exit
```

Or run migrations locally with the production DATABASE_URL:

```bash
DATABASE_URL="postgres://..." npm run db:migrate
DATABASE_URL="postgres://..." npm run db:migrate:phase2
DATABASE_URL="postgres://..." npm run db:migrate:phase3
```

## Step 5: Deploy Ingestion Service

```bash
# Create the Fly.io app
fly apps create ice-activity-map-ingestion

# Attach the database
fly postgres attach ice-activity-map-db --app ice-activity-map-ingestion

# Set environment variables
fly secrets set \
  BLUESKY_IDENTIFIER="your-bluesky-handle.bsky.social" \
  BLUESKY_APP_PASSWORD="your-app-password" \
  NOMINATIM_USER_AGENT="ICEActivityMap/1.0 (contact@yourdomain.com)" \
  --app ice-activity-map-ingestion

# Deploy
fly deploy --config apps/ingestion/fly.toml
```

## Step 6: Deploy Web App to Vercel

```bash
cd apps/web

# First deployment (interactive setup)
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: ice-activity-map-web
# - Framework: Vite
# - Build command: npm run build
# - Output directory: dist

# Set environment variables in Vercel dashboard or CLI:
vercel env add VITE_API_URL production
# Enter: https://ice-activity-map-api.fly.dev

vercel env add VITE_WS_URL production
# Enter: wss://ice-activity-map-api.fly.dev

vercel env add VITE_TURNSTILE_SITE_KEY production
# Enter: your-turnstile-site-key

# Deploy to production
vercel --prod
```

## Step 7: Set Up GitHub Actions (Automated Deploys)

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `FLY_API_TOKEN` | Fly.io deploy token | `fly tokens create deploy` |
| `VERCEL_TOKEN` | Vercel API token | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel organization ID | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | Vercel project ID | `.vercel/project.json` after `vercel link` |

After adding secrets, pushes to `main` will auto-deploy all services.

## Step 8: Configure Cloudflare Turnstile

1. Go to https://dash.cloudflare.com/ → Turnstile
2. Add a new site
3. Get Site Key (for frontend) and Secret Key (for API)
4. Update environment variables:

```bash
# API
fly secrets set TURNSTILE_SECRET_KEY="0x..." --app ice-activity-map-api

# Web (via Vercel dashboard or CLI)
vercel env add VITE_TURNSTILE_SITE_KEY production
# Enter your site key
```

## Environment Variables Reference

### API Service (Fly.io)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-set by `fly postgres attach`) |
| `PORT` | No | Server port (default: 3001) |
| `CORS_ORIGIN` | Yes | Frontend URL for CORS |
| `TURNSTILE_SECRET_KEY` | Yes | Cloudflare Turnstile secret |
| `ADMIN_API_KEY` | Yes | Admin API authentication key |
| `NODE_ENV` | No | Set to `production` |

### Ingestion Service (Fly.io)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BLUESKY_IDENTIFIER` | Yes | Bluesky handle (e.g., `user.bsky.social`) |
| `BLUESKY_APP_PASSWORD` | Yes | Bluesky app password |
| `POLL_INTERVAL_MS` | No | Polling interval (default: 60000) |
| `ENABLE_BLUESKY` | No | Enable Bluesky source (default: true) |
| `ENABLE_MASTODON` | No | Enable Mastodon source (default: true) |
| `ENABLE_REDDIT` | No | Enable Reddit source (default: true) |
| `NOMINATIM_USER_AGENT` | Yes | User agent for geocoding API |

### Web App (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | API base URL |
| `VITE_WS_URL` | Yes | WebSocket URL |
| `VITE_TURNSTILE_SITE_KEY` | Yes | Cloudflare Turnstile site key |

## Monitoring & Logs

```bash
# View API logs
fly logs --app ice-activity-map-api

# View Ingestion logs
fly logs --app ice-activity-map-ingestion

# View database status
fly postgres list

# SSH into API container
fly ssh console --app ice-activity-map-api

# Check app status
fly status --app ice-activity-map-api
```

## Scaling

```bash
# Scale API to 2 machines
fly scale count 2 --app ice-activity-map-api

# Increase API memory
fly scale memory 1024 --app ice-activity-map-api

# Scale to multiple regions
fly regions add ord --app ice-activity-map-api
```

## Database Backups

```bash
# Create manual backup
fly postgres backup create --app ice-activity-map-db

# List backups
fly postgres backup list --app ice-activity-map-db

# Restore from backup
fly postgres backup restore <backup-id> --app ice-activity-map-db
```

## Troubleshooting

### API not starting
```bash
fly logs --app ice-activity-map-api
fly ssh console --app ice-activity-map-api
# Check environment variables
printenv | grep -E "(DATABASE|CORS|TURNSTILE)"
```

### Database connection issues
```bash
# Check database status
fly status --app ice-activity-map-db

# Verify connection string
fly postgres connect --app ice-activity-map-db
```

### Ingestion not processing
```bash
fly logs --app ice-activity-map-ingestion
# Check if sources are enabled
fly ssh console --app ice-activity-map-ingestion
printenv | grep ENABLE
```

## Rollback

```bash
# List deployments
fly releases --app ice-activity-map-api

# Rollback to previous version
fly deploy --image <previous-image> --app ice-activity-map-api
```

## Cost Estimate (Fly.io Free Tier)

- **API**: 1 shared CPU, 256MB RAM = Free
- **Ingestion**: 1 shared CPU, 256MB RAM = Free
- **PostgreSQL**: 1GB storage = Free
- **Total**: $0/month (within free tier limits)

For production with more resources:
- **API**: 1 shared CPU, 512MB RAM ≈ $5/month
- **Ingestion**: 1 shared CPU, 512MB RAM ≈ $5/month
- **PostgreSQL**: 10GB storage ≈ $15/month
- **Total**: ~$25/month
