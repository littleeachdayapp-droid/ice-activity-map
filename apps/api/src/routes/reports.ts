import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  getReports,
  getReportById,
  createReport,
  updateReportStatus,
  type ReportFilters,
  type ActivityType,
  type ReportStatus
} from '@ice-activity-map/database';
import { emitNewReport, emitReportUpdated } from '../services/websocket.js';
import { uploadPhoto } from '../services/storage.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter.js';
import {
  validateLength,
  validateCoordinate,
  validateBounds,
  validatePagination,
  sanitizeString,
  validationError
} from '../middleware/validation.js';
import { requireTurnstile } from '../middleware/turnstile.js';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const router = Router();

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports
 *     description: Retrieve a paginated list of ICE activity reports with optional filters
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: activityTypes
 *         schema:
 *           type: string
 *         description: Comma-separated list of activity types (raid,checkpoint,arrest,surveillance,other)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Comma-separated list of statuses (unverified,verified,disputed)
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, all]
 *         description: Time range filter
 *       - in: query
 *         name: bounds
 *         schema:
 *           type: string
 *         description: Bounding box as "south,west,north,east"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *         description: Maximum number of reports to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of reports to skip
 *     responses:
 *       200:
 *         description: List of reports with pagination info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', readLimiter, async (req: Request, res: Response) => {
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

    // Parse and validate bounding box
    if (req.query.bounds) {
      const [south, west, north, east] = (req.query.bounds as string).split(',').map(Number);
      if (!isNaN(south) && !isNaN(west) && !isNaN(north) && !isNaN(east)) {
        const boundsResult = validateBounds({ south, west, north, east });
        if (!boundsResult.valid) {
          return validationError(res, boundsResult.error!);
        }
        filters.bounds = { south, west, north, east };
      }
    }

    // Parse and validate pagination
    const paginationResult = validatePagination(req.query.limit, req.query.offset);
    if (!paginationResult.valid) {
      return validationError(res, paginationResult.error!);
    }
    const { limit, offset } = paginationResult.sanitized!;

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

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get a report by ID
 *     description: Retrieve a single report by its unique identifier
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     responses:
 *       200:
 *         description: Report details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', readLimiter, async (req: Request, res: Response) => {
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

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Create a new report
 *     description: Submit a new ICE activity report with optional photo
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [activityType, description, authorHandle]
 *             properties:
 *               activityType:
 *                 type: string
 *                 enum: [raid, checkpoint, arrest, surveillance, other]
 *               description:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               authorHandle:
 *                 type: string
 *               authorDisplayName:
 *                 type: string
 *               turnstileToken:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Optional photo (max 10MB, images only)
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReportInput'
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', writeLimiter, upload.single('photo'), requireTurnstile, async (req: Request, res: Response) => {
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

    // Validate activity type
    const validTypes: ActivityType[] = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'];
    if (!activityType || !validTypes.includes(activityType)) {
      return validationError(res, `Invalid activityType. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate description
    const descResult = validateLength(description, 'description');
    if (!descResult.valid) return validationError(res, descResult.error!);
    if (!descResult.sanitized) return validationError(res, 'Description is required');

    // Validate authorHandle
    const handleResult = validateLength(authorHandle, 'authorHandle');
    if (!handleResult.valid) return validationError(res, handleResult.error!);
    if (!handleResult.sanitized) return validationError(res, 'Author handle is required');

    // Validate optional fields
    const displayNameResult = validateLength(authorDisplayName, 'authorDisplayName');
    if (!displayNameResult.valid) return validationError(res, displayNameResult.error!);

    const cityResult = validateLength(city, 'city');
    if (!cityResult.valid) return validationError(res, cityResult.error!);

    const stateResult = validateLength(state, 'state');
    if (!stateResult.valid) return validationError(res, stateResult.error!);

    // Validate coordinates if provided
    const latResult = validateCoordinate(latitude, 'latitude');
    if (!latResult.valid) return validationError(res, latResult.error!);

    const lonResult = validateCoordinate(longitude, 'longitude');
    if (!lonResult.valid) return validationError(res, lonResult.error!);

    // Handle photo upload if provided
    let photoUrl: string | undefined;
    if (req.file) {
      try {
        const uploadedUrl = await uploadPhoto(req.file.buffer, req.file.mimetype);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      } catch (uploadError) {
        console.error('Photo upload failed:', uploadError);
        // Don't fail the entire request if photo upload fails
        // The report will just be created without a photo
      }
    }

    const report = await createReport({
      sourceType: 'user_submitted',
      activityType,
      description: sanitizeString(descResult.sanitized),
      city: cityResult.sanitized ? sanitizeString(cityResult.sanitized) : undefined,
      state: stateResult.sanitized ? sanitizeString(stateResult.sanitized) : undefined,
      latitude: latResult.sanitized,
      longitude: lonResult.sanitized,
      authorHandle: sanitizeString(handleResult.sanitized),
      authorDisplayName: displayNameResult.sanitized ? sanitizeString(displayNameResult.sanitized) : undefined,
      photoUrl,
      reportedAt: new Date()
    });

    // Emit WebSocket event for real-time updates
    emitNewReport(report);

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

/**
 * @swagger
 * /api/reports/{id}/status:
 *   patch:
 *     summary: Update report status
 *     description: Update the verification status of a report
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [unverified, verified, disputed]
 *     responses:
 *       200:
 *         description: Report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Report not found
 */
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

    // Emit WebSocket event for real-time updates
    emitReportUpdated(report);

    res.json(report);
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

export default router;
