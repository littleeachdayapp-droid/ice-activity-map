import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Base options shared by all limiters
const baseOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false
};

// Disabled limiter for test environment
const noopLimiter = rateLimit({
  ...baseOptions,
  windowMs: 1000,
  max: 999999
});

/**
 * General read operations (GET requests)
 * Higher limit since these are less resource-intensive
 * 200 requests per 15 minutes in production, 2000 in dev
 */
export const readLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 200 : 2000,
  message: { error: 'Too many read requests, please try again later' }
});

/**
 * Write operations (POST new reports)
 * Lower limit to prevent spam
 * 10 reports per 15 minutes in production, 100 in dev
 */
export const writeLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 100,
  message: { error: 'Too many report submissions, please try again later' }
});

/**
 * Verification actions (confirm/dispute/flag)
 * Moderate limit since these affect report status
 * 30 actions per 15 minutes in production, 300 in dev
 */
export const verificationLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 30 : 300,
  message: { error: 'Too many verification actions, please try again later' }
});

/**
 * Subscription operations (push notifications, email alerts)
 * Lower limit to prevent abuse
 * 5 subscriptions per 15 minutes in production, 50 in dev
 */
export const subscriptionLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 50,
  message: { error: 'Too many subscription requests, please try again later' }
});

/**
 * Admin operations (moderation)
 * Higher limit for authenticated admins
 * 100 actions per 15 minutes in production, 1000 in dev
 */
export const adminLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: { error: 'Too many admin requests, please try again later' }
});

/**
 * Stats endpoint
 * Moderate limit since it's a heavier query
 * 60 requests per 15 minutes in production, 600 in dev
 */
export const statsLimiter = isTest ? noopLimiter : rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 60 : 600,
  message: { error: 'Too many stats requests, please try again later' }
});
