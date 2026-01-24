import { query } from '../client.js';
import type { Report, CreateReportInput, ReportFilters, PaginationOptions } from '../types.js';

interface ReportRow {
  id: string;
  source_type: string;
  source_id: string | null;
  activity_type: string;
  description: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  author_handle: string;
  author_display_name: string | null;
  status: string;
  reported_at: Date;
  created_at: Date;
  updated_at: Date;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    sourceType: row.source_type as Report['sourceType'],
    sourceId: row.source_id,
    activityType: row.activity_type as Report['activityType'],
    description: row.description,
    city: row.city,
    state: row.state,
    latitude: row.latitude,
    longitude: row.longitude,
    authorHandle: row.author_handle,
    authorDisplayName: row.author_display_name,
    status: row.status as Report['status'],
    reportedAt: row.reported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const result = await query<ReportRow>(
    `INSERT INTO reports (
      source_type, source_id, activity_type, description,
      city, state, location, author_handle, author_display_name,
      status, reported_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      CASE WHEN $7::float IS NOT NULL AND $8::float IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography
        ELSE NULL
      END,
      $9, $10, $11, $12
    ) RETURNING
      id, source_type, source_id, activity_type, description,
      city, state,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      author_handle, author_display_name, status, reported_at, created_at, updated_at`,
    [
      input.sourceType,
      input.sourceId || null,
      input.activityType,
      input.description,
      input.city || null,
      input.state || null,
      input.longitude || null,
      input.latitude || null,
      input.authorHandle,
      input.authorDisplayName || null,
      input.status || 'unverified',
      input.reportedAt
    ]
  );
  return rowToReport(result.rows[0]);
}

export async function getReportById(id: string): Promise<Report | null> {
  const result = await query<ReportRow>(
    `SELECT
      id, source_type, source_id, activity_type, description,
      city, state,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      author_handle, author_display_name, status, reported_at, created_at, updated_at
    FROM reports WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? rowToReport(result.rows[0]) : null;
}

export async function getReportBySourceId(sourceType: string, sourceId: string): Promise<Report | null> {
  const result = await query<ReportRow>(
    `SELECT
      id, source_type, source_id, activity_type, description,
      city, state,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      author_handle, author_display_name, status, reported_at, created_at, updated_at
    FROM reports WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );
  return result.rows[0] ? rowToReport(result.rows[0]) : null;
}

export async function getReports(
  filters: ReportFilters = {},
  pagination: PaginationOptions = {}
): Promise<{ reports: Report[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  // Activity type filter
  if (filters.activityTypes && filters.activityTypes.length > 0) {
    conditions.push(`activity_type = ANY($${paramIndex})`);
    params.push(filters.activityTypes);
    paramIndex++;
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    conditions.push(`status = ANY($${paramIndex})`);
    params.push(filters.status);
    paramIndex++;
  }

  // Time range filter
  if (filters.timeRange && filters.timeRange !== 'all') {
    const hours = { '24h': 24, '7d': 168, '30d': 720 }[filters.timeRange];
    conditions.push(`reported_at > NOW() - INTERVAL '${hours} hours'`);
  }

  // Bounding box filter
  if (filters.bounds) {
    conditions.push(`
      location IS NOT NULL AND
      ST_Intersects(
        location,
        ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)::geography
      )
    `);
    params.push(filters.bounds.west, filters.bounds.south, filters.bounds.east, filters.bounds.north);
    paramIndex += 4;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM reports ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get paginated results
  const limit = pagination.limit || 100;
  const offset = pagination.offset || 0;

  const result = await query<ReportRow>(
    `SELECT
      id, source_type, source_id, activity_type, description,
      city, state,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      author_handle, author_display_name, status, reported_at, created_at, updated_at
    FROM reports
    ${whereClause}
    ORDER BY reported_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    reports: result.rows.map(rowToReport),
    total
  };
}

export async function updateReportStatus(id: string, status: Report['status']): Promise<Report | null> {
  const result = await query<ReportRow>(
    `UPDATE reports
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING
      id, source_type, source_id, activity_type, description,
      city, state,
      ST_Y(location::geometry) as latitude,
      ST_X(location::geometry) as longitude,
      author_handle, author_display_name, status, reported_at, created_at, updated_at`,
    [status, id]
  );
  return result.rows[0] ? rowToReport(result.rows[0]) : null;
}

export async function deleteReport(id: string): Promise<boolean> {
  const result = await query('DELETE FROM reports WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
