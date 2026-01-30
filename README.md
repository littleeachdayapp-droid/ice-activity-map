# ICE Activity Map

Community-reported immigration enforcement activity tracker.

## Project Structure

```
ice-activity-map/
├── apps/
│   ├── api/          # Express API server
│   ├── ingestion/    # Multi-source data ingestion service
│   └── web/          # React frontend (Vite + TypeScript)
├── packages/
│   └── database/     # Shared database client and types
└── docs/
    ├── DEPLOY.md
    └── DEPLOYMENT-NOTES.md
```

## Data Sources

| Source | Type | Status |
|--------|------|--------|
| Bluesky | Social | Enabled by default |
| Mastodon | Social | Enabled by default |
| Reddit | Social | Enabled by default |
| Google News | News | Opt-in (`ENABLE_GOOGLE_NEWS=true`) |
| User Reports | Direct | Always enabled |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Development

```bash
# Install dependencies
npm install

# Start all services
npm run dev

# Or start individually:
cd apps/web && npm run dev      # Frontend on :5173
cd apps/api && npm run dev      # API on :3001
cd apps/ingestion && npm run dev # Ingestion service
```

### Environment Variables

Copy `.env.production.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgres://...

# Ingestion sources
ENABLE_BLUESKY=true
ENABLE_MASTODON=true
ENABLE_REDDIT=true
ENABLE_GOOGLE_NEWS=false

# API
TURNSTILE_SECRET_KEY=...
ADMIN_API_KEY=...
```

## Features

- Real-time map of reported ICE/CBP activity
- Multi-source data ingestion with relevance filtering
- User-submitted reports with CAPTCHA protection
- Community verification/dispute system
- Moderation queue for report review
- Push notifications for area alerts
- Bilingual support (English/Spanish)

## License

Private - All rights reserved
