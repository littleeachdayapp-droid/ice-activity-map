# Data Sources & Methodology

This document describes where ICE Activity Map data comes from, how it is processed, and what limitations exist.

---

## Data Sources

The system ingests reports from **five automated sources** plus **user submissions**.

### 1. Bluesky (Social Media)

Posts are fetched via the AT Protocol API using keyword searches. The system searches for 19 terms in English and Spanish (e.g., "ICE raid", "immigration checkpoint", "la migra", "redada") sorted by recency. Results are limited to 25 per keyword per poll cycle. Authentication requires a Bluesky app password.

### 2. Mastodon (Federated Social Media)

The system queries five major Mastodon instances (mastodon.social, mstdn.social, mas.to, mastodon.online, techhub.social) using 7 English keywords. Each instance is queried independently via its REST search API. HTML content is stripped to plain text before processing.

### 3. Reddit

A two-pronged search strategy:
- **Global search**: 5 keywords across all of Reddit, 50 results per query, limited to the last week.
- **Subreddit search**: 12 subreddits (immigration, news, localNews, and major metro subs like LosAngeles, chicago, nyc, houston, Miami, etc.) searched with 2 keywords each.

Both title and self-text are used for filtering and location extraction.

### 4. Google News (RSS)

Google News RSS feeds are queried with 29 keyword phrases covering ICE operations, immigration enforcement, CBP checkpoints, and regional terms (e.g., "ICE California", "ICE Texas"). Only articles published within the last 72 hours are accepted. Source attribution is parsed from the RSS title field.

### 5. ICE List Wiki (Crowdsourced)

A community-maintained wiki at `wiki.icelist.is` is scraped for structured entries in MediaWiki markup format. Each entry includes a date, title/URL, city, state, and description. Entries older than 7 days (configurable) are excluded.

### 6. User Submissions

Reports submitted through the web interface. These include a description, activity type, city/state, optional coordinates, and optional photo. Submissions are protected by Cloudflare Turnstile CAPTCHA.

---

## Ingestion Pipeline

All sources are polled in parallel every 60 seconds (configurable). Each poll cycle runs through the following stages:

```
Sources (parallel) --> Normalize --> Deduplicate --> Filter --> Extract Location --> Geocode --> Save
```

### Normalization

Each source adapter converts raw data into a common `NormalizedPost` schema containing: source type, source ID, full text, author info, timestamp, URL, and category (social vs. news).

### Deduplication

A two-level cache prevents reprocessing:

1. **L1 (in-memory)**: A `Set<string>` keyed by `sourceType:sourceId`. Fast but lost on restart.
2. **L2 (PostgreSQL)**: The `ingestion_cache` table persists seen IDs with a 7-day TTL. Batch-inserted at the end of each poll cycle.

### Source Health Monitoring

Each source's success/failure rate is tracked. After 5 consecutive failures, the source enters exponential backoff (up to 30 minutes) before retrying. One source failing does not block others (`Promise.allSettled`).

---

## Relevance Filtering

Filtering differs for social media posts and news articles.

### Social Media Posts

The filter's goal is to accept **first-hand sighting reports** and reject political commentary, news sharing, fundraising, memes, and hypotheticals.

**Scoring system:**
- **First-hand indicators** (+5 points each): Present-tense sighting language ("I just saw ICE agents at..."), urgent alerts ("heads up, checkpoint on..."), specific location mentions, Spanish-language sighting patterns, secondhand relay ("my neighbor texted me about ICE at...").
- **Sighting indicators** (+2 points each): Action descriptions (pulled over, detained), vehicle descriptions, street addresses, named locations, recent time markers, quantity mentions.
- **Commentary penalties** (-3 points each): Political figures/parties, policy/legislation language, advocacy organizations, opinion language, call-to-action phrases, news commentary language, hashtag activism.

**Minimum requirements:**
- At least 1 first-hand indicator, OR 3+ sighting indicators with zero commentary matches.
- Total score must be >= 3.

**Automatic exclusions** (rejected regardless of score):
- Retweets/shares, news article sharing, historical references, fundraising, job postings, non-US locations, questions asking for info, hypotheticals, advice/guides, memes, promotional content, statistics, viral patterns, and bot patterns.

**Confidence levels:**
- **High**: 2+ first-hand AND 2+ sighting indicators, score >= 10.
- **Medium**: 1+ first-hand AND 1+ sighting, score >= 5.
- **Low**: Everything else that passes.

### News Articles

News sources are classified into tiers:

- **Trusted** (17 sources): AP, Reuters, NPR, PBS, major TV networks, Univision, Telemundo, ProPublica, and several regional papers (Texas Tribune, LA Times, Miami Herald, etc.). Only require an agency mention (ICE, CBP, border patrol).
- **Unknown** (everything else): Require agency mention AND at least one action keyword (raid, arrest, detain, checkpoint, deport, etc.).
- **Blocked** (8 sources): Infowars, Natural News, Gateway Pundit, Breitbart, Daily Stormer, OANN, Newsmax. Rejected entirely.

Opinion/editorial content is excluded via pattern matching ("opinion", "editorial", "op-ed", "commentary").

---

## Location Extraction

Locations are extracted from report text using four pattern tiers, tried in order:

1. **City, State format** (high confidence): Matches patterns like "Los Angeles, CA" or "New York, New York" using regex against all 50 US states and abbreviations.

2. **Known city lookup** (medium-high confidence): Matches against a database of 65+ preconfigured cities including 23 border cities (El Paso, McAllen, Brownsville, Nogales, San Ysidro, etc.). Includes fuzzy matching via Levenshtein distance (threshold: 0.85-0.9) to handle abbreviations ("LA", "SF", "NYC"), Spanish names ("Los Angeles"), and common misspellings.

3. **Prepositional patterns** (low confidence): Matches phrases like "in Phoenix", "near Dallas", "at the checkpoint near Main St" using regex. Filters out false positives from common words.

4. **State-only mentions** (low confidence): Matches standalone state names as a last resort.

---

## Geocoding

Extracted locations are geocoded through a four-stage pipeline:

1. **Cache lookup**: Query the `geocode_cache` table by normalized location string. Instant if cached.
2. **Known city coordinates**: Lookup against 65+ hardcoded city coordinates. No API call needed.
3. **Fuzzy matching**: Attempt fuzzy match to a known city, then use its coordinates.
4. **Nominatim API**: Query OpenStreetMap's Nominatim service, restricted to US results. Rate limited to 1 request/second.

### Coordinate Validation

All geocoded coordinates are validated against US geographic bounds:
- Continental US: lat 24.4-49.4, lng -125.0 to -66.9
- Alaska: lat 51.0-71.5, lng -180.0 to -129.0
- Hawaii: lat 18.5-22.5, lng -161.0 to -154.0
- Puerto Rico: lat 17.5-18.6, lng -68.0 to -65.0

State-coordinate consistency is also checked against rough state centroids.

### Activity Type Classification

Reports are classified by pattern matching on the text:
- **Raid**: "raid", "redada", "raided", "workplace enforcement"
- **Checkpoint**: "checkpoint", "reten", "document check", "stopping vehicles"
- **Arrest**: "arrest", "detained", "custody", "apprehended", "detenido"
- **Surveillance**: "surveillance", "monitoring", "unmarked", "plainclothes", "vigilancia"
- **Other**: Default when no pattern matches.

---

## Database Storage

Reports are stored in PostgreSQL with PostGIS for spatial queries. Key fields:

| Field | Description |
|-------|-------------|
| `source_type` | Origin: bluesky, mastodon, reddit, google_news, wiki, user_submitted |
| `activity_type` | Classified type: raid, checkpoint, arrest, surveillance, other |
| `description` | Full report text |
| `city`, `state` | Extracted or user-provided location |
| `latitude`, `longitude` | Geocoded coordinates (nullable) |
| `status` | Moderation state: unverified, verified, disputed |
| `reported_at` | When the event was reported at source |
| `confirm_count`, `dispute_count` | Community verification tallies |
| `metadata` | JSONB field for filter confidence, review flags, etc. |

Reports without extractable coordinates are stored but do not appear on the map. They are visible in the report list panel.

---

## Known Limitations

### Source Coverage
- **Social media bias**: Bluesky and Mastodon user bases skew toward English-speaking, tech-savvy communities and do not represent the general population.
- **Reddit scope**: Limited to 12 subreddits and subscribers of those communities.
- **Google News window**: 72-hour cutoff may miss slower-developing stories.
- **Wiki dependency**: Relies on volunteer editors for manual curation.
- **Unreported activity**: Events that no one posts about are never captured.

### Filtering Accuracy
- Pattern-based filtering cannot understand context, sarcasm, or irony.
- Spanish language support is limited to predefined patterns, not NLP.
- New slang or terminology not in the pattern lists will be missed.
- Low-confidence posts are flagged for review but still processed, which may introduce noise.
- The blocked source list is static and does not adapt to newly unreliable outlets.

### Geocoding Accuracy
- Known city database covers 65+ cities but not all US locations.
- Nominatim API returns only the top result with no ranking.
- State-coordinate consistency checking uses rough centroids and may reject valid edge-case locations.
- Fuzzy matching thresholds (0.85-0.9) may miss unusual name variations.
- Reports that fail geocoding are stored without coordinates and excluded from the map.

### Timeliness
- Polling interval of 60 seconds means up to 1-minute delay for new reports.
- Nominatim rate limiting (1 req/sec) can bottleneck geocoding during high-volume ingestion.
- Deduplication cache has a 7-day TTL, so the same content reposted after 7 days could be re-ingested.

### Data Quality
- No automated misinformation detection beyond pattern filtering.
- Community verification (confirm/dispute votes) helps but is not definitive.
- Photo URLs are stored but photos are not validated for authenticity.
- Time zones are not adjusted in source timestamps.
