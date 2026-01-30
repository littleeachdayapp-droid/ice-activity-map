import { describe, it, expect } from 'vitest';
import {
  fuzzyMatchCity,
  normalizeCity,
  getDefaultState,
  cleanLocationString
} from './fuzzy';

describe('Fuzzy City Matching', () => {
  describe('fuzzyMatchCity', () => {
    it('should match exact city names', () => {
      const result = fuzzyMatchCity('Los Angeles');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('Los Angeles');
      expect(result?.state).toBe('CA');
      expect(result?.score).toBe(1.0);
    });

    it('should match common abbreviations', () => {
      const testCases = [
        { input: 'LA', expected: 'Los Angeles' },
        { input: 'NYC', expected: 'New York' },
        { input: 'SF', expected: 'San Francisco' },
        { input: 'Philly', expected: 'Philadelphia' },
        { input: 'Vegas', expected: 'Las Vegas' },
        { input: 'NOLA', expected: 'New Orleans' },
        { input: 'DC', expected: 'Washington' }
      ];

      for (const { input, expected } of testCases) {
        const result = fuzzyMatchCity(input);
        expect(result, `Expected "${input}" to match "${expected}"`).not.toBeNull();
        expect(result?.city).toBe(expected);
      }
    });

    it('should match common misspellings', () => {
      const testCases = [
        { input: 'Los Angelas', expected: 'Los Angeles' },
        { input: 'Los Angles', expected: 'Los Angeles' },
        { input: 'San Fran', expected: 'San Francisco' },
        { input: 'Frisco', expected: 'San Francisco' }
      ];

      for (const { input, expected } of testCases) {
        const result = fuzzyMatchCity(input);
        expect(result, `Expected "${input}" to match "${expected}"`).not.toBeNull();
        expect(result?.city).toBe(expected);
      }
    });

    it('should match border cities', () => {
      const borderCities = [
        'El Paso', 'McAllen', 'Brownsville', 'Laredo', 'San Ysidro',
        'Calexico', 'Nogales', 'Yuma', 'Douglas', 'Del Rio', 'Eagle Pass'
      ];

      for (const city of borderCities) {
        const result = fuzzyMatchCity(city);
        expect(result, `Expected "${city}" to match`).not.toBeNull();
        expect(result?.city).toBe(city);
        expect(result?.state).toBeDefined();
      }
    });

    it('should match Spanish variations', () => {
      const result = fuzzyMatchCity('Nueva York');
      expect(result).not.toBeNull();
      expect(result?.city).toBe('New York');
    });

    it('should return null for unknown cities', () => {
      const result = fuzzyMatchCity('Xyzzytown');
      expect(result).toBeNull();
    });

    it('should handle case insensitivity', () => {
      const result1 = fuzzyMatchCity('LOS ANGELES');
      const result2 = fuzzyMatchCity('los angeles');
      const result3 = fuzzyMatchCity('Los Angeles');

      expect(result1?.city).toBe('Los Angeles');
      expect(result2?.city).toBe('Los Angeles');
      expect(result3?.city).toBe('Los Angeles');
    });
  });

  describe('normalizeCity', () => {
    it('should normalize city names to canonical form', () => {
      expect(normalizeCity('la')).toBe('Los Angeles');
      expect(normalizeCity('nyc')).toBe('New York');
      expect(normalizeCity('sf')).toBe('San Francisco');
    });

    it('should handle proper capitalization for unknown cities', () => {
      expect(normalizeCity('some random city')).toBe('Some Random City');
    });
  });

  describe('getDefaultState', () => {
    it('should return correct state for known cities', () => {
      expect(getDefaultState('Los Angeles')).toBe('CA');
      expect(getDefaultState('New York')).toBe('NY');
      expect(getDefaultState('Houston')).toBe('TX');
      expect(getDefaultState('Chicago')).toBe('IL');
      expect(getDefaultState('El Paso')).toBe('TX');
      expect(getDefaultState('McAllen')).toBe('TX');
      expect(getDefaultState('San Ysidro')).toBe('CA');
    });

    it('should return null for unknown cities', () => {
      expect(getDefaultState('Unknown City')).toBeNull();
    });
  });

  describe('cleanLocationString', () => {
    it('should remove noise words', () => {
      expect(cleanLocationString('downtown Los Angeles area')).toBe('Los Angeles');
      expect(cleanLocationString('near Phoenix region')).toBe('Phoenix');
    });

    it('should trim and normalize whitespace', () => {
      expect(cleanLocationString('  Los   Angeles  ')).toBe('Los Angeles');
    });

    it('should remove leading/trailing punctuation', () => {
      expect(cleanLocationString(',Los Angeles,')).toBe('Los Angeles');
      expect(cleanLocationString('...Miami...')).toBe('Miami');
    });
  });
});
