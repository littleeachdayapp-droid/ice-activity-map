import { Router, Request, Response } from 'express';
import {
  getReports,
  getReportById,
  createReport,
  updateReportStatus,
  type ReportFilters,
  type ActivityType,
  type ReportStatus
} from '@ice-activity-map/database';

const router = Router();

// GET /api/reports
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: ReportFilters = {};

    // Parse activity types
    if (req.query.activityTypes) {
      const types = (req.query.activityTypes as string).split(',');
      filters.activityTypes = types as ActivityType[];
    }

    // Parse status
    if (req.query.status) {
      const statuses = (req.query.status as string).split(',');
      filters.status = statuses as ReportStatus[];
    }

    // Parse time range
    if (req.query.timeRange) {
      const timeRange = req.query.timeRange as string;
      if (['24h', '7d', '30d', 'all'].includes(timeRange)) {
        filters.timeRange = timeRange as ReportFilters['timeRange'];
      }
    }

    // Parse bounding box
    if (req.query.bounds) {
      const [south, west, north, east] = (req.query.bounds as string).split(',').map(Number);
      if (!isNaN(south) && !isNaN(west) && !isNaN(north) && !isNaN(east)) {
        filters.bounds = { south, west, north, east };
      }
    }

    // Parse pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const { reports, total } = await getReports(filters, { limit, offset });

    res.json({
      reports,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + reports.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /api/reports/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const report = await getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /api/reports
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      activityType,
      description,
      city,
      state,
      latitude,
      longitude,
      authorHandle,
      authorDisplayName
    } = req.body;

    // Validation
    if (!activityType || !description || !authorHandle) {
      return res.status(400).json({
        error: 'Missing required fields: activityType, description, authorHandle'
      });
    }

    const validTypes: ActivityType[] = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'];
    if (!validTypes.includes(activityType)) {
      return res.status(400).json({
        error: `Invalid activityType. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const report = await createReport({
      sourceType: 'user_submitted',
      activityType,
      description,
      city,
      state,
      latitude,
      longitude,
      authorHandle,
      authorDisplayName,
      reportedAt: new Date()
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// PATCH /api/reports/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    const validStatuses: ReportStatus[] = ['unverified', 'verified', 'disputed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const report = await updateReportStatus(req.params.id, status);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

export default router;
