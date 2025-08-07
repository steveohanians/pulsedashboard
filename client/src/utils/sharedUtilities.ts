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