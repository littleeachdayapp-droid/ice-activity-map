import { query } from '@ice-activity-map/database';
import { fuzzyMatchCity, normalizeCity, cleanLocationString, getDefaultState } from './fuzzy.js';
import { validateUSCoordinates, validateStateCoordinateMatch } from './validation.js';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'cache' | 'nominatim' | 'fuzzy';
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

// Known city coordinates for fallback (border cities and major metros)
const KNOWN_CITY_COORDS: Record<string, { lat: number; lng: number; state: string }> = {
  'Los Angeles': { lat: 34.0522, lng: -118.2437, state: 'CA' },
  'New York': { lat: 40.7128, lng: -74.0060, state: 'NY' },
  'Chicago': { lat: 41.8781, lng: -87.6298, state: 'IL' },
  'Houston': { lat: 29.7604, lng: -95.3698, state: 'TX' },
  'Phoenix': { lat: 33.4484, lng: -112.0740, state: 'AZ' },
  'San Antonio': { lat: 29.4241, lng: -98.4936, state: 'TX' },
  'San Diego': { lat: 32.7157, lng: -117.1611, state: 'CA' },
  'Dallas': { lat: 32.7767, lng: -96.7970, state: 'TX' },
  'San Francisco': { lat: 37.7749, lng: -122.4194, state: 'CA' },
  'Austin': { lat: 30.2672, lng: -97.7431, state: 'TX' },
  'Miami': { lat: 25.7617, lng: -80.1918, state: 'FL' },
  'Atlanta': { lat: 33.7490, lng: -84.3880, state: 'GA' },
  'Denver': { lat: 39.7392, lng: -104.9903, state: 'CO' },
  'Seattle': { lat: 47.6062, lng: -122.3321, state: 'WA' },
  // Border cities - high priority for immigration reports
  'El Paso': { lat: 31.7619, lng: -106.4850, state: 'TX' },
  'McAllen': { lat: 26.2034, lng: -98.2300, state: 'TX' },
  'Brownsville': { lat: 25.9017, lng: -97.4975, state: 'TX' },
  'Laredo': { lat: 27.5036, lng: -99.5075, state: 'TX' },
  'San Ysidro': { lat: 32.5561, lng: -117.0431, state: 'CA' },
  'El Centro': { lat: 32.7920, lng: -115.5631, state: 'CA' },
  'Calexico': { lat: 32.6789, lng: -115.4989, state: 'CA' },
  'Nogales': { lat: 31.3404, lng: -110.9343, state: 'AZ' },
  'Yuma': { lat: 32.6927, lng: -114.6277, state: 'AZ' },
  'Douglas': { lat: 31.3445, lng: -109.5453, state: 'AZ' },
  'Del Rio': { lat: 29.3627, lng: -100.8968, state: 'TX' },
  'Eagle Pass': { lat: 28.7091, lng: -100.4995, state: 'TX' },
  'Hidalgo': { lat: 26.1004, lng: -98.2631, state: 'TX' },
  'Pharr': { lat: 26.1948, lng: -98.1836, state: 'TX' },
  'Harlingen': { lat: 26.1906, lng: -97.6961, state: 'TX' },
  'Edinburg': { lat: 26.3017, lng: -98.1633, state: 'TX' },
  'Mission': { lat: 26.2159, lng: -98.3253, state: 'TX' },
  'Weslaco': { lat: 26.1593, lng: -97.9908, state: 'TX' },
  'Roma': { lat: 26.4052, lng: -99.0157, state: 'TX' },
  'Rio Grande City': { lat: 26.3798, lng: -98.8203, state: 'TX' },
  'Presidio': { lat: 29.5607, lng: -104.3722, state: 'TX' },
  'Fabens': { lat: 31.5068, lng: -106.1581, state: 'TX' },
  'San Luis': { lat: 32.4869, lng: -114.7817, state: 'AZ' },
  'Lukeville': { lat: 31.8776, lng: -112.8182, state: 'AZ' },
  'Sasabe': { lat: 31.4862, lng: -111.5423, state: 'AZ' },
  'Naco': { lat: 31.3349, lng: -109.9481, state: 'AZ' }
};

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
 * Try to get coordinates from known city database (fast, no API call)
 */
function tryKnownCityLookup(city: string, state?: string | null): GeocodingResult | null {
  const normalizedCity = normalizeCity(city);
  const knownCity = KNOWN_CITY_COORDS[normalizedCity];

  if (knownCity) {
    // If state provided, verify it matches
    if (state && state.toUpperCase() !== knownCity.state) {
      return null; // State mismatch
    }
    return {
      latitude: knownCity.lat,
      longitude: knownCity.lng,
      city: normalizedCity,
      state: knownCity.state,
      displayName: `${normalizedCity}, ${knownCity.state}`,
      confidence: 'high',
      source: 'fuzzy'
    };
  }

  // Try fuzzy matching
  const fuzzyResult = fuzzyMatchCity(city);
  if (fuzzyResult && fuzzyResult.score >= 0.9) {
    const matchedCity = KNOWN_CITY_COORDS[fuzzyResult.city];
    if (matchedCity) {
      return {
        latitude: matchedCity.lat,
        longitude: matchedCity.lng,
        city: fuzzyResult.city,
        state: matchedCity.state,
        displayName: `${fuzzyResult.city}, ${matchedCity.state}`,
        confidence: fuzzyResult.score >= 0.95 ? 'high' : 'medium',
        source: 'fuzzy'
      };
    }
  }

  return null;
}

/**
 * Geocode a location string using multiple strategies:
 * 1. Check cache
 * 2. Try known city lookup (instant, no API)
 * 3. Try Nominatim API
 * 4. Try fuzzy matching + Nominatim as fallback
 */
export async function geocode(location: string): Promise<GeocodingResult | null> {
  const cleanedLocation = cleanLocationString(location);

  // Check cache first
  const cached = await checkCache(cleanedLocation);
  if (cached) {
    if (cached.latitude !== null && cached.longitude !== null) {
      // Validate cached coordinates
      const validation = validateUSCoordinates(cached.latitude, cached.longitude);
      if (validation.isValid) {
        return {
          latitude: cached.latitude,
          longitude: cached.longitude,
          city: cached.city,
          state: cached.state,
          displayName: cleanedLocation,
          confidence: 'high',
          source: 'cache'
        };
      }
      // Invalid cached coordinates - continue to re-geocode
    } else {
      // Cached null result (location not found previously)
      return null;
    }
  }

  // Try known city lookup first (instant, no API call)
  const knownCityResult = tryKnownCityLookup(cleanedLocation);
  if (knownCityResult) {
    await saveToCache(cleanedLocation, knownCityResult);
    return knownCityResult;
  }

  // Try Nominatim API
  const nominatimResult = await geocodeWithNominatim(cleanedLocation);
  if (nominatimResult) {
    // Validate the result
    const validation = validateUSCoordinates(nominatimResult.latitude, nominatimResult.longitude);
    if (validation.isValid) {
      await saveToCache(cleanedLocation, nominatimResult);
      return nominatimResult;
    }
    console.warn(`[Geocoding] Nominatim returned non-US coordinates for "${cleanedLocation}": ${validation.issue}`);
  }

  // Try fuzzy matching as fallback
  const fuzzyResult = fuzzyMatchCity(cleanedLocation);
  if (fuzzyResult && fuzzyResult.score >= 0.8) {
    // Try geocoding the fuzzy-matched city
    const fuzzyQuery = fuzzyResult.state
      ? `${fuzzyResult.city}, ${fuzzyResult.state}, USA`
      : `${fuzzyResult.city}, USA`;

    const fuzzyGeocode = await geocodeWithNominatim(fuzzyQuery);
    if (fuzzyGeocode) {
      const validation = validateUSCoordinates(fuzzyGeocode.latitude, fuzzyGeocode.longitude);
      if (validation.isValid) {
        fuzzyGeocode.confidence = fuzzyResult.score >= 0.95 ? 'medium' : 'low';
        await saveToCache(cleanedLocation, fuzzyGeocode);
        return fuzzyGeocode;
      }
    }

    // Use known city coords as last resort
    const knownFuzzyCity = KNOWN_CITY_COORDS[fuzzyResult.city];
    if (knownFuzzyCity) {
      const result: GeocodingResult = {
        latitude: knownFuzzyCity.lat,
        longitude: knownFuzzyCity.lng,
        city: fuzzyResult.city,
        state: knownFuzzyCity.state,
        displayName: `${fuzzyResult.city}, ${knownFuzzyCity.state}`,
        confidence: 'low',
        source: 'fuzzy'
      };
      await saveToCache(cleanedLocation, result);
      return result;
    }
  }

  // Cache the null result to avoid repeated lookups
  await saveToCache(cleanedLocation, null);
  return null;
}

/**
 * Internal function to call Nominatim API
 */
async function geocodeWithNominatim(location: string): Promise<GeocodingResult | null> {
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
      return null;
    }

    const result = data[0];
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      city: extractCity(result.address),
      state: extractState(result.address),
      displayName: result.display_name,
      confidence: 'high',
      source: 'nominatim'
    };
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
  // Normalize inputs
  const normalizedCity = normalizeCity(city);
  const normalizedState = state.toUpperCase().trim();

  // Try known city lookup first
  const knownResult = tryKnownCityLookup(normalizedCity, normalizedState);
  if (knownResult) {
    return knownResult;
  }

  // Fall back to full geocoding
  const queryStr = `${normalizedCity}, ${normalizedState}, USA`;
  return geocode(queryStr);
}

/**
 * Geocode with just a city name (tries to infer state)
 */
export async function geocodeCity(city: string): Promise<GeocodingResult | null> {
  const normalizedCity = normalizeCity(city);

  // Try to get default state for this city
  const defaultState = getDefaultState(normalizedCity);

  if (defaultState) {
    return geocodeCityState(normalizedCity, defaultState);
  }

  // No known state, geocode with just city
  return geocode(`${normalizedCity}, USA`);
}

/**
 * Batch geocode multiple locations (respects rate limits)
 */
export async function geocodeBatch(locations: string[]): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>();

  for (const location of locations) {
    const result = await geocode(location);
    results.set(location, result);
  }

  return results;
}

// Re-export utilities
export { validateUSCoordinates, validateStateCoordinateMatch } from './validation.js';
export { fuzzyMatchCity, normalizeCity, getDefaultState } from './fuzzy.js';
