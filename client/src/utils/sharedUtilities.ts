// Shared utilities for frontend components

export const textUtils = {
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  capitalize: (text: string): string => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  // Convert snake_case to Title Case
  snakeToTitle: (text: string): string => {
    return text.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  },
};

export const storageUtils = {
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  setItem: (key: string, value: unknown): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};

// Clean domain names for display (remove protocols and www)
function cleanDomainName(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '');
}

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

export function formatCompanyLabel(company: any, sourceType: 'Portfolio' | 'Competitor' | 'Benchmark'): string {
  const cleanedDomain = company.domain ? cleanDomainName(company.domain) : null;
  
  if (sourceType === 'Portfolio') {
    return company.name || cleanedDomain || 'Unknown';
  } else {
    return cleanedDomain || company.name || 'Unknown';
  }
}

export function safeParseJSON(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Export the domain cleaner for external use
export { cleanDomainName };

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

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}