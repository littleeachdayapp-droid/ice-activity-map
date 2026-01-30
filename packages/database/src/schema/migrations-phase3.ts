import { query, closePool } from '../client.js';

const PHASE3_MIGRATIONS = [
  {
    name: '011_enable_pgcrypto',
    sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
  },
  {
    name: '012_create_email_subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS email_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        radius_km INTEGER DEFAULT 50,
        activity_types TEXT[] DEFAULT ARRAY['raid', 'checkpoint', 'arrest', 'surveillance', 'other'],
        is_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT,
        unsubscribe_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_at TIMESTAMPTZ,
        last_notified_at TIMESTAMPTZ,
        UNIQUE(email, latitude, longitude)
      );
      CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON email_subscriptions(email);
      CREATE INDEX IF NOT EXISTS idx_email_subscriptions_location
        ON email_subscriptions (latitude, longitude) WHERE latitude IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_email_subscriptions_verified
        ON email_subscriptions(is_verified) WHERE is_verified = TRUE;
    `
  }
];

async function runPhase3Migrations() {
  console.log('Running Phase 3 database migrations...\n');

  for (const migration of PHASE3_MIGRATIONS) {
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

  console.log('\nPhase 3 migrations complete!');
}

runPhase3Migrations()
  .catch(console.error)
  .finally(() => closePool());
