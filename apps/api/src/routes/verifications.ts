import { Router, Request, Response } from 'express';
import {
  createOrUpdateVerification,
  getVerificationsForReport,
  getUserVerification,
  deleteVerification
} from '@ice-activity-map/database';

const router = Router();

// POST /api/reports/:id/verify - Submit verification vote
router.post('/:reportId/verify', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { vote, comment, userIdentifier } = req.body;

    if (!userIdentifier) {
      return res.status(400).json({ error: 'Missing userIdentifier' });
    }

    if (!vote || !['confirm', 'dispute'].includes(vote)) {
      return res.status(400).json({
        error: 'Invalid vote. Must be "confirm" or "dispute"'
      });
    }

    const verification = await createOrUpdateVerification({
      reportId,
      userIdentifier,
      vote,
      comment
    });

    res.status(201).json(verification);
  } catch (error) {
    console.error('Error creating verification:', error);
    res.status(500).json({ error: 'Failed to submit verification' });
  }
});

// GET /api/reports/:id/verifications - Get all verifications for a report
router.get('/:reportId/verifications', async (req: Request, res: Response) => {
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
router.get('/:reportId/my-verification', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const userIdentifier = req.query.userIdentifier as string;

    if (!userIdentifier) {
      return res.status(400).json({ error: 'Missing userIdentifier query param' });
    }

    const verification = await getUserVerification(reportId, userIdentifier);

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
router.delete('/:reportId/verify', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { userIdentifier } = req.body;

    if (!userIdentifier) {
      return res.status(400).json({ error: 'Missing userIdentifier' });
    }

    const deleted = await deleteVerification(reportId, userIdentifier);

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
