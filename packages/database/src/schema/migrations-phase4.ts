import { query, closePool } from '../client.js';

const PHASE4_MIGRATIONS = [
  {
    name: '013_add_photo_url_to_reports',
    sql: `
      ALTER TABLE reports
      ADD COLUMN IF NOT EXISTS photo_url TEXT;

      COMMENT ON COLUMN reports.photo_url IS 'URL to uploaded photo in R2 storage';
    `
  }
];

async function runPhase4Migrations() {
  console.log('Running Phase 4 database migrations...\n');

  for (const migration of PHASE4_MIGRATIONS) {
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

  console.log('\nPhase 4 migrations complete!');
}

runPhase4Migrations()
  .catch(console.error)
  .finally(() => closePool());
