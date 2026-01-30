/**
 * Fuzzy matching utilities for city and location names
 * Handles common misspellings, abbreviations, and variations
 */

// Common city name variations and misspellings
const CITY_ALIASES: Record<string, string> = {
  // Common misspellings
  'los angelas': 'Los Angeles',
  'los angles': 'Los Angeles',
  'la': 'Los Angeles',
  'nyc': 'New York',
  'new york city': 'New York',
  'san fran': 'San Francisco',
  'sf': 'San Francisco',
  'frisco': 'San Francisco',
  'philly': 'Philadelphia',
  'vegas': 'Las Vegas',
  'nola': 'New Orleans',
  'atl': 'Atlanta',
  'chi': 'Chicago',
  'chi-town': 'Chicago',
  'dc': 'Washington',
  'washington dc': 'Washington',
  'washington d.c.': 'Washington',
  'houston tx': 'Houston',
  'dallas tx': 'Dallas',
  'miami fl': 'Miami',
  'phx': 'Phoenix',
  'san antone': 'San Antonio',
  'san jo': 'San Jose',
  'sj': 'San Jose',
  'sd': 'San Diego',
  'el monte': 'El Monte',
  'ft worth': 'Fort Worth',
  'ft. worth': 'Fort Worth',
  'ft wayne': 'Fort Wayne',
  'ft. wayne': 'Fort Wayne',
  'st louis': 'St. Louis',
  'st. louis': 'St. Louis',
  'saint louis': 'St. Louis',
  'st paul': 'St. Paul',
  'st. paul': 'St. Paul',
  'saint paul': 'St. Paul',
  'st pete': 'St. Petersburg',
  'st. pete': 'St. Petersburg',
  'saint petersburg': 'St. Petersburg',
  'n las vegas': 'North Las Vegas',
  'n. las vegas': 'North Las Vegas',

  // Spanish variations
  'nueva york': 'New York',
  'los ángeles': 'Los Angeles',
  'san antonio': 'San Antonio',
  'san diego': 'San Diego',
  'san francisco': 'San Francisco',
  'san jose': 'San Jose',
  'san josé': 'San Jose',

  // Border cities (common in immigration reports)
  'el paso tx': 'El Paso',
  'mcallen tx': 'McAllen',
  'brownsville tx': 'Brownsville',
  'laredo tx': 'Laredo',
  'san ysidro ca': 'San Ysidro',
  'calexico ca': 'Calexico',
  'nogales az': 'Nogales',
  'yuma az': 'Yuma',
  'douglas az': 'Douglas',
  'del rio tx': 'Del Rio',
  'eagle pass tx': 'Eagle Pass',
  'roma tx': 'Roma',
  'hidalgo tx': 'Hidalgo',
  'pharr tx': 'Pharr',
  'harlingen tx': 'Harlingen',
  'edinburg tx': 'Edinburg',
  'mission tx': 'Mission',
  'weslaco tx': 'Weslaco'
};

// Major cities with their states for disambiguation
const CITY_STATE_MAP: Record<string, string> = {
  'Los Angeles': 'CA',
  'New York': 'NY',
  'Chicago': 'IL',
  'Houston': 'TX',
  'Phoenix': 'AZ',
  'Philadelphia': 'PA',
  'San Antonio': 'TX',
  'San Diego': 'CA',
  'Dallas': 'TX',
  'San Jose': 'CA',
  'Austin': 'TX',
  'Jacksonville': 'FL',
  'Fort Worth': 'TX',
  'Columbus': 'OH',
  'San Francisco': 'CA',
  'Charlotte': 'NC',
  'Indianapolis': 'IN',
  'Seattle': 'WA',
  'Denver': 'CO',
  'Washington': 'DC',
  'Boston': 'MA',
  'El Paso': 'TX',
  'Nashville': 'TN',
  'Detroit': 'MI',
  'Oklahoma City': 'OK',
  'Portland': 'OR',
  'Las Vegas': 'NV',
  'Memphis': 'TN',
  'Louisville': 'KY',
  'Baltimore': 'MD',
  'Milwaukee': 'WI',
  'Albuquerque': 'NM',
  'Tucson': 'AZ',
  'Fresno': 'CA',
  'Sacramento': 'CA',
  'Atlanta': 'GA',
  'Kansas City': 'MO',
  'Miami': 'FL',
  'Raleigh': 'NC',
  'Oakland': 'CA',
  'Minneapolis': 'MN',
  'Tampa': 'FL',
  'New Orleans': 'LA',
  'Cleveland': 'OH',
  'Orlando': 'FL',
  'St. Louis': 'MO',
  'Pittsburgh': 'PA',
  'Anchorage': 'AK',
  'Honolulu': 'HI',
  // Border cities
  'McAllen': 'TX',
  'Brownsville': 'TX',
  'Laredo': 'TX',
  'San Ysidro': 'CA',
  'El Centro': 'CA',
  'Calexico': 'CA',
  'Nogales': 'AZ',
  'Yuma': 'AZ',
  'Douglas': 'AZ',
  'Del Rio': 'TX',
  'Eagle Pass': 'TX',
  'Roma': 'TX',
  'Hidalgo': 'TX',
  'Pharr': 'TX',
  'Harlingen': 'TX',
  'Edinburg': 'TX',
  'Mission': 'TX',
  'Weslaco': 'TX'
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Find the best matching city from our known cities
 */
export function fuzzyMatchCity(input: string): { city: string; state: string | null; score: number } | null {
  const normalized = input.toLowerCase().trim();

  // Check exact alias match first
  if (CITY_ALIASES[normalized]) {
    const city = CITY_ALIASES[normalized];
    return {
      city,
      state: CITY_STATE_MAP[city] || null,
      score: 1.0
    };
  }

  // Check exact match in city-state map
  for (const city of Object.keys(CITY_STATE_MAP)) {
    if (city.toLowerCase() === normalized) {
      return {
        city,
        state: CITY_STATE_MAP[city],
        score: 1.0
      };
    }
  }

  // Fuzzy match against known cities
  let bestMatch: { city: string; state: string | null; score: number } | null = null;
  const threshold = 0.8; // Minimum similarity score

  for (const city of Object.keys(CITY_STATE_MAP)) {
    const score = similarity(normalized, city.toLowerCase());
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        city,
        state: CITY_STATE_MAP[city],
        score
      };
    }
  }

  // Also check aliases for fuzzy matches
  for (const alias of Object.keys(CITY_ALIASES)) {
    const score = similarity(normalized, alias);
    if (score >= threshold && (!bestMatch || score > bestMatch.score)) {
      const city = CITY_ALIASES[alias];
      bestMatch = {
        city,
        state: CITY_STATE_MAP[city] || null,
        score
      };
    }
  }

  return bestMatch;
}

/**
 * Normalize a city name to its canonical form
 */
export function normalizeCity(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Check aliases
  if (CITY_ALIASES[normalized]) {
    return CITY_ALIASES[normalized];
  }

  // Check known cities (case-insensitive)
  for (const city of Object.keys(CITY_STATE_MAP)) {
    if (city.toLowerCase() === normalized) {
      return city;
    }
  }

  // Return with proper capitalization
  return input.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get the default state for a city (if known)
 */
export function getDefaultState(city: string): string | null {
  const normalized = normalizeCity(city);
  return CITY_STATE_MAP[normalized] || null;
}

/**
 * Clean up a location string for geocoding
 */
export function cleanLocationString(input: string): string {
  return input
    // Remove common noise words
    .replace(/\b(area|region|near|around|downtown|neighborhood)\b/gi, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Remove leading/trailing punctuation
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();
}

export { CITY_STATE_MAP, CITY_ALIASES };
