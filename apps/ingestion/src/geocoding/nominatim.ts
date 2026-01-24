import { query } from '@ice-activity-map/database';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  displayName: string;
}

interface GeocodeCache {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
}

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100; // Slightly over 1 second to be safe

const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'ICEActivityMap/1.0';

/**
 * Check cache for existing geocoding result
 */
async function checkCache(queryStr: string): Promise<GeocodeCache | null> {
  try {
    const result = await query<GeocodeCache>(
      'SELECT latitude, longitude, city, state FROM geocode_cache WHERE query = $1',
      [queryStr.toLowerCase()]
    );
    return result.rows[0] || null;
  } catch {
    // Cache miss or DB error, proceed with geocoding
    return null;
  }
}

/**
 * Save geocoding result to cache
 */
async function saveToCache(queryStr: string, result: GeocodingResult | null): Promise<void> {
  try {
    await query(
      `INSERT INTO geocode_cache (query, latitude, longitude, city, state)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (query) DO UPDATE SET
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         city = EXCLUDED.city,
         state = EXCLUDED.state`,
      [
        queryStr.toLowerCase(),
        result?.latitude || null,
        result?.longitude || null,
        result?.city || null,
        result?.state || null
      ]
    );
  } catch (error) {
    console.warn('[Geocoding] Failed to save to cache:', error);
  }
}

/**
 * Wait for rate limit
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Geocode a location string using Nominatim
 */
export async function geocode(location: string): Promise<GeocodingResult | null> {
  // Check cache first
  const cached = await checkCache(location);
  if (cached) {
    if (cached.latitude !== null && cached.longitude !== null) {
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        city: cached.city,
        state: cached.state,
        displayName: location
      };
    }
    // Cached null result (location not found previously)
    return null;
  }

  // Rate limit
  await waitForRateLimit();

  try {
    const params = new URLSearchParams({
      q: location,
      format: 'json',
      countrycodes: 'us',
      limit: '1',
      addressdetails: '1'
    });

    const url = `https://nominatim.openstreetmap.org/search?${params}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT
      }
    });

    if (!response.ok) {
      console.warn(`[Geocoding] Nominatim returned ${response.status} for "${location}"`);
      return null;
    }

    const data = await response.json() as NominatimResponse[];

    if (!data || data.length === 0) {
      // Cache the null result to avoid repeated lookups
      await saveToCache(location, null);
      return null;
    }

    const result = data[0];
    const geocodingResult: GeocodingResult = {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      city: extractCity(result.address),
      state: extractState(result.address),
      displayName: result.display_name
    };

    // Cache the result
    await saveToCache(location, geocodingResult);

    return geocodingResult;
  } catch (error) {
    console.error(`[Geocoding] Error geocoding "${location}":`, error);
    return null;
  }
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_code?: string;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimAddress;
}

function extractCity(address: NominatimAddress): string | null {
  return address.city || address.town || address.village || address.municipality || null;
}

function extractState(address: NominatimAddress): string | null {
  // Prefer state code (abbreviation) if available
  if (address.state_code) {
    return address.state_code.toUpperCase();
  }
  return address.state || null;
}

/**
 * Geocode with city and state
 */
export async function geocodeCityState(city: string, state: string): Promise<GeocodingResult | null> {
  const query = `${city}, ${state}, USA`;
  return geocode(query);
}
