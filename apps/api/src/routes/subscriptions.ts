import { Router, Request, Response } from 'express';
import {
  createSubscription,
  deleteSubscription,
  getAllSubscriptions
} from '@ice-activity-map/database';

const router = Router();

// POST /api/subscriptions - Create or update push subscription
router.post('/', async (req: Request, res: Response) => {
  try {
    const { endpoint, keys, location, activityTypes } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        error: 'Missing required fields: endpoint, keys.p256dh, keys.auth'
      });
    }

    const subscription = await createSubscription({
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusKm: location?.radiusKm || 50,
      activityTypes: activityTypes || ['raid', 'checkpoint', 'arrest', 'surveillance', 'other']
    });

    res.status(201).json({
      id: subscription.id,
      message: 'Subscription created successfully'
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// DELETE /api/subscriptions - Remove push subscription
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    const deleted = await deleteSubscription(endpoint);

    if (deleted) {
      res.json({ message: 'Subscription removed' });
    } else {
      res.status(404).json({ error: 'Subscription not found' });
    }
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

// GET /api/subscriptions/vapid-public-key - Get VAPID public key for client
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(503).json({
      error: 'Push notifications not configured'
    });
  }

  res.json({ publicKey });
});

// GET /api/subscriptions (admin only)
router.get('/', async (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'];

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const subscriptions = await getAllSubscriptions();
    res.json({ subscriptions, total: subscriptions.length });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

export default router;
