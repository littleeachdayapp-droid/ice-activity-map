import { query, getClient } from '../client.js';
import type { ReportVerification, CreateVerificationInput } from '../types-phase2.js';

interface VerificationRow {
  id: string;
  report_id: string;
  user_identifier: string;
  vote: string;
  comment: string | null;
  created_at: Date;
}

function rowToVerification(row: VerificationRow): ReportVerification {
  return {
    id: row.id,
    reportId: row.report_id,
    userIdentifier: row.user_identifier,
    vote: row.vote as 'confirm' | 'dispute',
    comment: row.comment,
    createdAt: row.created_at
  };
}

export async function createOrUpdateVerification(input: CreateVerificationInput): Promise<ReportVerification> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get existing vote if any
    const existing = await client.query<VerificationRow>(
      `SELECT * FROM report_verifications WHERE report_id = $1 AND user_identifier = $2`,
      [input.reportId, input.userIdentifier]
    );

    const oldVote = existing.rows[0]?.vote;

    // Upsert the verification
    const result = await client.query<VerificationRow>(
      `INSERT INTO report_verifications (report_id, user_identifier, vote, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id, user_identifier) DO UPDATE SET
         vote = EXCLUDED.vote,
         comment = EXCLUDED.comment
       RETURNING *`,
      [input.reportId, input.userIdentifier, input.vote, input.comment || null]
    );

    // Update counts on reports table
    if (oldVote !== input.vote) {
      // Decrement old vote count if existed
      if (oldVote === 'confirm') {
        await client.query(
          `UPDATE reports SET confirm_count = GREATEST(0, confirm_count - 1) WHERE id = $1`,
          [input.reportId]
        );
      } else if (oldVote === 'dispute') {
        await client.query(
          `UPDATE reports SET dispute_count = GREATEST(0, dispute_count - 1) WHERE id = $1`,
          [input.reportId]
        );
      }

      // Increment new vote count
      if (input.vote === 'confirm') {
        await client.query(
          `UPDATE reports SET confirm_count = confirm_count + 1 WHERE id = $1`,
          [input.reportId]
        );
      } else {
        await client.query(
          `UPDATE reports SET dispute_count = dispute_count + 1 WHERE id = $1`,
          [input.reportId]
        );
      }

      // Auto-update status based on thresholds
      await client.query(
        `UPDATE reports SET
           status = CASE
             WHEN confirm_count >= 3 AND dispute_count = 0 THEN 'verified'
             WHEN dispute_count >= 3 THEN 'disputed'
             ELSE status
           END,
           updated_at = NOW()
         WHERE id = $1`,
        [input.reportId]
      );
    }

    await client.query('COMMIT');
    return rowToVerification(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getVerificationsForReport(reportId: string): Promise<ReportVerification[]> {
  const result = await query<VerificationRow>(
    `SELECT * FROM report_verifications WHERE report_id = $1 ORDER BY created_at DESC`,
    [reportId]
  );
  return result.rows.map(rowToVerification);
}

export async function getUserVerification(reportId: string, userIdentifier: string): Promise<ReportVerification | null> {
  const result = await query<VerificationRow>(
    `SELECT * FROM report_verifications WHERE report_id = $1 AND user_identifier = $2`,
    [reportId, userIdentifier]
  );
  return result.rows[0] ? rowToVerification(result.rows[0]) : null;
}

export async function deleteVerification(reportId: string, userIdentifier: string): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const existing = await client.query<VerificationRow>(
      `SELECT * FROM report_verifications WHERE report_id = $1 AND user_identifier = $2`,
      [reportId, userIdentifier]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const oldVote = existing.rows[0].vote;

    await client.query(
      `DELETE FROM report_verifications WHERE report_id = $1 AND user_identifier = $2`,
      [reportId, userIdentifier]
    );

    // Decrement count
    if (oldVote === 'confirm') {
      await client.query(
        `UPDATE reports SET confirm_count = GREATEST(0, confirm_count - 1) WHERE id = $1`,
        [reportId]
      );
    } else {
      await client.query(
        `UPDATE reports SET dispute_count = GREATEST(0, dispute_count - 1) WHERE id = $1`,
        [reportId]
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
