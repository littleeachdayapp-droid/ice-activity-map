import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Input length limits
export const LIMITS = {
  description: { min: 10, max: 5000 },
  comment: { min: 0, max: 2000 },
  details: { min: 0, max: 2000 },
  reason: { min: 0, max: 1000 },
  userIdentifier: { min: 1, max: 255 },
  authorHandle: { min: 1, max: 255 },
  authorDisplayName: { min: 0, max: 255 },
  email: { min: 5, max: 254 },
  city: { min: 1, max: 100 },
  state: { min: 1, max: 100 }
};

// Coordinate bounds
export const COORD_LIMITS = {
  latitude: { min: -90, max: 90 },
  longitude: { min: -180, max: 180 },
  radiusKm: { min: 1, max: 500 }
};

/**
 * Validate string length
 */
export function validateLength(
  value: unknown,
  field: keyof typeof LIMITS
): { valid: boolean; error?: string; sanitized?: string } {
  if (value === undefined || value === null) {
    return { valid: true, sanitized: undefined };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${field} must be a string` };
  }

  const trimmed = value.trim();
  const limits = LIMITS[field];

  if (trimmed.length < limits.min) {
    return { valid: false, error: `${field} must be at least ${limits.min} characters` };
  }

  if (trimmed.length > limits.max) {
    return { valid: false, error: `${field} must be at most ${limits.max} characters` };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate coordinate value
 */
export function validateCoordinate(
  value: unknown,
  field: 'latitude' | 'longitude' | 'radiusKm'
): { valid: boolean; error?: string; sanitized?: number } {
  if (value === undefined || value === null) {
    return { valid: true, sanitized: undefined };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    return { valid: false, error: `${field} must be a number` };
  }

  const limits = COORD_LIMITS[field];

  if (num < limits.min || num > limits.max) {
    return { valid: false, error: `${field} must be between ${limits.min} and ${limits.max}` };
  }

  return { valid: true, sanitized: num };
}

/**
 * Validate bounding box
 */
export function validateBounds(bounds: {
  south: number;
  west: number;
  north: number;
  east: number;
}): { valid: boolean; error?: string } {
  const southResult = validateCoordinate(bounds.south, 'latitude');
  if (!southResult.valid) return { valid: false, error: `south: ${southResult.error}` };

  const northResult = validateCoordinate(bounds.north, 'latitude');
  if (!northResult.valid) return { valid: false, error: `north: ${northResult.error}` };

  const westResult = validateCoordinate(bounds.west, 'longitude');
  if (!westResult.valid) return { valid: false, error: `west: ${westResult.error}` };

  const eastResult = validateCoordinate(bounds.east, 'longitude');
  if (!eastResult.valid) return { valid: false, error: `east: ${eastResult.error}` };

  if (bounds.south >= bounds.north) {
    return { valid: false, error: 'south must be less than north' };
  }

  return { valid: true };
}

/**
 * Validate user identifier format (alphanumeric, underscore, hyphen)
 */
export function validateUserIdentifier(value: unknown): { valid: boolean; error?: string; sanitized?: string } {
  const lengthResult = validateLength(value, 'userIdentifier');
  if (!lengthResult.valid) return lengthResult;

  if (!lengthResult.sanitized) {
    return { valid: false, error: 'userIdentifier is required' };
  }

  // Allow alphanumeric, underscore, hyphen
  const pattern = /^[a-zA-Z0-9_-]+$/;
  if (!pattern.test(lengthResult.sanitized)) {
    return { valid: false, error: 'userIdentifier must contain only letters, numbers, underscores, and hyphens' };
  }

  return { valid: true, sanitized: lengthResult.sanitized };
}

/**
 * Validate email format (RFC 5322 simplified)
 */
export function validateEmail(value: unknown): { valid: boolean; error?: string; sanitized?: string } {
  const lengthResult = validateLength(value, 'email');
  if (!lengthResult.valid) return lengthResult;

  if (!lengthResult.sanitized) {
    return { valid: false, error: 'email is required' };
  }

  // More robust email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(lengthResult.sanitized)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, sanitized: lengthResult.sanitized.toLowerCase() };
}

/**
 * Validate activity types array
 */
export function validateActivityTypes(value: unknown): { valid: boolean; error?: string; sanitized?: string[] } {
  const validTypes = ['raid', 'checkpoint', 'arrest', 'surveillance', 'other'];

  if (!value) {
    return { valid: true, sanitized: validTypes }; // Default to all
  }

  if (!Array.isArray(value)) {
    return { valid: false, error: 'activityTypes must be an array' };
  }

  if (value.length === 0 || value.length > validTypes.length) {
    return { valid: false, error: `activityTypes must have 1-${validTypes.length} items` };
  }

  const sanitized: string[] = [];
  for (const type of value) {
    if (typeof type !== 'string' || !validTypes.includes(type)) {
      return { valid: false, error: `Invalid activity type: ${type}. Must be one of: ${validTypes.join(', ')}` };
    }
    sanitized.push(type);
  }

  return { valid: true, sanitized };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  limit: unknown,
  offset: unknown,
  maxLimit = 500
): { valid: boolean; error?: string; sanitized?: { limit: number; offset: number } } {
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (limit as number);
  const parsedOffset = typeof offset === 'string' ? parseInt(offset, 10) : (offset as number);

  const finalLimit = isNaN(parsedLimit) ? 100 : parsedLimit;
  const finalOffset = isNaN(parsedOffset) ? 0 : parsedOffset;

  if (finalLimit < 1 || finalLimit > maxLimit) {
    return { valid: false, error: `limit must be between 1 and ${maxLimit}` };
  }

  if (finalOffset < 0) {
    return { valid: false, error: 'offset must be non-negative' };
  }

  return { valid: true, sanitized: { limit: finalLimit, offset: finalOffset } };
}

/**
 * Timing-safe string comparison for admin keys
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Still do comparison to maintain constant time
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sanitize string for safe storage (trim, remove null bytes)
 */
export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters except newline/tab
}

/**
 * Validation error response helper
 */
export function validationError(res: Response, error: string) {
  return res.status(400).json({ error });
}
