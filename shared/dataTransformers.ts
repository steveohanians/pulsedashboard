// Consolidated data transformation utilities
// This eliminates duplicate transformation logic across frontend and backend

/**
 * Data sanitization utilities
 * Consolidates cleaning patterns from multiple files
 */
export class DataSanitizer {
  /**
   * Clean and normalize string inputs
   */
  static cleanString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-_.@]/g, '') // Remove special chars except common ones
      .substring(0, 500); // Limit length
  }

  /**
   * Clean email addresses
   */
  static cleanEmail(email: string): string {
    if (typeof email !== 'string') return '';
    
    return email
      .toLowerCase()
      .trim()
      .replace(/[^\w\-_.@]/g, '');
  }

  /**
   * Clean URLs
   */
  static cleanUrl(url: string): string {
    if (typeof url !== 'string') return '';
    
    let cleaned = url.trim().toLowerCase();
    
    // Add protocol if missing
    if (cleaned && !cleaned.match(/^https?:\/\//)) {
      cleaned = `https://${cleaned}`;
    }
    
    // Remove trailing slash
    if (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    
    return cleaned;
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string {
    try {
      const urlObj = new URL(this.cleanUrl(url));
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  /**
   * Sanitize HTML content
   */
  static sanitizeHtml(html: string): string {
    if (typeof html !== 'string') return '';
    
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gmi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gmi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gmi, '')
      .replace(/<embed\b[^>]*>/gmi, '')
      .replace(/javascript:/gmi, '')
      .replace(/vbscript:/gmi, '')
      .replace(/on\w+\s*=/gmi, '');
  }
}

/**
 * Number formatting utilities
 * Consolidates formatting patterns from chart components
 */
export class NumberFormatter {
  /**
   * Format number with appropriate precision
   */
  static format(value: number, decimals: number = 1): string {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    return Number(value.toFixed(decimals)).toString();
  }

  /**
   * Format as percentage
   */
  static percentage(value: number, decimals: number = 1): string {
    return `${this.format(value, decimals)}%`;
  }

  /**
   * Format large numbers with K/M suffixes
   */
  static compact(value: number): string {
    if (typeof value !== 'number' || isNaN(value)) return '0';
    
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  }

  /**
   * Format duration from seconds
   */
  static duration(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '0s';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  }

  /**
   * Format currency
   */
  static currency(value: number, currency: string = 'USD'): string {
    if (typeof value !== 'number' || isNaN(value)) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(value);
  }
}

/**
 * Date formatting utilities
 * Consolidates date handling patterns
 */
export class DateFormatter {
  /**
   * Format date for display
   */
  static display(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format date and time for display
   */
  static displayDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  static relative(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    
    return this.display(dateObj);
  }

  /**
   * Format period from YYYY-MM format
   */
  static periodLabel(period: string): string {
    const [year, month] = period.split('-');
    if (!year || !month) return period;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const shortYear = year.slice(-2);
    const monthIndex = parseInt(month) - 1;
    
    if (monthIndex < 0 || monthIndex >= 12) return period;
    
    return `${monthNames[monthIndex]} ${shortYear}`;
  }

  /**
   * Get Pacific Time date
   */
  static pacificTime(date: Date = new Date()): Date {
    return new Date(date.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  }
}

/**
 * Array transformation utilities
 * Consolidates array processing patterns
 */
export class ArrayTransformer {
  /**
   * Group array by key
   */
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * Deduplicate array by key
   */
  static deduplicateBy<T>(array: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Sort array by multiple criteria
   */
  static sortBy<T>(array: T[], ...sortFns: Array<(item: T) => unknown>): T[] {
    return [...array].sort((a, b) => {
      for (const sortFn of sortFns) {
        const aVal = sortFn(a);
        const bVal = sortFn(b);
        
        // Safe comparison with type checking
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
        } else {
          // Fallback to string comparison
          const aStr = String(aVal);
          const bStr = String(bVal);
          if (aStr < bStr) return -1;
          if (aStr > bStr) return 1;
        }
      }
      return 0;
    });
  }

  /**
   * Chunk array into smaller arrays
   */
  static chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Calculate average of numeric array
   */
  static average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return sum / numbers.length;
  }

  /**
   * Find median of numeric array
   */
  static median(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    
    return sorted[mid];
  }
}

/**
 * Object transformation utilities
 * Consolidates object processing patterns
 */
export class ObjectTransformer {
  /**
   * Deep clone object
   */
  static clone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as T;
    if (obj instanceof Array) return obj.map(this.clone) as T;
    
    const cloned = {} as T;
    for (const key in obj as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (cloned as Record<string, unknown>)[key] = this.clone((obj as Record<string, unknown>)[key]);
      }
    }
    return cloned;
  }

  /**
   * Pick specific keys from object
   */
  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }

  /**
   * Omit specific keys from object
   */
  static omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = { ...obj } as any;
    keys.forEach(key => {
      delete result[key];
    });
    return result;
  }

  /**
   * Convert object values using transformer function
   */
  static mapValues<T, U>(obj: Record<string, T>, fn: (value: T, key: string) => U): Record<string, U> {
    const result: Record<string, U> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = fn(value, key);
    }
    return result;
  }

  /**
   * Flatten nested object with dot notation
   */
  static flatten(obj: any, prefix: string = ''): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const key in obj) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        Object.assign(result, this.flatten(obj[key], newKey));
      } else {
        result[newKey] = obj[key];
      }
    }
    
    return result;
  }
}