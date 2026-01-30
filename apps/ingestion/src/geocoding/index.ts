/**
 * Geocoding module - provides location resolution services
 *
 * Features:
 * - Nominatim API integration with caching
 * - Fuzzy city name matching (handles misspellings, abbreviations)
 * - Coordinate validation (ensures US territory)
 * - Known city database for instant lookups (no API call)
 * - Border city support for immigration-related reports
 */

export {
  geocode,
  geocodeCityState,
  geocodeCity,
  geocodeBatch,
  type GeocodingResult
} from './nominatim.js';

export {
  fuzzyMatchCity,
  normalizeCity,
  getDefaultState,
  cleanLocationString,
  CITY_STATE_MAP,
  CITY_ALIASES
} from './fuzzy.js';

export {
  validateUSCoordinates,
  isValidState,
  approximateState,
  validateStateCoordinateMatch,
  type ValidationResult
} from './validation.js';
