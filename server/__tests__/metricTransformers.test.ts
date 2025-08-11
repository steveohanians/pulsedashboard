/**
 * Tests for metric transformation utilities
 */

// @ts-nocheck
import { describe, it, expect } from '@jest/globals';
import { 
  transformGA4ToCanonical, 
  transformSEMrushToCanonical,
  transformDataForSEOToCanonical,
  transformToCanonical,
  extractLegacyValue,
  isValidCanonicalEnvelope
} from '../utils/metricTransformers';
import { CanonicalMetricEnvelopeSchema } from '../../shared/schema';

describe('Metric Transformers', () => {
  
  describe('transformGA4ToCanonical', () => {
    it('should transform bounce rate to canonical envelope', () => {
      const result = transformGA4ToCanonical('Bounce Rate', 0.45, '2025-07');
      
      expect(result).toMatchObject({
        series: [{
          date: '2025-07-01',
          value: 0.45
        }],
        meta: {
          sourceType: 'GA4',
          units: 'percentage'
        }
      });

      // Validate against schema
      expect(() => CanonicalMetricEnvelopeSchema.parse(result)).not.toThrow();
    });

    it('should transform session duration to canonical envelope with minutes unit', () => {
      const result = transformGA4ToCanonical('Session Duration', 125.5, '2025-06');
      
      expect(result.meta.units).toBe('minutes');
      expect(result.series[0].value).toBe(125.5);
      expect(result.series[0].date).toBe('2025-06-01');
    });

    it('should handle device dimensions', () => {
      const result = transformGA4ToCanonical(
        'Device Distribution', 
        89.5, 
        '2025-07',
        { deviceCategory: 'Desktop' }
      );
      
      expect(result.series[0].dimensions).toEqual({ deviceCategory: 'Desktop' });
    });

    it('should handle traffic channel dimensions', () => {
      const result = transformGA4ToCanonical(
        'Traffic Channels', 
        42.3, 
        '2025-07',
        { channel: 'Organic Search' }
      );
      
      expect(result.series[0].dimensions).toEqual({ channel: 'Organic Search' });
    });

    it('should handle complex object values', () => {
      const complexValue = { percentage: 67.8, sessions: 1234 };
      const result = transformGA4ToCanonical('Device Distribution', complexValue, '2025-07');
      
      expect(result.series[0].value).toBe(67.8);
    });
  });

  describe('transformSEMrushToCanonical', () => {
    it('should transform SEMrush traffic data', () => {
      const result = transformSEMrushToCanonical('Organic Traffic', 15430, '2025-07');
      
      expect(result).toMatchObject({
        series: [{
          date: '2025-07-01',
          value: 15430
        }],
        meta: {
          sourceType: 'SEMrush',
          units: 'sessions'
        }
      });
    });

    it('should handle SEMrush keyword data', () => {
      const result = transformSEMrushToCanonical('Keywords', 847, '2025-06');
      
      expect(result.meta.units).toBe('count');
      expect(result.series[0].value).toBe(847);
    });
  });

  describe('transformDataForSEOToCanonical', () => {
    it('should transform search volume data', () => {
      const result = transformDataForSEOToCanonical('Search Volume', 8900, '2025-07');
      
      expect(result).toMatchObject({
        meta: {
          sourceType: 'DataForSEO',
          units: 'count'
        }
      });
    });

    it('should handle CPC data with currency units', () => {
      const result = transformDataForSEOToCanonical('CPC', 2.45, '2025-07');
      
      expect(result.meta.units).toBe('currency');
      expect(result.series[0].value).toBe(2.45);
    });
  });

  describe('transformToCanonical (auto-detect)', () => {
    it('should auto-detect GA4 source type', () => {
      const result = transformToCanonical('Bounce Rate', 0.42, '2025-07', 'GA4');
      
      expect(result.meta.sourceType).toBe('GA4');
    });

    it('should auto-detect SEMrush source type', () => {
      const result = transformToCanonical('Traffic', 1000, '2025-07', 'semrush');
      
      expect(result.meta.sourceType).toBe('SEMrush');
    });

    it('should default to GA4 for unknown source types', () => {
      const result = transformToCanonical('Unknown Metric', 123, '2025-07', 'unknown');
      
      expect(result.meta.sourceType).toBe('GA4');
    });
  });

  describe('extractLegacyValue', () => {
    it('should extract single series value', () => {
      const envelope = {
        series: [{ date: '2025-07-01', value: 42.5 }],
        meta: { sourceType: 'GA4' as const, units: 'percentage' }
      };
      
      const result = extractLegacyValue(envelope);
      expect(result).toBe(42.5);
    });

    it('should extract single series with dimensions', () => {
      const envelope = {
        series: [{ 
          date: '2025-07-01', 
          value: 89.5, 
          dimensions: { deviceCategory: 'Desktop' } 
        }],
        meta: { sourceType: 'GA4' as const, units: 'percentage' }
      };
      
      const result = extractLegacyValue(envelope);
      expect(result).toEqual({
        value: 89.5,
        dimensions: { deviceCategory: 'Desktop' }
      });
    });

    it('should extract multiple series as array', () => {
      const envelope = {
        series: [
          { date: '2025-07-01', value: 10 },
          { date: '2025-07-02', value: 20 }
        ],
        meta: { sourceType: 'GA4' as const, units: 'count' }
      };
      
      const result = extractLegacyValue(envelope);
      expect(result).toEqual([
        { date: '2025-07-01', value: 10, dimensions: undefined },
        { date: '2025-07-02', value: 20, dimensions: undefined }
      ]);
    });
  });

  describe('isValidCanonicalEnvelope', () => {
    it('should validate correct canonical envelope', () => {
      const envelope = {
        series: [{ date: '2025-07-01', value: 42.5 }],
        meta: { sourceType: 'GA4', units: 'percentage' }
      };
      
      expect(isValidCanonicalEnvelope(envelope)).toBe(true);
    });

    it('should reject invalid envelope structures', () => {
      expect(isValidCanonicalEnvelope(null)).toBe(false);
      expect(isValidCanonicalEnvelope({})).toBe(false);
      expect(isValidCanonicalEnvelope({ series: [] })).toBe(false);
      expect(isValidCanonicalEnvelope({ 
        series: [{ date: '2025-07-01', value: 42 }] 
      })).toBe(false); // Missing meta
    });
  });

  describe('Unit mapping', () => {
    const testCases = [
      { metricName: 'Bounce Rate', expectedUnit: 'percentage' },
      { metricName: 'Session Duration', expectedUnit: 'minutes' },
      { metricName: 'Sessions', expectedUnit: 'sessions' },
      { metricName: 'Device Distribution', expectedUnit: 'percentage' },
      { metricName: 'Page Views', expectedUnit: 'count' }
    ];

    testCases.forEach(({ metricName, expectedUnit }) => {
      it(`should map ${metricName} to ${expectedUnit} units`, () => {
        const result = transformGA4ToCanonical(metricName, 100, '2025-07');
        expect(result.meta.units).toBe(expectedUnit);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero values', () => {
      const result = transformGA4ToCanonical('Bounce Rate', 0, '2025-07');
      expect(result.series[0].value).toBe(0);
    });

    it('should handle string numeric values', () => {
      const result = transformGA4ToCanonical('Session Duration', '125.5', '2025-07');
      expect(result.series[0].value).toBe(125.5);
    });

    it('should handle null/undefined values gracefully', () => {
      const result = transformGA4ToCanonical('Unknown Metric', null, '2025-07');
      expect(result.series[0].value).toBe(0);
    });

    it('should validate date format in series', () => {
      const result = transformGA4ToCanonical('Test Metric', 100, '2025-12');
      expect(result.series[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.series[0].date).toBe('2025-12-01');
    });
  });
});