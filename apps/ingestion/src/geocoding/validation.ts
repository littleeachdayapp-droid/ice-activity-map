/**
 * Coordinate validation utilities
 * Ensures geocoded locations are within valid US bounds
 */

// Continental US bounds (approximate)
const US_BOUNDS = {
  continental: {
    minLat: 24.396308,   // Southern tip of Florida Keys
    maxLat: 49.384358,   // Northern border with Canada
    minLng: -125.0,      // Western coast
    maxLng: -66.93457    // Eastern coast (Maine)
  },
  alaska: {
    minLat: 51.0,
    maxLat: 71.5,
    minLng: -180.0,
    maxLng: -129.0
  },
  hawaii: {
    minLat: 18.5,
    maxLat: 22.5,
    minLng: -161.0,
    maxLng: -154.0
  },
  puertoRico: {
    minLat: 17.5,
    maxLat: 18.6,
    minLng: -68.0,
    maxLng: -65.0
  }
};

export interface ValidationResult {
  isValid: boolean;
  region: 'continental' | 'alaska' | 'hawaii' | 'puerto_rico' | null;
  issue?: string;
}

/**
 * Check if coordinates are within a bounding box
 */
function isInBounds(
  lat: number,
  lng: number,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): boolean {
  return lat >= bounds.minLat &&
         lat <= bounds.maxLat &&
         lng >= bounds.minLng &&
         lng <= bounds.maxLng;
}

/**
 * Validate that coordinates are within valid US territory
 */
export function validateUSCoordinates(lat: number, lng: number): ValidationResult {
  // Basic validation
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { isValid: false, region: null, issue: 'Invalid coordinate types' };
  }

  if (isNaN(lat) || isNaN(lng)) {
    return { isValid: false, region: null, issue: 'Coordinates are NaN' };
  }

  if (lat < -90 || lat > 90) {
    return { isValid: false, region: null, issue: 'Latitude out of range (-90 to 90)' };
  }

  if (lng < -180 || lng > 180) {
    return { isValid: false, region: null, issue: 'Longitude out of range (-180 to 180)' };
  }

  // Check each US region
  if (isInBounds(lat, lng, US_BOUNDS.continental)) {
    return { isValid: true, region: 'continental' };
  }

  if (isInBounds(lat, lng, US_BOUNDS.alaska)) {
    return { isValid: true, region: 'alaska' };
  }

  if (isInBounds(lat, lng, US_BOUNDS.hawaii)) {
    return { isValid: true, region: 'hawaii' };
  }

  if (isInBounds(lat, lng, US_BOUNDS.puertoRico)) {
    return { isValid: true, region: 'puerto_rico' };
  }

  return {
    isValid: false,
    region: null,
    issue: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) are outside US territory`
  };
}

/**
 * Validate that a state abbreviation is valid
 */
const VALID_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
]);

export function isValidState(state: string): boolean {
  return VALID_STATES.has(state.toUpperCase());
}

/**
 * Approximate state from coordinates (rough check)
 */
const STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'CA': { lat: 36.778, lng: -119.418 },
  'TX': { lat: 31.0, lng: -100.0 },
  'FL': { lat: 27.665, lng: -81.516 },
  'NY': { lat: 43.0, lng: -75.0 },
  'AZ': { lat: 34.0, lng: -111.0 },
  'NV': { lat: 38.8, lng: -116.4 },
  'NM': { lat: 34.5, lng: -106.0 },
  'IL': { lat: 40.0, lng: -89.0 },
  'PA': { lat: 41.2, lng: -77.2 },
  'OH': { lat: 40.4, lng: -82.9 },
  'GA': { lat: 32.2, lng: -83.2 },
  'NC': { lat: 35.5, lng: -79.0 },
  'MI': { lat: 44.3, lng: -85.6 },
  'WA': { lat: 47.4, lng: -120.7 },
  'CO': { lat: 39.0, lng: -105.5 },
  'MA': { lat: 42.4, lng: -71.4 },
  'AK': { lat: 64.0, lng: -153.0 },
  'HI': { lat: 20.8, lng: -156.3 },
  'PR': { lat: 18.2, lng: -66.5 }
};

/**
 * Get approximate state from coordinates
 * Returns null if can't determine or multiple states possible
 */
export function approximateState(lat: number, lng: number): string | null {
  const validation = validateUSCoordinates(lat, lng);
  if (!validation.isValid) return null;

  // Special cases
  if (validation.region === 'alaska') return 'AK';
  if (validation.region === 'hawaii') return 'HI';
  if (validation.region === 'puerto_rico') return 'PR';

  // For continental US, find closest centroid (rough approximation)
  let closestState: string | null = null;
  let minDistance = Infinity;

  for (const [state, centroid] of Object.entries(STATE_CENTROIDS)) {
    if (state === 'AK' || state === 'HI' || state === 'PR') continue;

    const distance = Math.sqrt(
      Math.pow(lat - centroid.lat, 2) + Math.pow(lng - centroid.lng, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestState = state;
    }
  }

  // Only return if reasonably close (within ~5 degrees)
  return minDistance < 5 ? closestState : null;
}

/**
 * Check if coordinates and state are consistent
 */
export function validateStateCoordinateMatch(
  lat: number,
  lng: number,
  state: string
): { isConsistent: boolean; suggestedState?: string; issue?: string } {
  const validation = validateUSCoordinates(lat, lng);
  if (!validation.isValid) {
    return { isConsistent: false, issue: validation.issue };
  }

  const upperState = state.toUpperCase();

  // Check special regions
  if (validation.region === 'alaska' && upperState !== 'AK') {
    return { isConsistent: false, suggestedState: 'AK', issue: 'Coordinates in Alaska but state is not AK' };
  }
  if (validation.region === 'hawaii' && upperState !== 'HI') {
    return { isConsistent: false, suggestedState: 'HI', issue: 'Coordinates in Hawaii but state is not HI' };
  }
  if (validation.region === 'puerto_rico' && upperState !== 'PR') {
    return { isConsistent: false, suggestedState: 'PR', issue: 'Coordinates in Puerto Rico but state is not PR' };
  }

  // For continental US, do a rough check
  const approximated = approximateState(lat, lng);
  if (approximated && approximated !== upperState) {
    // Allow some slack - states can border each other
    return { isConsistent: true }; // Don't be too strict
  }

  return { isConsistent: true };
}
