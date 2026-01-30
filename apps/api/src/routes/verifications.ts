import { Router, Request, Response } from 'express';
import {
  createOrUpdateVerification,
  getVerificationsForReport,
  getUserVerification,
  deleteVerification,
  getReportById
} from '@ice-activity-map/database';
import { emitReportVerified } from '../services/websocket.js';
import { readLimiter, verificationLimiter } from '../middleware/rateLimiter.js';
import {
  validateLength,
  validateUserIdentifier,
  sanitizeString,
  validationError
} from '../middleware/validation.js';

const router = Router();

// POST /api/reports/:id/verify - Submit verification vote
router.post('/:reportId/verify', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { vote, comment, userIdentifier } = req.body;

    // Validate userIdentifier
    const userIdResult = validateUserIdentifier(userIdentifier);
    if (!userIdResult.valid) return validationError(res, userIdResult.error!);

    // Validate vote
    if (!vote || !['confirm', 'dispute'].includes(vote)) {
      return validationError(res, 'Invalid vote. Must be "confirm" or "dispute"');
    }

    // Validate optional comment
    const commentResult = validateLength(comment, 'comment');
    if (!commentResult.valid) return validationError(res, commentResult.error!);

    const verification = await createOrUpdateVerification({
      reportId,
      userIdentifier: userIdResult.sanitized!,
      vote,
      comment: commentResult.sanitized ? sanitizeString(commentResult.sanitized) : undefined
    });

    // Emit WebSocket event with updated report
    const report = await getReportById(reportId);
    if (report) {
      emitReportVerified(report);
    }

    res.status(201).json(verification);
  } catch (error) {
    console.error('Error creating verification:', error);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// GET /api/reports/:id/verifications - Get all verifications for a report
router.get('/:reportId/verifications', readLimiter, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const verifications = await getVerificationsForReport(reportId);

    const confirmCount = verifications.filter(v => v.vote === 'confirm').length;
    const disputeCount = verifications.filter(v => v.vote === 'dispute').length;

    res.json({
      verifications,
      summary: {
        total: verifications.length,
        confirmCount,
        disputeCount
      }
    });
  } catch (error) {
    console.error('Error fetching verifications:', error);
    res.status(500).json({ error: 'Failed to fetch verifications' });
  }
});

// GET /api/reports/:id/my-verification - Get user's verification for a report
router.get('/:reportId/my-verification', readLimiter, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const userIdentifier = req.query.userIdentifier as string;

    // Validate userIdentifier
    const userIdResult = validateUserIdentifier(userIdentifier);
    if (!userIdResult.valid) return validationError(res, userIdResult.error!);

    const verification = await getUserVerification(reportId, userIdResult.sanitized!);

    if (verification) {
      res.json(verification);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching user verification:', error);
    res.status(500).json({ error: 'Failed to fetch verification' });
  }
});

// DELETE /api/reports/:id/verify - Remove user's verification
router.delete('/:reportId/verify', verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { userIdentifier } = req.body;

    // Validate userIdentifier
    const userIdResult = validateUserIdentifier(userIdentifier);
    if (!userIdResult.valid) return validationError(res, userIdResult.error!);

    const deleted = await deleteVerification(reportId, userIdResult.sanitized!);

    if (deleted) {
      res.json({ message: 'Verification removed' });
    } else {
      res.status(404).json({ error: 'Verification not found' });
    }
  } catch (error) {
    console.error('Error deleting verification:', error);
    res.status(500).json({ error: 'Failed to delete verification' });
  }
});

export default router;
