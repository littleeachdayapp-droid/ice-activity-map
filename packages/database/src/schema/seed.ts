import { query, closePool } from '../client.js';
import type { CreateReportInput } from '../types.js';

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

const SEED_REPORTS: CreateReportInput[] = [
  {
    sourceType: 'bluesky',
    sourceId: 'seed-1',
    activityType: 'raid',
    description: 'ICE agents seen at apartment complex on Main Street. Multiple vehicles present. Residents advised to know their rights.',
    city: 'Los Angeles',
    state: 'CA',
    latitude: 34.0522,
    longitude: -118.2437,
    authorHandle: 'communitywatch.la',
    authorDisplayName: 'Community Watch LA',
    status: 'verified',
    reportedAt: hoursAgo(2)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-2',
    activityType: 'checkpoint',
    description: 'Immigration checkpoint reported on I-5 near San Ysidro. All vehicles being stopped and checked.',
    city: 'San Diego',
    state: 'CA',
    latitude: 32.7157,
    longitude: -117.1611,
    authorHandle: 'borderwatch.sd',
    authorDisplayName: 'Border Watch',
    status: 'verified',
    reportedAt: hoursAgo(6)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-3',
    activityType: 'arrest',
    description: 'Reports of arrest outside courthouse. Individual was taken into custody after appearing for unrelated hearing.',
    city: 'Houston',
    state: 'TX',
    latitude: 29.7604,
    longitude: -95.3698,
    authorHandle: 'houstonrights.org',
    authorDisplayName: 'Houston Immigrant Rights',
    status: 'unverified',
    reportedAt: hoursAgo(12)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-4',
    activityType: 'surveillance',
    description: 'Unmarked vehicles observed near day labor site for several hours. No direct contact made with workers.',
    city: 'Atlanta',
    state: 'GA',
    latitude: 33.749,
    longitude: -84.388,
    authorHandle: 'atlworkers.coalition',
    authorDisplayName: 'Atlanta Workers Coalition',
    status: 'unverified',
    reportedAt: hoursAgo(24)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-5',
    activityType: 'raid',
    description: 'Workplace enforcement action at meatpacking facility. Multiple workers detained. Legal observers on scene.',
    city: 'Chicago',
    state: 'IL',
    latitude: 41.8781,
    longitude: -87.6298,
    authorHandle: 'chicagolegalaid.org',
    authorDisplayName: 'Chicago Legal Aid',
    status: 'verified',
    reportedAt: hoursAgo(48)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-6',
    activityType: 'checkpoint',
    description: 'Mobile checkpoint set up on Highway 54. Agents checking documents of all passengers.',
    city: 'El Paso',
    state: 'TX',
    latitude: 31.7619,
    longitude: -106.485,
    authorHandle: 'elpaso.network',
    authorDisplayName: 'El Paso Network',
    status: 'verified',
    reportedAt: hoursAgo(72)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-7',
    activityType: 'other',
    description: 'ICE officers seen in plainclothes near transit hub. Appeared to be monitoring the area but no enforcement action observed.',
    city: 'New York',
    state: 'NY',
    latitude: 40.7128,
    longitude: -74.006,
    authorHandle: 'nyc.rapidresponse',
    authorDisplayName: 'NYC Rapid Response',
    status: 'disputed',
    reportedAt: hoursAgo(120)
  },
  {
    sourceType: 'bluesky',
    sourceId: 'seed-8',
    activityType: 'arrest',
    description: 'Individual detained during traffic stop. Passenger in vehicle was taken into ICE custody.',
    city: 'Phoenix',
    state: 'AZ',
    latitude: 33.4484,
    longitude: -112.074,
    authorHandle: 'azadvocates.org',
    authorDisplayName: 'AZ Immigrant Advocates',
    status: 'verified',
    reportedAt: hoursAgo(168)
  }
];

async function seed() {
  console.log('Seeding database with sample reports...\n');

  for (const report of SEED_REPORTS) {
    try {
      await query(
        `INSERT INTO reports (
          source_type, source_id, activity_type, description,
          city, state, location, author_handle, author_display_name,
          status, reported_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography,
          $9, $10, $11, $12
        ) ON CONFLICT (source_type, source_id) DO NOTHING`,
        [
          report.sourceType,
          report.sourceId,
          report.activityType,
          report.description,
          report.city,
          report.state,
          report.longitude,
          report.latitude,
          report.authorHandle,
          report.authorDisplayName,
          report.status || 'unverified',
          report.reportedAt
        ]
      );
      console.log(`  ✓ Added: ${report.activityType} in ${report.city}, ${report.state}`);
    } catch (error) {
      console.error(`  ✗ Failed to add ${report.city}:`, error);
    }
  }

  console.log('\nSeeding complete!');
}

seed()
  .catch(console.error)
  .finally(() => closePool());
