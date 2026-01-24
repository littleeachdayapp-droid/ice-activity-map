import { query, closePool } from '../client.js';

const MIGRATIONS = [
  {
    name: '001_enable_postgis',
    sql: `CREATE EXTENSION IF NOT EXISTS postgis;`
  },
  {
    name: '002_create_reports_table',
    sql: `
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('bluesky', 'user_submitted')),
        source_id VARCHAR(255),
        activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('raid', 'checkpoint', 'arrest', 'surveillance', 'other')),
        description TEXT NOT NULL,
        city VARCHAR(100),
        state VARCHAR(50),
        location GEOGRAPHY(POINT, 4326),
        author_handle VARCHAR(255) NOT NULL,
        author_display_name VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified', 'verified', 'disputed')),
        reported_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(source_type, source_id)
      );
    `
  },
  {
    name: '003_create_reports_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_reports_location ON reports USING GIST (location);
      CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON reports (reported_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reports_activity_type ON reports (activity_type);
      CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
      CREATE INDEX IF NOT EXISTS idx_reports_source ON reports (source_type, source_id);
    `
  },
  {
    name: '004_create_geocode_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS geocode_cache (
        id SERIAL PRIMARY KEY,
        query VARCHAR(255) NOT NULL UNIQUE,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        city VARCHAR(100),
        state VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_geocode_cache_query ON geocode_cache (query);
    `
  },
  {
    name: '005_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  }
];

async function runMigrations() {
  console.log('Running database migrations...\n');

  // Ensure migrations table exists first
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of MIGRATIONS) {
    // Check if already applied
    const result = await query<{ name: string }>(
      'SELECT name FROM migrations WHERE name = $1',
      [migration.name]
    );

    if (result.rows.length > 0) {
      console.log(`  ✓ ${migration.name} (already applied)`);
      continue;
    }

    try {
      await query(migration.sql);
      await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      console.log(`  ✓ ${migration.name} (applied)`);
    } catch (error) {
      console.error(`  ✗ ${migration.name} failed:`, error);
      throw error;
    }
  }

  console.log('\nMigrations complete!');
}

runMigrations()
  .catch(console.error)
  .finally(() => closePool());
