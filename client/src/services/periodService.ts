/**
 * Centralized Period Management Service
 * Handles all date/period logic for GA4 and SEMrush data alignment
 */

export class PeriodService {
  private static instance: PeriodService;

  static getInstance(): PeriodService {
    if (!this.instance) {
      this.instance = new PeriodService();
    }
    return this.instance;
  }

  /**
   * Get the current "Last Month" based on Pacific Time
   * This is the default period for dashboard data
   */
  getCurrentDataMonth(): string {
    const now = new Date();
    const ptFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit'
    });
    
    const ptParts = ptFormatter.formatToParts(now);
    const ptYear = parseInt(ptParts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
    const ptMonth = parseInt(ptParts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1));
    
    // Calculate last month
    const targetDate = new Date(ptYear, ptMonth - 2, 1); // -1 for 0-index, -1 for last month
    return this.toYYYYMM(targetDate);
  }

  /**
   * Get the period that SEMrush would have data for
   * SEMrush is typically 1 month behind GA4
   */
  getSEMrushAvailablePeriod(targetPeriod: string): string {
    const normalized = this.normalizePeriod(targetPeriod);
    const [year, month] = normalized.split('-').map(Number);
    
    // SEMrush is 1 month behind
    const semrushDate = new Date(year, month - 2, 1); // -1 for 0-index, -1 for delay
    return this.toYYYYMM(semrushDate);
  }

  /**
   * Convert any period format to canonical YYYY-MM format
   */
  normalizePeriod(period: string): string {
    // Handle "Last Month"
    if (period === 'Last Month') {
      return this.getCurrentDataMonth();
    }
    
    // Handle "Last Quarter"
    if (period === 'Last Quarter') {
      // For now, return the last month of the quarter
      return this.getCurrentDataMonth();
    }
    
    // Handle "Last Year" 
    if (period === 'Last Year') {
      // For now, return the last month
      return this.getCurrentDataMonth();
    }
    
    // Handle "2025-07-daily-01" format
    if (period.includes('-daily-')) {
      return period.substring(0, 7);
    }
    
    // Handle "2025-07-group-1" format
    if (period.includes('-group-')) {
      return period.substring(0, 7);
    }
    
    // Already in YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(period)) {
      return period;
    }
    
    // Custom date range - extract year and month from first date
    if (period.includes(' to ')) {
      // Format: "1/1/2025 to 1/31/2025"
      const firstDate = period.split(' to ')[0];
      const date = new Date(firstDate);
      if (!isNaN(date.getTime())) {
        return this.toYYYYMM(date);
      }
    }
    
    console.warn(`Unknown period format: ${period}, defaulting to current month`);
    return this.getCurrentDataMonth();
  }

  /**
   * Format a period for display in the UI
   */
  getDisplayPeriod(period: string): string {
    const normalized = this.normalizePeriod(period);
    const [year, month] = normalized.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }

  /**
   * Get period metadata for dashboard
   */
  getPeriodMetadata(targetPeriod: string): {
    ga4Period: string;
    semrushPeriod: string;
    displayPeriod: string;
    isAligned: boolean;
    warning?: string;
  } {
    const ga4Period = this.normalizePeriod(targetPeriod);
    const semrushPeriod = this.getSEMrushAvailablePeriod(targetPeriod);
    
    return {
      ga4Period,
      semrushPeriod,
      displayPeriod: this.getDisplayPeriod(ga4Period),
      isAligned: ga4Period === semrushPeriod,
      warning: ga4Period !== semrushPeriod 
        ? `Comparing ${this.getDisplayPeriod(ga4Period)} (Client) with ${this.getDisplayPeriod(semrushPeriod)} (Competitors)`
        : undefined
    };
  }

  /**
   * Convert date to YYYY-MM format
   */
  private toYYYYMM(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Check if we're in a new month (for cache invalidation)
   */
  isNewMonth(): boolean {
    const lastCheck = localStorage.getItem('lastMonthCheck');
    const currentMonth = this.getCurrentDataMonth();
    
    if (lastCheck !== currentMonth) {
      localStorage.setItem('lastMonthCheck', currentMonth);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const periodService = PeriodService.getInstance();