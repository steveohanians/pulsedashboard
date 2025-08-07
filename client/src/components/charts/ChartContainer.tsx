/**
 * Reusable chart container component for consistent layout and styling
 * Provides standardized chart wrapper with header, title, and filter display
 */
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Filter } from 'lucide-react';

interface ChartContainerProps {
  /** Chart title displayed in header */
  title: string;
  /** Chart content to render */
  children: ReactNode;
  /** Time period display text */
  periodDisplay?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show filter information */
  showFilters?: boolean;
  /** Current filter values to display */
  filters?: {
    businessSize: string;
    industryVertical: string;
  };
}

export function ChartContainer({
  title,
  children,
  periodDisplay,
  className = "",
  showFilters = true,
  filters
}: ChartContainerProps) {
  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold text-slate-800 mb-2">
          {title}
        </CardTitle>
        
        {/* Filter Information Display */}
        {showFilters && periodDisplay && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{periodDisplay}</span>
            </div>
            {filters && (
              <>
                {filters.businessSize !== "All" && (
                  <div className="flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    <span>{filters.businessSize}</span>
                  </div>
                )}
                {filters.industryVertical !== "All" && (
                  <div className="flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    <span>{filters.industryVertical}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}