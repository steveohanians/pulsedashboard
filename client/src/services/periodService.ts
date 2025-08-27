/**
 * Period Service
 * Provides time period utilities for the frontend
 */

export interface PeriodMetadata {
  ga4Period: string;
  semrushPeriod: string;
  isAligned: boolean;
  warning?: string;
}

class PeriodService {
  getCurrentDataMonth(): string {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  }

  getSEMrushAvailablePeriod(currentMonth: string): string {
    // SEMrush typically has a delay, return one month back
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  getDisplayPeriod(period: string): string {
    if (period.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = period.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return period;
  }

  getPeriodMetadata(period: string): PeriodMetadata {
    const currentMonth = this.getCurrentDataMonth();
    const semrushMonth = this.getSEMrushAvailablePeriod(currentMonth);
    
    let ga4Period = currentMonth;
    let semrushPeriod = semrushMonth;
    
    if (period === 'Last Month') {
      ga4Period = currentMonth;
      semrushPeriod = semrushMonth;
    }
    
    const isAligned = ga4Period === semrushPeriod;
    const warning = !isAligned ? 'Data sources may not be fully aligned' : undefined;
    
    return {
      ga4Period,
      semrushPeriod,
      isAligned,
      warning
    };
  }
}

export const periodService = new PeriodService();