import { query } from '../client.js';
import type { PushSubscription, CreatePushSubscriptionInput } from '../types-phase2.js';

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  activity_types: string[];
  created_at: Date;
  last_notified_at: Date | null;
}

function rowToSubscription(row: SubscriptionRow): PushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusKm: row.radius_km,
    activityTypes: row.activity_types,
    createdAt: row.created_at,
    lastNotifiedAt: row.last_notified_at
  };
}

export async function createSubscription(input: CreatePushSubscriptionInput): Promise<PushSubscription> {
  const result = await query<SubscriptionRow>(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, latitude, longitude, radius_km, activity_types)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (endpoint) DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       radius_km = EXCLUDED.radius_km,
       activity_types = EXCLUDED.activity_types
     RETURNING *`,
    [
      input.endpoint,
      input.p256dh,
      input.auth,
      input.latitude || null,
      input.longitude || null,
      input.radiusKm || 50,
      input.activityTypes || ['raid', 'checkpoint', 'arrest', 'surveillance', 'other']
    ]
  );
  return rowToSubscription(result.rows[0]);
}

export async function deleteSubscription(endpoint: string): Promise<boolean> {
  const result = await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  return (result.rowCount ?? 0) > 0;
}

export async function getSubscriptionsForReport(
  latitude: number,
  longitude: number,
  activityType: string
): Promise<PushSubscription[]> {
  const result = await query<SubscriptionRow>(
    `SELECT * FROM push_subscriptions
     WHERE $3 = ANY(activity_types)
     AND (
       latitude IS NULL
       OR (
         6371 * acos(
           cos(radians($1)) * cos(radians(latitude)) *
           cos(radians(longitude) - radians($2)) +
           sin(radians($1)) * sin(radians(latitude))
         )
       ) <= radius_km
     )`,
    [latitude, longitude, activityType]
  );
  return result.rows.map(rowToSubscription);
}

export async function updateLastNotified(subscriptionIds: string[]): Promise<void> {
  if (subscriptionIds.length === 0) return;
  await query(
    `UPDATE push_subscriptions SET last_notified_at = NOW() WHERE id = ANY($1)`,
    [subscriptionIds]
  );
}

export async function getAllSubscriptions(): Promise<PushSubscription[]> {
  const result = await query<SubscriptionRow>('SELECT * FROM push_subscriptions');
  return result.rows.map(rowToSubscription);
}
