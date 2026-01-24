import { Router, Request, Response, NextFunction } from 'express';
import {
  createFlag,
  getFlagsForReport,
  getPendingFlags,
  updateFlagStatus,
  getModerationLog,
  moderateReport,
  deleteReportAsModerator,
  type FlagReason,
  type FlagStatus
} from '@ice-activity-map/database';

const router = Router();

// Middleware to check admin authentication
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}

// ============ Public Routes ============

// POST /api/reports/:id/flag - Flag a report
router.post('/:reportId/flag', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { reason, details, userIdentifier } = req.body;

    if (!userIdentifier) {
      return res.status(400).json({ error: 'Missing userIdentifier' });
    }

    const validReasons: FlagReason[] = ['spam', 'misinformation', 'duplicate', 'inappropriate', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        error: `Invalid reason. Must be one of: ${validReasons.join(', ')}`
      });
    }

    const flag = await createFlag({
      reportId,
      userIdentifier,
      reason,
      details
    });

    res.status(201).json({
      id: flag.id,
      message: 'Report flagged successfully'
    });
  } catch (error) {
    console.error('Error creating flag:', error);
    res.status(500).json({ error: 'Failed to flag report' });
  }
});

// GET /api/reports/:id/flags - Get flags for a report (public summary)
router.get('/:reportId/flags', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const flags = await getFlagsForReport(reportId);

    // Return summary without user identifiers for privacy
    const summary = {
      total: flags.length,
      byReason: flags.reduce((acc, flag) => {
        acc[flag.reason] = (acc[flag.reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pendingCount: flags.filter(f => f.status === 'pending').length
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching flags:', error);
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
});

// ============ Admin Routes ============

// GET /api/moderation/queue - Get pending flags queue
router.get('/queue', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { flags, total } = await getPendingFlags(limit, offset);

    res.json({
      flags,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + flags.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching moderation queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// PATCH /api/moderation/flags/:id - Update flag status
router.patch('/flags/:flagId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const { status, moderator } = req.body;

    const validStatuses: FlagStatus[] = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (!moderator) {
      return res.status(400).json({ error: 'Missing moderator identifier' });
    }

    const flag = await updateFlagStatus(flagId, status, moderator);

    if (!flag) {
      return res.status(404).json({ error: 'Flag not found' });
    }

    res.json(flag);
  } catch (error) {
    console.error('Error updating flag:', error);
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

// POST /api/moderation/reports/:id/status - Moderate report status
router.post('/reports/:reportId/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, moderator, reason } = req.body;

    const validStatuses = ['verified', 'disputed', 'unverified'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (!moderator) {
      return res.status(400).json({ error: 'Missing moderator identifier' });
    }

    await moderateReport(reportId, status, moderator, reason);

    res.json({ message: 'Report status updated', status });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Report not found') {
      return res.status(404).json({ error: 'Report not found' });
    }
    console.error('Error moderating report:', error);
    res.status(500).json({ error: 'Failed to moderate report' });
  }
});

// DELETE /api/moderation/reports/:id - Delete report as moderator
router.delete('/reports/:reportId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { moderator, reason, hardDelete } = req.body;

    if (!moderator) {
      return res.status(400).json({ error: 'Missing moderator identifier' });
    }

    const deleted = await deleteReportAsModerator(
      reportId,
      moderator,
      reason,
      hardDelete === true
    );

    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      message: hardDelete ? 'Report permanently deleted' : 'Report soft deleted',
      reportId
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// GET /api/moderation/log - Get moderation log
router.get('/log', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const log = await getModerationLog(limit, offset);

    res.json({ log });
  } catch (error) {
    console.error('Error fetching moderation log:', error);
    res.status(500).json({ error: 'Failed to fetch log' });
  }
});

export default router;
