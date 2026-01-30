import { describe, it, expect } from 'vitest';
import {
  validateUSCoordinates,
  isValidState,
  approximateState,
  validateStateCoordinateMatch
} from './validation';

describe('Coordinate Validation', () => {
  describe('validateUSCoordinates', () => {
    it('should validate continental US coordinates', () => {
      const testCases = [
        { lat: 34.0522, lng: -118.2437, city: 'Los Angeles' },
        { lat: 40.7128, lng: -74.0060, city: 'New York' },
        { lat: 41.8781, lng: -87.6298, city: 'Chicago' },
        { lat: 29.7604, lng: -95.3698, city: 'Houston' },
        { lat: 25.7617, lng: -80.1918, city: 'Miami' }
      ];

      for (const { lat, lng, city } of testCases) {
        const result = validateUSCoordinates(lat, lng);
        expect(result.isValid, `Expected ${city} (${lat}, ${lng}) to be valid`).toBe(true);
        expect(result.region).toBe('continental');
      }
    });

    it('should validate Alaska coordinates', () => {
      const result = validateUSCoordinates(64.2008, -149.4937); // Fairbanks
      expect(result.isValid).toBe(true);
      expect(result.region).toBe('alaska');
    });

    it('should validate Hawaii coordinates', () => {
      const result = validateUSCoordinates(21.3069, -157.8583); // Honolulu
      expect(result.isValid).toBe(true);
      expect(result.region).toBe('hawaii');
    });

    it('should validate Puerto Rico coordinates', () => {
      const result = validateUSCoordinates(18.4655, -66.1057); // San Juan
      expect(result.isValid).toBe(true);
      expect(result.region).toBe('puerto_rico');
    });

    it('should reject non-US coordinates', () => {
      const nonUSLocations = [
        { lat: 51.5074, lng: -0.1278, name: 'London' },
        { lat: 48.8566, lng: 2.3522, name: 'Paris' },
        { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },
        { lat: 55.7558, lng: 37.6173, name: 'Moscow' },
        { lat: -33.8688, lng: 151.2093, name: 'Sydney' }
      ];

      for (const { lat, lng, name } of nonUSLocations) {
        const result = validateUSCoordinates(lat, lng);
        expect(result.isValid, `Expected ${name} (${lat}, ${lng}) to be invalid`).toBe(false);
        expect(result.issue).toContain('outside US territory');
      }
    });

    it('should reject invalid coordinate values', () => {
      expect(validateUSCoordinates(100, -100).isValid).toBe(false);
      expect(validateUSCoordinates(-100, -100).isValid).toBe(false);
      expect(validateUSCoordinates(40, -200).isValid).toBe(false);
      expect(validateUSCoordinates(NaN, -100).isValid).toBe(false);
      expect(validateUSCoordinates(40, NaN).isValid).toBe(false);
    });
  });

  describe('isValidState', () => {
    it('should validate correct state abbreviations', () => {
      const validStates = ['CA', 'TX', 'NY', 'FL', 'IL', 'AZ', 'DC', 'PR'];
      for (const state of validStates) {
        expect(isValidState(state), `Expected ${state} to be valid`).toBe(true);
      }
    });

    it('should handle case insensitivity', () => {
      expect(isValidState('ca')).toBe(true);
      expect(isValidState('Ca')).toBe(true);
      expect(isValidState('CA')).toBe(true);
    });

    it('should reject invalid states', () => {
      expect(isValidState('XX')).toBe(false);
      expect(isValidState('ZZ')).toBe(false);
      expect(isValidState('')).toBe(false);
    });
  });

  describe('approximateState', () => {
    it('should return correct state for known regions', () => {
      // Alaska
      expect(approximateState(64.2008, -149.4937)).toBe('AK');

      // Hawaii
      expect(approximateState(21.3069, -157.8583)).toBe('HI');

      // Puerto Rico
      expect(approximateState(18.4655, -66.1057)).toBe('PR');
    });

    it('should return null for non-US coordinates', () => {
      expect(approximateState(51.5074, -0.1278)).toBeNull();
    });
  });

  describe('validateStateCoordinateMatch', () => {
    it('should validate matching state and coordinates', () => {
      const result = validateStateCoordinateMatch(34.0522, -118.2437, 'CA');
      expect(result.isConsistent).toBe(true);
    });

    it('should detect Alaska mismatch', () => {
      const result = validateStateCoordinateMatch(64.2008, -149.4937, 'CA');
      expect(result.isConsistent).toBe(false);
      expect(result.suggestedState).toBe('AK');
    });

    it('should detect Hawaii mismatch', () => {
      const result = validateStateCoordinateMatch(21.3069, -157.8583, 'NY');
      expect(result.isConsistent).toBe(false);
      expect(result.suggestedState).toBe('HI');
    });

    it('should detect Puerto Rico mismatch', () => {
      const result = validateStateCoordinateMatch(18.4655, -66.1057, 'TX');
      expect(result.isConsistent).toBe(false);
      expect(result.suggestedState).toBe('PR');
    });
  });
});
