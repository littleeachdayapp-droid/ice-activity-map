import { Router } from 'express';
import { query } from '@ice-activity-map/database';

const router = Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get analytics data
 *     description: Retrieve aggregated statistics about ICE activity reports
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Analytics data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stats'
 *       500:
 *         description: Server error
 */
router.get('/', async (_req, res) => {
  try {
    // Total reports count
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM reports WHERE status != 'rejected'`
    );
    const totalReports = parseInt(totalResult.rows[0]?.count || '0', 10);

    // Reports by activity type
    const byTypeResult = await query<{ activity_type: string; count: string }>(
      `SELECT activity_type, COUNT(*) as count
       FROM reports
       WHERE status != 'rejected'
       GROUP BY activity_type
       ORDER BY count DESC`
    );
    const byActivityType = byTypeResult.rows.map(row => ({
      type: row.activity_type,
      count: parseInt(row.count, 10)
    }));

    // Reports by state (top 10)
    const byStateResult = await query<{ state: string; count: string }>(
      `SELECT state, COUNT(*) as count
       FROM reports
       WHERE status != 'rejected' AND state IS NOT NULL
       GROUP BY state
       ORDER BY count DESC
       LIMIT 10`
    );
    const topStates = byStateResult.rows.map(row => ({
      state: row.state,
      count: parseInt(row.count, 10)
    }));

    // Reports over time (last 30 days, grouped by day)
    const timelineResult = await query<{ date: string; count: string }>(
      `SELECT DATE(reported_at) as date, COUNT(*) as count
       FROM reports
       WHERE status != 'rejected'
         AND reported_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(reported_at)
       ORDER BY date ASC`
    );
    const timeline = timelineResult.rows.map(row => ({
      date: row.date,
      count: parseInt(row.count, 10)
    }));

    // Last 7 days count
    const last7DaysResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM reports
       WHERE status != 'rejected'
         AND reported_at >= NOW() - INTERVAL '7 days'`
    );
    const last7Days = parseInt(last7DaysResult.rows[0]?.count || '0', 10);

    // Last 30 days count
    const last30DaysResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM reports
       WHERE status != 'rejected'
         AND reported_at >= NOW() - INTERVAL '30 days'`
    );
    const last30Days = parseInt(last30DaysResult.rows[0]?.count || '0', 10);

    // Recent activity (last 5 reports)
    const recentResult = await query<{
      id: string;
      activity_type: string;
      city: string | null;
      state: string | null;
      reported_at: Date;
    }>(
      `SELECT id, activity_type, city, state, reported_at
       FROM reports
       WHERE status != 'rejected'
       ORDER BY reported_at DESC
       LIMIT 5`
    );
    const recentActivity = recentResult.rows.map(row => ({
      id: row.id,
      activityType: row.activity_type,
      location: [row.city, row.state].filter(Boolean).join(', ') || 'Unknown',
      reportedAt: row.reported_at
    }));

    res.json({
      totalReports,
      last7Days,
      last30Days,
      byActivityType,
      topStates,
      timeline,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
