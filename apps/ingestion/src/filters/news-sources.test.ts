import { describe, it, expect } from 'vitest';
import { classifySource } from './news-sources';

describe('classifySource', () => {
  describe('trusted sources', () => {
    it.each([
      'Associated Press', 'AP News', 'Reuters',
      'NPR', 'PBS', 'ABC News', 'NBC News', 'CBS News',
      'Univision', 'Telemundo', 'Noticias Telemundo',
      'ProPublica', 'The Texas Tribune', 'LA Times',
      'Miami Herald', 'Houston Chronicle',
    ])('should classify "%s" as trusted', (source) => {
      expect(classifySource(source)).toBe('trusted');
    });
  });

  describe('blocked sources', () => {
    it.each([
      'Infowars', 'Natural News', 'The Gateway Pundit',
      'Breitbart', 'Daily Stormer', 'OANN', 'Newsmax',
    ])('should classify "%s" as blocked', (source) => {
      expect(classifySource(source)).toBe('blocked');
    });
  });

  describe('unknown sources', () => {
    it('should return unknown for unrecognized sources', () => {
      expect(classifySource('Random Blog')).toBe('unknown');
      expect(classifySource('My Local Paper')).toBe('unknown');
    });
  });

  describe('case insensitive matching', () => {
    it('should match regardless of case', () => {
      expect(classifySource('REUTERS')).toBe('trusted');
      expect(classifySource('infowars')).toBe('blocked');
      expect(classifySource('Associated PRESS')).toBe('trusted');
    });
  });

  describe('partial matching', () => {
    it('should match when source name contains a trusted name', () => {
      expect(classifySource('Reuters News Agency')).toBe('trusted');
    });

    it('should match when trusted name contains the source name', () => {
      expect(classifySource('NPR')).toBe('trusted');
    });
  });

  it('should handle whitespace', () => {
    expect(classifySource('  Reuters  ')).toBe('trusted');
  });
});
