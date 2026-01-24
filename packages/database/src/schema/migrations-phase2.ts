import { query, closePool } from '../client.js';

const PHASE2_MIGRATIONS = [
  {
    name: '006_create_push_subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        radius_km INTEGER DEFAULT 50,
        activity_types TEXT[] DEFAULT ARRAY['raid', 'checkpoint', 'arrest', 'surveillance', 'other'],
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_notified_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_location
        ON push_subscriptions (latitude, longitude) WHERE latitude IS NOT NULL;
    `
  },
  {
    name: '007_create_report_verifications',
    sql: `
      CREATE TABLE IF NOT EXISTS report_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_identifier TEXT NOT NULL,
        vote VARCHAR(10) NOT NULL CHECK (vote IN ('confirm', 'dispute')),
        comment TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(report_id, user_identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_report_verifications_report ON report_verifications(report_id);
    `
  },
  {
    name: '008_add_verification_counts_to_reports',
    sql: `
      ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS confirm_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS dispute_count INTEGER DEFAULT 0;
    `
  },
  {
    name: '009_create_report_flags',
    sql: `
      CREATE TABLE IF NOT EXISTS report_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        user_identifier TEXT NOT NULL,
        reason VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'misinformation', 'duplicate', 'inappropriate', 'other')),
        details TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        reviewed_by TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(report_id, user_identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_report_flags_status ON report_flags(status);
      CREATE INDEX IF NOT EXISTS idx_report_flags_report ON report_flags(report_id);
    `
  },
  {
    name: '010_create_moderation_log',
    sql: `
      CREATE TABLE IF NOT EXISTS moderation_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        moderator TEXT NOT NULL,
        reason TEXT,
        previous_status VARCHAR(20),
        new_status VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_moderation_log_report ON moderation_log(report_id);
      CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);
    `
  }
];

async function runPhase2Migrations() {
  console.log('Running Phase 2 database migrations...\n');

  for (const migration of PHASE2_MIGRATIONS) {
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

  console.log('\nPhase 2 migrations complete!');
}

runPhase2Migrations()
  .catch(console.error)
  .finally(() => closePool());
