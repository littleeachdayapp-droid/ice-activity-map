# ICE Activity Map - Deployment Notes

## Project Overview

An interactive map that displays real-time immigration enforcement activity reports sourced from social media (Bluesky, Mastodon). Reports are geocoded and displayed on a map to help communities stay informed.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Bluesky       │     │    Fly.io       │     │    Vercel       │
│   Firehose      │────▶│   Ingestion     │     │    Frontend     │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                                 ▼                       │
                        ┌─────────────────┐              │
                        │    Fly.io       │◀─────────────┘
                        │    Postgres     │
                        │    Database     │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Fly.io       │
                        │    API Server   │
                        └─────────────────┘
```

## Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://ice-activity-map.vercel.app |
| API | https://ice-activity-map-api.fly.dev |
| API Health | https://ice-activity-map-api.fly.dev/health |

## What Was Deployed

### 1. PostgreSQL Database (Fly.io)
- App name: `ice-activity-map-db`
- PostGIS extension enabled for geographic queries
- Stores all reports with location data

### 2. API Server (Fly.io)
- App name: `ice-activity-map-api`
- Express.js REST API
- Endpoints:
  - `GET /health` - Health check
  - `GET /api/reports` - List reports with pagination
  - `POST /api/reports` - Create new report
  - `GET /api/reports/:id` - Get single report

### 3. Ingestion Service (Fly.io)
- App name: `ice-activity-map-ingestion`
- Connects to Bluesky firehose (real-time stream of all posts)
- Filters for ICE/immigration keywords locally
- Extracts locations and geocodes them
- Saves matching reports to database

### 4. Web Frontend (Vercel)
- React + Vite + TypeScript
- Interactive map using Leaflet
- Displays reports as markers
- Filters by activity type and date range

## Configuration Files

| File | Purpose |
|------|---------|
| `fly.toml` | API deployment config |
| `fly.ingestion.toml` | Ingestion deployment config |
| `apps/web/vercel.json` | Frontend deployment config |

## Environment Variables / Secrets

### API (`ice-activity-map-api`)
- `DATABASE_URL` - Postgres connection string
- `CORS_ORIGIN` - Frontend URL for CORS

### Ingestion (`ice-activity-map-ingestion`)
- `DATABASE_URL` - Postgres connection string
- `BLUESKY_IDENTIFIER` - Bluesky handle for auth
- `BLUESKY_PASSWORD` - Bluesky app password
- `ENABLE_REDDIT` - Set to `false` (disabled)

## Common Commands

```bash
# Navigate to project
cd ~/ice-activity-map

# ===== VIEWING LOGS =====
flyctl logs --app ice-activity-map-api
flyctl logs --app ice-activity-map-ingestion
flyctl logs --app ice-activity-map-db

# ===== CHECK STATUS =====
flyctl status --app ice-activity-map-api
flyctl status --app ice-activity-map-ingestion

# ===== DEPLOYMENTS =====
# Deploy API
flyctl deploy --config fly.toml --remote-only

# Deploy Ingestion
flyctl deploy --config fly.ingestion.toml --remote-only

# Deploy Frontend
cd apps/web && vercel --prod

# ===== DATABASE =====
# Connect to database
flyctl postgres connect --app ice-activity-map-db

# Run migrations
flyctl ssh console --app ice-activity-map-api -C "node /app/packages/database/dist/schema/migrate.js"

# Seed database
flyctl ssh console --app ice-activity-map-api -C "node /app/packages/database/dist/schema/seed.js"

# ===== LOCAL DEVELOPMENT =====
npm run api        # API on localhost:3001
npm run web        # Frontend on localhost:5173
npm run firehose   # Run firehose locally

# ===== SECRETS =====
# List secrets
flyctl secrets list --app ice-activity-map-api

# Set a secret
flyctl secrets set KEY=value --app ice-activity-map-api
```

## Dashboards

- **Fly.io**: https://fly.io/apps
- **Vercel**: https://vercel.com/dashboard
- **Bluesky**: https://bsky.app (for testing posts)

---

## Future Improvements

### High Priority

1. **Improve Location Extraction**
   - Current extraction is basic regex-based
   - Many posts don't have extractable locations
   - Consider using NLP/LLM for better extraction
   - Add support for landmarks, addresses, intersections

2. **Add Report Verification**
   - Currently all reports are `unverified`
   - Add admin interface for moderators
   - Implement community verification/flagging

3. **Better Filtering on Frontend**
   - Filter by verification status
   - Filter by source (Bluesky, Mastodon)
   - Search by keyword or location

### Medium Priority

4. **Add More Data Sources**
   - Reddit (requires API credentials - $100/month minimum)
   - Twitter/X (requires API access)
   - Telegram channels
   - Local news RSS feeds

5. **Push Notifications**
   - Alert users when activity reported near them
   - Email digest of activity in their area
   - PWA push notifications

6. **Report Clustering**
   - Group nearby reports about the same incident
   - Deduplicate similar reports
   - Show incident timeline

7. **Mobile App**
   - React Native or Flutter
   - Allow direct report submission
   - Real-time alerts

### Lower Priority

8. **Analytics Dashboard**
   - Trends over time
   - Heat maps by region
   - Activity type breakdown

9. **API Rate Limiting**
   - Protect API from abuse
   - Add authentication for write operations

10. **Internationalization**
    - Spanish language support
    - Other languages based on community needs

11. **Historical Data Import**
    - Import historical reports from other sources
    - Backfill from news articles

---

## Known Issues

1. **Location extraction is imprecise** - Many posts mention ICE but don't have extractable location data. These are saved with `Unknown location`.

2. **Firehose text extraction is noisy** - The CBOR parsing extracts some binary artifacts along with text. Works but could be cleaner.

3. **Reddit disabled** - Reddit's API now requires paid access ($100+/month). Disabled to avoid 403 errors.

4. **Mastodon coverage limited** - Only searches a few large instances. Could add more.

---

## Session Summary (January 25, 2026)

### What We Did

1. Resumed deployment from previous session
2. Set CORS origin on API for Vercel frontend
3. Seeded database with sample data (8 reports)
4. Deployed ingestion service to Fly.io
5. Set Bluesky credentials for authentication
6. Discovered search API rate limit (10 requests/day)
7. Switched from polling to firehose mode for real-time streaming
8. Fixed WebSocket compatibility for Node.js
9. Disabled Reddit (requires paid API)
10. Verified live data flowing (8 seed + 3 real = 11 reports)

### Architecture Decisions

- **Firehose over polling**: The Bluesky search API has strict rate limits (10/day). The firehose streams all posts and we filter locally - no rate limits.
- **Fly.io for backend**: Good free tier, easy Postgres, global deployment
- **Vercel for frontend**: Free, fast CDN, easy deploys from git
