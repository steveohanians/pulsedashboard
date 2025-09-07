/**
 * Data sanitization utilities for safe display rendering
 * Prevents XSS attacks and ensures consistent data formatting
 */

export interface SanitizedDisplayData {
  clientName: string;
  score: number;
  status: string;
  criterion: string;
  progressDetail: string;
  insight: string;
  recommendation: string;
  url: string;
}

/**
 * Comprehensive data sanitizer for effectiveness components
 */
export class DataSanitizer {
  private static instance: DataSanitizer;

  static getInstance(): DataSanitizer {
    if (!DataSanitizer.instance) {
      DataSanitizer.instance = new DataSanitizer();
    }
    return DataSanitizer.instance;
  }

  /**
   * Sanitize text for safe HTML display
   */
  sanitizeText(value: any, maxLength: number = 1000): string {
    if (typeof value !== 'string') {
      return String(value || '');
    }

    return value
      // Remove potential XSS vectors
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, 'blocked:')
      .replace(/data:/gi, 'blocked:')
      .replace(/vbscript:/gi, 'blocked:')
      .replace(/on\w+\s*=/gi, 'blocked=')
      .replace(/<iframe\b[^>]*>/gi, '[iframe removed]')
      .replace(/<embed\b[^>]*>/gi, '[embed removed]')
      .replace(/<object\b[^>]*>/gi, '[object removed]')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit length to prevent display issues
      .substring(0, maxLength);
  }

  /**
   * Sanitize client name for display
   */
  sanitizeClientName(name: any): string {
    const sanitized = this.sanitizeText(name, 100);
    return sanitized || 'Unknown Client';
  }

  /**
   * Sanitize and validate score values
   */
  sanitizeScore(score: any, min: number = 0, max: number = 10): number {
    const num = typeof score === 'number' ? score : parseFloat(score);
    if (isNaN(num)) return 0;
    return Math.round(Math.min(Math.max(num, min), max) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Sanitize status values with whitelist
   */
  sanitizeStatus(status: any): string {
    const validStatuses = [
      'pending', 'initializing', 'scraping', 'analyzing',
      'tier1_analyzing', 'tier1_complete', 'tier2_analyzing',
      'tier2_complete', 'tier3_analyzing', 'completed', 'failed', 'generating_insights'
    ];

    const statusStr = String(status || '').toLowerCase();
    return validStatuses.includes(statusStr) ? statusStr : 'pending';
  }

  /**
   * Sanitize criterion names
   */
  sanitizeCriterion(criterion: any): string {
    const validCriteria = [
      'ux', 'trust', 'accessibility', 'seo', 'positioning', 
      'brand_story', 'ctas', 'speed'
    ];

    const criterionStr = String(criterion || '').toLowerCase();
    return validCriteria.includes(criterionStr) ? criterionStr : 'general';
  }

  /**
   * Sanitize progress detail messages
   */
  sanitizeProgressDetail(detail: any): string {
    if (!detail) return '';
    
    // Handle both string and object progress details
    if (typeof detail === 'object') {
      if (detail.message) {
        return this.sanitizeText(detail.message, 200);
      }
      // Convert object to string safely
      try {
        return this.sanitizeText(JSON.stringify(detail), 200);
      } catch {
        return 'Processing...';
      }
    }

    return this.sanitizeText(detail, 200);
  }

  /**
   * Sanitize AI insights for display
   */
  sanitizeInsight(insight: any): string {
    const sanitized = this.sanitizeText(insight, 2000);
    return sanitized || 'No insight available';
  }

  /**
   * Sanitize recommendations array
   */
  sanitizeRecommendations(recommendations: any): string[] {
    if (!Array.isArray(recommendations)) return [];

    return recommendations
      .filter(rec => rec != null)
      .map(rec => this.sanitizeText(rec, 500))
      .filter(rec => rec.length > 0)
      .slice(0, 10); // Limit to 10 recommendations
  }

  /**
   * Sanitize URLs for safe display and navigation
   */
  sanitizeUrl(url: any): string {
    if (!url || typeof url !== 'string') return '';

    try {
      const urlObj = new URL(url);
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return '';
      }

      // Remove potential XSS in query params
      urlObj.search = urlObj.search.replace(/[<>'"]/g, '');
      
      return urlObj.toString().substring(0, 500); // Reasonable URL length limit
    } catch {
      // Invalid URL, return empty string
      return '';
    }
  }

  /**
   * Sanitize complete effectiveness data object
   */
  sanitizeEffectivenessData(data: any): Partial<SanitizedDisplayData> {
    if (!data || typeof data !== 'object') return {};

    const sanitized: Partial<SanitizedDisplayData> = {};

    if (data.clientName !== undefined) {
      sanitized.clientName = this.sanitizeClientName(data.clientName);
    }
    
    if (data.score !== undefined) {
      sanitized.score = this.sanitizeScore(data.score);
    }
    
    if (data.status !== undefined) {
      sanitized.status = this.sanitizeStatus(data.status);
    }
    
    if (data.criterion !== undefined) {
      sanitized.criterion = this.sanitizeCriterion(data.criterion);
    }
    
    if (data.progressDetail !== undefined) {
      sanitized.progressDetail = this.sanitizeProgressDetail(data.progressDetail);
    }
    
    if (data.insight !== undefined) {
      sanitized.insight = this.sanitizeInsight(data.insight);
    }
    
    if (data.url !== undefined) {
      sanitized.url = this.sanitizeUrl(data.url);
    }

    return sanitized;
  }

  /**
   * Create safe display props for components
   */
  createSafeDisplayProps(data: any) {
    const sanitized = this.sanitizeEffectivenessData(data);
    
    return {
      ...sanitized,
      // Add display helpers
      displayScore: sanitized.score !== undefined 
        ? `${sanitized.score}/10` 
        : 'N/A',
      displayStatus: sanitized.status 
        ? sanitized.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : 'Unknown',
      displayProgress: sanitized.progressDetail || 'Processing...',
      hasValidData: Boolean(sanitized.clientName && sanitized.score !== undefined)
    };
  }
}

// Export singleton instance
export const dataSanitizer = DataSanitizer.getInstance();