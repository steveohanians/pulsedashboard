// Centralized shared utilities
// Consolidates common utility functions found across multiple frontend files

/**
 * Text formatting utilities
 * Consolidates text processing patterns found across components
 */
export const textUtils = {
  /**
   * Render text with bold formatting (JSX safe)
   * Consolidates bold text rendering patterns from multiple components
   */
  renderTextWithBold: (text: string, isRecommendation = false) => {
    if (!text) return null;
    
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <strong 
            key={index} 
            className={isRecommendation ? "text-blue-600 font-semibold" : "font-semibold"}
          >
            {boldText}
          </strong>
        );
      }
      return part;
    });
  },

  /**
   * Truncate text with ellipsis
   */
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * Capitalize first letter
   */
  capitalize: (text: string): string => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  /**
   * Convert snake_case to Title Case
   */
  snakeToTitle: (text: string): string => {
    return text.split('_').map(word => textUtils.capitalize(word)).join(' ');
  },
};

/**
 * Local storage utilities
 * Consolidates localStorage interaction patterns
 */
export const storageUtils = {
  /**
   * Get item from localStorage with type safety
   */
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  /**
   * Set item in localStorage with error handling
   */
  setItem: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },

  /**
   * Clear all localStorage items for the app
   */
  clearAppData: (prefix: string = 'pulse-dashboard-'): void => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Silently fail
    }
  },
};

/**
 * Number formatting utilities
 * Consolidates number formatting patterns from chart components
 */
export const numberUtils = {
  /**
   * Format number with appropriate precision
   */
  formatNumber: (value: number, decimals: number = 1): string => {
    return Number(value.toFixed(decimals)).toString();
  },

  /**
   * Format percentage values
   */
  formatPercentage: (value: number, decimals: number = 1): string => {
    return `${numberUtils.formatNumber(value, decimals)}%`;
  },

  /**
   * Format large numbers with K/M suffixes
   */
  formatLargeNumber: (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },

  /**
   * Format time duration (seconds to human readable)
   */
  formatDuration: (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  },
};

/**
 * Array utilities
 * Common array manipulation patterns
 */
export const arrayUtils = {
  /**
   * Remove duplicates from array
   */
  unique: <T>(array: T[]): T[] => {
    return [...new Set(array)];
  },

  /**
   * Group array by key
   */
  groupBy: <T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  /**
   * Chunk array into smaller arrays
   */
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Sort array by multiple criteria
   */
  sortBy: <T>(array: T[], ...sortFns: ((item: T) => any)[]): T[] => {
    return [...array].sort((a, b) => {
      for (const sortFn of sortFns) {
        const aVal = sortFn(a);
        const bVal = sortFn(b);
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
      }
      return 0;
    });
  },
};

/**
 * Date utilities
 * Common date formatting and manipulation
 */
export const dateUtils = {
  /**
   * Format date for display
   */
  formatDisplay: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  /**
   * Get relative time string
   */
  getRelativeTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  },

  /**
   * Check if date is within range
   */
  isWithinRange: (date: Date, startDate: Date, endDate: Date): boolean => {
    return date >= startDate && date <= endDate;
  },
};

/**
 * URL utilities
 * Common URL handling patterns
 */
export const urlUtils = {
  /**
   * Extract domain from URL
   */
  extractDomain: (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  },

  /**
   * Clean domain name for display
   */
  cleanDomain: (domain: string): string => {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  },

  /**
   * Validate URL format
   */
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Add protocol if missing
   */
  ensureProtocol: (url: string): string => {
    if (!url.match(/^https?:\/\//)) {
      return `https://${url}`;
    }
    return url;
  },
};

/**
 * Debounce utility
 * Consolidates debouncing patterns from search components
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Color utilities
 * Common color manipulation patterns
 */
export const colorUtils = {
  /**
   * Convert HSL to hex
   */
  hslToHex: (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  },

  /**
   * Generate random color
   */
  randomColor: (): string => {
    return `#${Math.floor(Math.random()*16777215).toString(16)}`;
  },

  /**
   * Check if color is light or dark
   */
  isLight: (hex: string): boolean => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  },
};