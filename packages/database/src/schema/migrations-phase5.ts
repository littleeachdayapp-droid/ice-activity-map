import { query, closePool } from '../client.js';

const PHASE5_MIGRATIONS = [
  {
    name: '020_create_ingestion_cache',
    sql: `
      CREATE TABLE IF NOT EXISTS ingestion_cache (
        source_type VARCHAR(20) NOT NULL,
        source_id VARCHAR(255) NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source_type, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ingestion_cache_first_seen ON ingestion_cache (first_seen_at);
    `
  },
  {
    name: '021_add_reports_metadata',
    sql: `
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    `
  }
];

export async function runPhase5Migrations() {
  console.log('Running Phase 5 migrations...\n');

  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of PHASE5_MIGRATIONS) {
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

  console.log('\nPhase 5 migrations complete!');
}

// Run directly
if (process.argv[1]?.includes('migrations-phase5')) {
  runPhase5Migrations()
    .catch(console.error)
    .finally(() => closePool());
}
