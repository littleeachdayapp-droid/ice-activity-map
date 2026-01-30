import { Request, Response, NextFunction } from 'express';

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA'; // Test key
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
}

/**
 * Verify a Turnstile token with Cloudflare
 */
async function verifyTurnstileToken(token: string, remoteip?: string): Promise<boolean> {
  try {
    const formData = new URLSearchParams();
    formData.append('secret', TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (remoteip) {
      formData.append('remoteip', remoteip);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error('Turnstile verification request failed:', response.status);
      return false;
    }

    const result = await response.json() as TurnstileVerifyResponse;

    if (!result.success) {
      console.warn('Turnstile verification failed:', result['error-codes']);
    }

    return result.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

/**
 * Get client IP from request
 */
function getClientIP(req: Request): string | undefined {
  // Check various headers for proxied requests
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  return req.socket.remoteAddress;
}

/**
 * Middleware to verify Turnstile CAPTCHA token
 * Expects token in request body as 'turnstileToken' or 'captchaToken'
 */
export function requireTurnstile(req: Request, res: Response, next: NextFunction) {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip if Turnstile is not configured (development without key)
  if (!process.env.TURNSTILE_SECRET_KEY) {
    console.warn('Turnstile verification skipped: TURNSTILE_SECRET_KEY not set');
    return next();
  }

  const token = req.body.turnstileToken || req.body.captchaToken;

  if (!token) {
    return res.status(400).json({
      error: 'Security verification required. Please complete the CAPTCHA.'
    });
  }

  const clientIP = getClientIP(req);

  verifyTurnstileToken(token, clientIP)
    .then(isValid => {
      if (isValid) {
        // Remove token from body before passing to next handler
        delete req.body.turnstileToken;
        delete req.body.captchaToken;
        next();
      } else {
        res.status(403).json({
          error: 'Security verification failed. Please try again.'
        });
      }
    })
    .catch(error => {
      console.error('Turnstile middleware error:', error);
      res.status(500).json({
        error: 'Security verification error. Please try again.'
      });
    });
}

/**
 * Optional Turnstile verification - doesn't block if token missing
 * Useful for endpoints that want to verify but not require CAPTCHA
 */
export function optionalTurnstile(req: Request, res: Response, next: NextFunction) {
  const token = req.body.turnstileToken || req.body.captchaToken;

  if (!token) {
    return next();
  }

  // Skip in test environment
  if (process.env.NODE_ENV === 'test') {
    delete req.body.turnstileToken;
    delete req.body.captchaToken;
    return next();
  }

  const clientIP = getClientIP(req);

  verifyTurnstileToken(token, clientIP)
    .then(isValid => {
      // Remove token from body
      delete req.body.turnstileToken;
      delete req.body.captchaToken;

      if (!isValid) {
        // Log but don't block
        console.warn('Optional Turnstile verification failed for IP:', clientIP);
      }

      next();
    })
    .catch(error => {
      console.error('Optional Turnstile middleware error:', error);
      next(); // Continue even on error
    });
}
