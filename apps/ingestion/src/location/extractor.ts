import { fuzzyMatchCity, normalizeCity, getDefaultState } from '../geocoding/fuzzy.js';

// US State abbreviations and full names
const STATE_ABBREVIATIONS: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
  'PR': 'Puerto Rico'
};

const STATE_NAMES = Object.values(STATE_ABBREVIATIONS);
const STATE_ABBR_PATTERN = Object.keys(STATE_ABBREVIATIONS).join('|');

// Major US cities for quick matching (includes border cities)
const MAJOR_CITIES = [
  'Los Angeles', 'New York', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
  'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville',
  'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville',
  'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Mesa',
  'Sacramento', 'Atlanta', 'Kansas City', 'Colorado Springs', 'Miami',
  'Raleigh', 'Omaha', 'Long Beach', 'Virginia Beach', 'Oakland', 'Minneapolis',
  'Tulsa', 'Tampa', 'Arlington', 'New Orleans', 'Bakersfield', 'Wichita',
  'Cleveland', 'Aurora', 'Anaheim', 'Honolulu', 'Santa Ana', 'Riverside',
  'Corpus Christi', 'Lexington', 'Henderson', 'Stockton', 'Saint Paul',
  'Cincinnati', 'St. Louis', 'Pittsburgh', 'Greensboro', 'Lincoln', 'Anchorage',
  'Plano', 'Orlando', 'Irvine', 'Newark', 'Durham', 'Chula Vista', 'Toledo',
  'Fort Wayne', 'St. Petersburg', 'Laredo', 'Jersey City', 'Chandler',
  'Madison', 'Lubbock', 'Scottsdale', 'Reno', 'Buffalo', 'Gilbert', 'Glendale',
  'North Las Vegas', 'Winston-Salem', 'Chesapeake', 'Norfolk', 'Fremont',
  'Garland', 'Irving', 'Hialeah', 'Richmond', 'Boise', 'Spokane', 'Baton Rouge',
  // Border cities (high priority for immigration reports)
  'San Ysidro', 'El Centro', 'McAllen', 'Brownsville', 'Calexico', 'Nogales',
  'Yuma', 'Douglas', 'Del Rio', 'Eagle Pass', 'Roma', 'Hidalgo', 'Pharr',
  'Harlingen', 'Edinburg', 'Mission', 'Weslaco', 'Rio Grande City', 'Presidio',
  'Fabens', 'San Luis', 'Lukeville', 'Sasabe', 'Naco'
];

export interface ExtractedLocation {
  city: string | null;
  state: string | null;
  confidence: 'high' | 'medium' | 'low';
  rawMatch: string;
}

/**
 * Extract location information from text using regex patterns
 */
export function extractLocation(text: string): ExtractedLocation | null {
  // Normalize text
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "City, ST" or "City, State" format (highest confidence)
  const cityStatePattern = new RegExp(
    `\\b([A-Z][a-zA-Z\\s.'-]+?)\\s*,\\s*(${STATE_ABBR_PATTERN}|${STATE_NAMES.join('|')})\\b`,
    'i'
  );
  const cityStateMatch = normalizedText.match(cityStatePattern);
  if (cityStateMatch) {
    const city = cityStateMatch[1].trim();
    const stateInput = cityStateMatch[2].toUpperCase();
    const state = STATE_ABBREVIATIONS[stateInput] || stateInput;

    return {
      city,
      state: normalizeState(state),
      confidence: 'high',
      rawMatch: cityStateMatch[0]
    };
  }

  // Pattern 2: Known major city names (exact match)
  for (const city of MAJOR_CITIES) {
    const cityPattern = new RegExp(`\\b${escapeRegex(city)}\\b`, 'i');
    if (cityPattern.test(normalizedText)) {
      // Try to get default state for this city
      const defaultState = getDefaultState(city);
      return {
        city: normalizeCity(city),
        state: defaultState,
        confidence: defaultState ? 'high' : 'medium',
        rawMatch: city
      };
    }
  }

  // Pattern 2b: Fuzzy match for common misspellings and abbreviations
  const words = normalizedText.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    // Try single word
    const singleWord = words[i].replace(/[,.:;!?]/g, '');
    const fuzzyResult = fuzzyMatchCity(singleWord);
    if (fuzzyResult && fuzzyResult.score >= 0.9) {
      return {
        city: fuzzyResult.city,
        state: fuzzyResult.state,
        confidence: fuzzyResult.score >= 0.95 ? 'high' : 'medium',
        rawMatch: singleWord
      };
    }

    // Try two-word combinations (e.g., "Los Angeles", "San Francisco")
    if (i < words.length - 1) {
      const twoWords = `${words[i]} ${words[i + 1]}`.replace(/[,.:;!?]/g, '');
      const fuzzyResult2 = fuzzyMatchCity(twoWords);
      if (fuzzyResult2 && fuzzyResult2.score >= 0.85) {
        return {
          city: fuzzyResult2.city,
          state: fuzzyResult2.state,
          confidence: fuzzyResult2.score >= 0.95 ? 'high' : 'medium',
          rawMatch: twoWords
        };
      }
    }

    // Try three-word combinations (e.g., "New York City", "Salt Lake City")
    if (i < words.length - 2) {
      const threeWords = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.replace(/[,.:;!?]/g, '');
      const fuzzyResult3 = fuzzyMatchCity(threeWords);
      if (fuzzyResult3 && fuzzyResult3.score >= 0.85) {
        return {
          city: fuzzyResult3.city,
          state: fuzzyResult3.state,
          confidence: fuzzyResult3.score >= 0.95 ? 'high' : 'medium',
          rawMatch: threeWords
        };
      }
    }
  }

  // Pattern 3: "in [City]" or "at [City]" patterns
  const prepositionPattern = /\b(?:in|at|near|around)\s+([A-Z][a-zA-Z\s.'-]+?)(?:\s*,|\s+(?:area|region|today|yesterday|this|last)|\.|$)/i;
  const prepositionMatch = normalizedText.match(prepositionPattern);
  if (prepositionMatch) {
    const potentialCity = prepositionMatch[1].trim();
    // Filter out common false positives
    if (!isCommonWord(potentialCity) && potentialCity.length > 2) {
      return {
        city: potentialCity,
        state: null,
        confidence: 'low',
        rawMatch: prepositionMatch[0]
      };
    }
  }

  // Pattern 4: State-only mentions
  const stateOnlyPattern = new RegExp(
    `\\b(${STATE_NAMES.join('|')})\\b`,
    'i'
  );
  const stateOnlyMatch = normalizedText.match(stateOnlyPattern);
  if (stateOnlyMatch) {
    return {
      city: null,
      state: normalizeState(stateOnlyMatch[1]),
      confidence: 'low',
      rawMatch: stateOnlyMatch[0]
    };
  }

  return null;
}

/**
 * Normalize state name to abbreviation
 */
function normalizeState(state: string): string {
  const upper = state.toUpperCase().trim();

  // Already an abbreviation
  if (STATE_ABBREVIATIONS[upper]) {
    return upper;
  }

  // Find abbreviation from full name
  for (const [abbr, name] of Object.entries(STATE_ABBREVIATIONS)) {
    if (name.toUpperCase() === upper) {
      return abbr;
    }
  }

  return state;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a string is a common word (false positive filter)
 */
function isCommonWord(str: string): boolean {
  const commonWords = new Set([
    'ice', 'the', 'area', 'region', 'place', 'location', 'site', 'spot',
    'downtown', 'uptown', 'north', 'south', 'east', 'west', 'central',
    'morning', 'afternoon', 'evening', 'night', 'today', 'yesterday',
    'border', 'checkpoint', 'raid', 'agents', 'officers', 'police'
  ]);
  return commonWords.has(str.toLowerCase());
}

/**
 * Detect activity type from text
 */
export type ActivityType = 'raid' | 'checkpoint' | 'arrest' | 'surveillance' | 'other';

export function detectActivityType(text: string): ActivityType {
  const lowerText = text.toLowerCase();

  // Raid indicators
  if (/\b(raid|redada|raided|raiding|workplace\s+enforcement)\b/i.test(lowerText)) {
    return 'raid';
  }

  // Checkpoint indicators
  if (/\b(checkpoint|checkpoints|retén|reten|document\s+check|stopping\s+vehicles)\b/i.test(lowerText)) {
    return 'checkpoint';
  }

  // Arrest indicators
  if (/\b(arrest|arrested|detained|custody|taken\s+into|apprehended|detenido)\b/i.test(lowerText)) {
    return 'arrest';
  }

  // Surveillance indicators
  if (/\b(surveillance|watching|monitoring|unmarked|observing|plainclothes|vigilancia)\b/i.test(lowerText)) {
    return 'surveillance';
  }

  return 'other';
}
