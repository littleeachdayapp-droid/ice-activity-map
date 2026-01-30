import { query, closePool } from '../client.js';

const PHASE6_MIGRATIONS = [
  {
    name: '022_update_source_type_constraint',
    sql: `
      ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_source_type_check;
      ALTER TABLE reports ADD CONSTRAINT reports_source_type_check
        CHECK (source_type IN ('bluesky', 'mastodon', 'reddit', 'google_news', 'wiki', 'user_submitted'));
    `
  }
];

export async function runPhase6Migrations() {
  console.log('Running Phase 6 migrations...\n');

  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of PHASE6_MIGRATIONS) {
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

  console.log('\nPhase 6 migrations complete!');
}

// Run directly
if (process.argv[1]?.includes('migrations-phase6')) {
  runPhase6Migrations()
    .catch(console.error)
    .finally(() => closePool());
}
