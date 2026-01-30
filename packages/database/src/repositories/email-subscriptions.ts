import { query } from '../client.js';

export interface EmailSubscription {
  id: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  activityTypes: string[];
  isVerified: boolean;
  verificationToken: string | null;
  unsubscribeToken: string;
  createdAt: Date;
  verifiedAt: Date | null;
  lastNotifiedAt: Date | null;
}

export interface CreateEmailSubscriptionInput {
  email: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  activityTypes?: string[];
}

interface DbEmailSubscription {
  id: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  activity_types: string[];
  is_verified: boolean;
  verification_token: string | null;
  unsubscribe_token: string;
  created_at: Date;
  verified_at: Date | null;
  last_notified_at: Date | null;
}

function mapDbToSubscription(row: DbEmailSubscription): EmailSubscription {
  return {
    id: row.id,
    email: row.email,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusKm: row.radius_km,
    activityTypes: row.activity_types,
    isVerified: row.is_verified,
    verificationToken: row.verification_token,
    unsubscribeToken: row.unsubscribe_token,
    createdAt: row.created_at,
    verifiedAt: row.verified_at,
    lastNotifiedAt: row.last_notified_at
  };
}

export async function createEmailSubscription(
  input: CreateEmailSubscriptionInput
): Promise<EmailSubscription> {
  // Generate a verification token
  const verificationToken = crypto.randomUUID();

  const result = await query<DbEmailSubscription>(
    `INSERT INTO email_subscriptions (
      email, latitude, longitude, radius_km, activity_types, verification_token
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email, latitude, longitude) DO UPDATE SET
      radius_km = EXCLUDED.radius_km,
      activity_types = EXCLUDED.activity_types,
      verification_token = EXCLUDED.verification_token,
      is_verified = FALSE,
      verified_at = NULL
    RETURNING *`,
    [
      input.email,
      input.latitude || null,
      input.longitude || null,
      input.radiusKm || 50,
      input.activityTypes || ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'],
      verificationToken
    ]
  );

  return mapDbToSubscription(result.rows[0]);
}

export async function verifyEmailSubscription(
  token: string
): Promise<EmailSubscription | null> {
  const result = await query<DbEmailSubscription>(
    `UPDATE email_subscriptions
     SET is_verified = TRUE, verified_at = NOW(), verification_token = NULL
     WHERE verification_token = $1
     RETURNING *`,
    [token]
  );

  return result.rows[0] ? mapDbToSubscription(result.rows[0]) : null;
}

export async function unsubscribeEmail(
  token: string
): Promise<boolean> {
  const result = await query(
    `DELETE FROM email_subscriptions WHERE unsubscribe_token = $1`,
    [token]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getEmailSubscriptionsByLocation(
  latitude: number,
  longitude: number,
  activityType: string
): Promise<EmailSubscription[]> {
  // Find all verified subscriptions within their radius of the given location
  const result = await query<DbEmailSubscription>(
    `SELECT *
     FROM email_subscriptions
     WHERE is_verified = TRUE
       AND $3 = ANY(activity_types)
       AND (
         latitude IS NULL
         OR (
           -- Approximate distance calculation using Haversine
           6371 * acos(
             cos(radians($1)) * cos(radians(latitude)) *
             cos(radians(longitude) - radians($2)) +
             sin(radians($1)) * sin(radians(latitude))
           ) <= radius_km
         )
       )`,
    [latitude, longitude, activityType]
  );

  return result.rows.map(mapDbToSubscription);
}

export async function updateEmailLastNotified(id: string): Promise<void> {
  await query(
    `UPDATE email_subscriptions SET last_notified_at = NOW() WHERE id = $1`,
    [id]
  );
}

export async function getEmailSubscriptionByEmail(
  email: string
): Promise<EmailSubscription | null> {
  const result = await query<DbEmailSubscription>(
    `SELECT * FROM email_subscriptions WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [email]
  );

  return result.rows[0] ? mapDbToSubscription(result.rows[0]) : null;
}
