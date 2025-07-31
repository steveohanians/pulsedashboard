// Reusable chart container component for consistent layout and styling
import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Filter } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  periodDisplay?: string;
  className?: string;
  showFilters?: boolean;
  filters?: {
    businessSize: string;
    industryVertical: string;
  };
}

export default function ChartContainer({
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