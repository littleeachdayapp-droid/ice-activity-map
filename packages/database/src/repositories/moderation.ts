import { query, getClient } from '../client.js';
import type { ReportFlag, CreateFlagInput, FlagStatus, ModerationAction } from '../types-phase2.js';

interface FlagRow {
  id: string;
  report_id: string;
  user_identifier: string;
  reason: string;
  details: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}

interface ModerationLogRow {
  id: string;
  report_id: string | null;
  action: string;
  moderator: string;
  reason: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: Date;
}

function rowToFlag(row: FlagRow): ReportFlag {
  return {
    id: row.id,
    reportId: row.report_id,
    userIdentifier: row.user_identifier,
    reason: row.reason as ReportFlag['reason'],
    details: row.details,
    status: row.status as FlagStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at
  };
}

function rowToModerationAction(row: ModerationLogRow): ModerationAction {
  return {
    id: row.id,
    reportId: row.report_id,
    action: row.action,
    moderator: row.moderator,
    reason: row.reason,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    createdAt: row.created_at
  };
}

// Flag operations
export async function createFlag(input: CreateFlagInput): Promise<ReportFlag> {
  const result = await query<FlagRow>(
    `INSERT INTO report_flags (report_id, user_identifier, reason, details)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (report_id, user_identifier) DO UPDATE SET
       reason = EXCLUDED.reason,
       details = EXCLUDED.details,
       status = 'pending'
     RETURNING *`,
    [input.reportId, input.userIdentifier, input.reason, input.details || null]
  );
  return rowToFlag(result.rows[0]);
}

export async function getFlagsForReport(reportId: string): Promise<ReportFlag[]> {
  const result = await query<FlagRow>(
    `SELECT * FROM report_flags WHERE report_id = $1 ORDER BY created_at DESC`,
    [reportId]
  );
  return result.rows.map(rowToFlag);
}

export async function getPendingFlags(limit = 50, offset = 0): Promise<{ flags: ReportFlag[]; total: number }> {
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM report_flags WHERE status = 'pending'`
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<FlagRow>(
    `SELECT * FROM report_flags WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { flags: result.rows.map(rowToFlag), total };
}

export async function updateFlagStatus(
  flagId: string,
  status: FlagStatus,
  moderator: string
): Promise<ReportFlag | null> {
  const result = await query<FlagRow>(
    `UPDATE report_flags
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, moderator, flagId]
  );
  return result.rows[0] ? rowToFlag(result.rows[0]) : null;
}

// Moderation actions
export async function logModerationAction(
  action: string,
  moderator: string,
  reportId?: string,
  reason?: string,
  previousStatus?: string,
  newStatus?: string
): Promise<ModerationAction> {
  const result = await query<ModerationLogRow>(
    `INSERT INTO moderation_log (report_id, action, moderator, reason, previous_status, new_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [reportId || null, action, moderator, reason || null, previousStatus || null, newStatus || null]
  );
  return rowToModerationAction(result.rows[0]);
}

export async function getModerationLog(limit = 100, offset = 0): Promise<ModerationAction[]> {
  const result = await query<ModerationLogRow>(
    `SELECT * FROM moderation_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows.map(rowToModerationAction);
}

// Combined moderation action: update report status and log
export async function moderateReport(
  reportId: string,
  newStatus: 'verified' | 'disputed' | 'unverified',
  moderator: string,
  reason?: string
): Promise<void> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get current status
    const current = await client.query<{ status: string }>(
      `SELECT status FROM reports WHERE id = $1`,
      [reportId]
    );

    if (current.rows.length === 0) {
      throw new Error('Report not found');
    }

    const previousStatus = current.rows[0].status;

    // Update report
    await client.query(
      `UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, reportId]
    );

    // Log the action
    await client.query(
      `INSERT INTO moderation_log (report_id, action, moderator, reason, previous_status, new_status)
       VALUES ($1, 'status_change', $2, $3, $4, $5)`,
      [reportId, moderator, reason || null, previousStatus, newStatus]
    );

    // Resolve any pending flags
    await client.query(
      `UPDATE report_flags SET status = 'resolved', reviewed_by = $1, reviewed_at = NOW()
       WHERE report_id = $2 AND status = 'pending'`,
      [moderator, reportId]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Delete report (soft delete by marking as removed, or hard delete)
export async function deleteReportAsModerator(
  reportId: string,
  moderator: string,
  reason?: string,
  hardDelete = false
): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    if (hardDelete) {
      const result = await client.query(
        `DELETE FROM reports WHERE id = $1`,
        [reportId]
      );

      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `INSERT INTO moderation_log (report_id, action, moderator, reason)
         VALUES ($1, 'hard_delete', $2, $3)`,
        [reportId, moderator, reason || null]
      );
    } else {
      // Soft delete by changing status
      const result = await client.query(
        `UPDATE reports SET status = 'disputed', updated_at = NOW() WHERE id = $1`,
        [reportId]
      );

      if ((result.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query(
        `INSERT INTO moderation_log (report_id, action, moderator, reason, new_status)
         VALUES ($1, 'soft_delete', $2, $3, 'disputed')`,
        [reportId, moderator, reason || null]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
