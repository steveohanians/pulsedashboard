// Shared utility functions
// Consolidates common patterns found across multiple components

/**
 * Safe JSON parsing utility
 * Centralizes the try/catch pattern for parsing potentially malformed JSON
 */
export function safeParseJSON<T = any>(value: string, fallback: T = [] as any): T {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Text formatting utility for AI responses
 * Consolidates the markdown bold text rendering found in multiple components
 */
export function renderTextWithBold(text: string, isRecommendation = false) {
  if (!text) return text;
  
  // Handle numbered list formatting for recommendations
  if (isRecommendation && text.includes('1.')) {
    // Clean up the text 
    let cleanText = text.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    
    // Split by numbered items using regex that looks for "number. " pattern
    const numberedItems = cleanText.split(/(?=\d+\.\s)/).filter(item => item.trim() && /^\d+\./.test(item.trim()));
    
    // If we found numbered items, render as a list
    if (numberedItems.length >= 2) {
      return (
        <ol className="space-y-3 text-xs sm:text-sm list-none">
          {numberedItems.map((item, index) => {
            const cleanItem = item.replace(/^\d+\.\s*/, '').trim();
            const parts = cleanItem.split(/(\*\*[^*]+\*\*)/g);
            return (
              <li key={index} className="flex items-start">
                <span className="font-semibold text-primary mr-3 flex-shrink-0 text-sm">{index + 1}.</span>
                <span className="leading-relaxed flex-1">
                  {parts.map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIndex} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }
  }
  
  // Default bold text rendering
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-slate-800">
          {boldText}
        </strong>
      );
    }
    return part;
  });
}

/**
 * Time-limited localStorage utility
 * Consolidates the pattern found in metric-insight-box.tsx for persistent storage with expiration
 */
export function createTimeBasedStorage<T>(storageKey: string, expirationUnit: 'day' | 'month' = 'month') {
  const getCurrentPeriod = () => {
    const now = new Date();
    if (expirationUnit === 'month') {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  return {
    save: (key: string, data: T) => {
      try {
        const stored = localStorage.getItem(storageKey);
        const allItems = stored ? JSON.parse(stored) : {};
        
        allItems[key] = {
          data,
          period: getCurrentPeriod(),
          timestamp: Date.now()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(allItems));
      } catch (error) {
        // Silent fail - localStorage not available
      }
    },

    load: (key: string): T | null => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return null;
        
        const allItems = JSON.parse(stored);
        const item = allItems[key];
        
        if (!item) return null;
        
        // Check if item is from current period
        const currentPeriod = getCurrentPeriod();
        if (item.period !== currentPeriod) {
          // Remove expired item
          delete allItems[key];
          localStorage.setItem(storageKey, JSON.stringify(allItems));
          return null;
        }
        
        return item.data;
      } catch (error) {
        return null;
      }
    },

    remove: (key: string) => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return;
        
        const allItems = JSON.parse(stored);
        delete allItems[key];
        
        localStorage.setItem(storageKey, JSON.stringify(allItems));
      } catch (error) {
        // Silent fail
      }
    }
  };
}

/**
 * Array deduplication utility
 * Generalizes the deduplication pattern found in chart processing
 */
export function deduplicateBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const map = new Map<K, T>();
  array.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

/**
 * Metric value formatting utility
 * Consolidates formatting logic found across chart components
 */
export function formatMetricValue(value: number, metricName: string): string {
  if (isPercentageMetric(metricName)) {
    return `${value.toFixed(1)}%`;
  }
  
  if (metricName === "Session Duration") {
    const minutes = Math.round((value / 60) * 10) / 10;
    return `${minutes} min`;
  }
  
  return value.toFixed(1);
}

/**
 * Check if a metric represents a percentage
 */
export function isPercentageMetric(metricName: string): boolean {
  return metricName.toLowerCase().includes('rate') || 
         metricName.toLowerCase().includes('percentage');
}

/**
 * Clean domain name utility
 * Removes protocol and www prefixes
 */
export function cleanDomainName(url: string): string {
  if (!url) return url;
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
}