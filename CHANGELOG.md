# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Google News Integration (2026-01-25)
- Added Google News RSS as a supplementary data source for ICE/CBP activity reports
- New file: `apps/ingestion/src/google-news/search.ts` - RSS fetching and parsing
- Added `fast-xml-parser` dependency for XML parsing
- Added `checkNewsRelevance()` filter in `apps/ingestion/src/filters/relevance.ts`
  - Requires ICE/CBP agency mention + action keyword (raid, arrest, detention, etc.)
  - Rejects opinion/editorial pieces
- Added `ENABLE_GOOGLE_NEWS` environment variable (opt-in, defaults to false)
- Added `google_news` to `ReportSource` type in database
- News articles display with newspaper icon in logs

#### Improved Social Media Filtering (2026-01-25)
- Enhanced exclusion patterns in relevance filter:
  - Viral/trending content patterns
  - Bot-like patterns (f4f, followback, automated)
  - Spam link shorteners (bit.ly, tinyurl, etc.)
  - Non-US content (brexit, EU immigration)
- Added election-related keywords to commentary indicators
- Added advocacy organization mentions to commentary filter

#### Street Address Field in Report Form (2026-01-25)
- Added optional street address field to the user report form
- Added "Look up from address" button that geocodes address to coordinates using Nominatim
- Provides more precise location mapping when users don't have GPS
- Full i18n support (English and Spanish translations)

### Changed
- Updated `apps/ingestion/src/index.ts` to support category-aware filtering (social vs news)
- Form now shows geocoding loading state while looking up addresses

---

## Version History

### v0.1.0 - Initial Release
- Multi-source ingestion (Bluesky, Mastodon, Reddit)
- Real-time map with activity markers
- User report submission with CAPTCHA
- Moderation queue for report review
- Push notification subscriptions
- Verification/dispute voting system
- i18n support (English/Spanish)
