import { Router } from 'express';
import {
  createEmailSubscription,
  verifyEmailSubscription,
  unsubscribeEmail,
  getEmailSubscriptionByEmail
} from '@ice-activity-map/database';
import {
  validateEmail,
  validateCoordinate,
  validateActivityTypes,
  validationError
} from '../middleware/validation.js';

const router = Router();

// POST /api/email-subscriptions - Create a new email subscription
router.post('/', async (req, res) => {
  try {
    const { email, latitude, longitude, radiusKm, activityTypes } = req.body;

    // Validate email
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return validationError(res, emailResult.error!);

    // Validate optional coordinates
    const latResult = validateCoordinate(latitude, 'latitude');
    if (!latResult.valid) return validationError(res, latResult.error!);

    const lonResult = validateCoordinate(longitude, 'longitude');
    if (!lonResult.valid) return validationError(res, lonResult.error!);

    const radiusResult = validateCoordinate(radiusKm, 'radiusKm');
    if (!radiusResult.valid) return validationError(res, radiusResult.error!);

    // Validate activity types
    const typesResult = validateActivityTypes(activityTypes);
    if (!typesResult.valid) return validationError(res, typesResult.error!);

    const subscription = await createEmailSubscription({
      email: emailResult.sanitized!,
      latitude: latResult.sanitized,
      longitude: lonResult.sanitized,
      radiusKm: radiusResult.sanitized,
      activityTypes: typesResult.sanitized
    });

    // In a real app, you would send a verification email here
    // For now, we'll just return success and include the verification token for testing
    console.log(`[Email] New subscription for ${email}, verification token: ${subscription.verificationToken}`);

    res.status(201).json({
      success: true,
      message: 'Subscription created. Please check your email to verify.',
      // Include token for development/testing - remove in production
      ...(process.env.NODE_ENV !== 'production' && {
        verificationToken: subscription.verificationToken
      })
    });
  } catch (error) {
    console.error('Error creating email subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// GET /api/email-subscriptions/verify/:token - Verify email subscription
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const subscription = await verifyEmailSubscription(token);

    if (!subscription) {
      return res.status(404).json({ error: 'Invalid or expired verification token' });
    }

    // Redirect to success page or return JSON
    if (req.accepts('html')) {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Verified</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
              .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
              .success { color: #059669; font-size: 3rem; margin-bottom: 1rem; }
              h1 { color: #111827; margin: 0 0 0.5rem; }
              p { color: #6b7280; margin: 0; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="success">✓</div>
              <h1>Email Verified!</h1>
              <p>You will now receive alerts for ICE/CBP activity in your area.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    }
  } catch (error) {
    console.error('Error verifying email subscription:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
});

// GET /api/email-subscriptions/unsubscribe/:token - Unsubscribe
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const success = await unsubscribeEmail(token);

    if (!success) {
      return res.status(404).json({ error: 'Invalid unsubscribe token' });
    }

    // Redirect to success page or return JSON
    if (req.accepts('html')) {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribed</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
              .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
              h1 { color: #111827; margin: 0 0 0.5rem; }
              p { color: #6b7280; margin: 0; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Unsubscribed</h1>
              <p>You have been successfully unsubscribed from ICE Activity Map alerts.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      res.json({
        success: true,
        message: 'Successfully unsubscribed'
      });
    }
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/email-subscriptions/status - Check subscription status
router.get('/status', async (req, res) => {
  try {
    const { email } = req.query;

    // Validate email
    const emailResult = validateEmail(email);
    if (!emailResult.valid) return validationError(res, emailResult.error!);

    const subscription = await getEmailSubscriptionByEmail(emailResult.sanitized!);

    if (!subscription) {
      return res.json({ subscribed: false });
    }

    res.json({
      subscribed: true,
      isVerified: subscription.isVerified,
      radiusKm: subscription.radiusKm,
      activityTypes: subscription.activityTypes
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
