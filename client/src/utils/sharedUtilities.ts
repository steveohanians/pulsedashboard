// Centralized shared utilities
// Consolidates common utility functions found across multiple frontend files

/**
 * Text formatting utilities
 */
export const textUtils = {
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
    return text.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  },
};

/**
 * Local storage utilities
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
  setItem: (key: string, value: unknown): boolean => {
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
};

/**
 * Unused utilities cleaned up - consolidation into chart-specific utils complete
 */
// Removed unused numberUtils - formatting consolidated in chartUtils.ts

// Removed unused arrayUtils - not used by any components

// Removed unused dateUtils - not used by any components

/**
 * URL utilities
 */
// Removed unused urlUtils - not used by any components

/**
 * Company utility functions
 */

/**
 * Get the appropriate company ID field based on source type
 */
export function getCompanyId(metric: any, sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'): string | null {
  switch (sourceType) {
    case 'Portfolio':
      return metric.cd_portfolio_company_id || metric.cdPortfolioCompanyId;
    case 'Competitor':
      return metric.competitor_id || metric.competitorId;
    case 'Benchmark':
      return metric.benchmark_company_id || metric.benchmarkCompanyId;
    default:
      return null;
  }
}

/**
 * Format company label based on type and domain
 */
export function formatCompanyLabel(company: any, sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'): string {
  if (sourceType === 'Portfolio') {
    return company.name || company.domain?.replace('https://', '').replace('http://', '') || 'Unknown';
  } else {
    return company.domain?.replace('https://', '').replace('http://', '') || company.name || 'Unknown';
  }
}

/**
 * General utilities moved from chartDataHelpers.ts for consolidation
 */

/**
 * Helper function to safely parse JSON values
 */
export function safeParseJSON(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clean domain names for display (remove protocols and www)
 */
export function cleanDomainName(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

/**
 * Debounce utility
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}