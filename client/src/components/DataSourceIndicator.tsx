/**
 * Data Source Indicator Component
 * Shows which data sources are being used and their respective time periods
 */

import { Badge } from '@/components/ui/badge';
import { Info, AlertCircle, CheckCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DataSourceInfo {
  source: string;
  period: string;
  status: 'live' | 'delayed' | 'fallback';
}

interface DataSourceIndicatorProps {
  sources: DataSourceInfo[];
  compact?: boolean;
  className?: string;
}

export function DataSourceIndicator({ sources, compact = false, className = '' }: DataSourceIndicatorProps) {
  const getStatusIcon = (status: DataSourceInfo['status']) => {
    switch (status) {
      case 'live':
        return <CheckCircle className="h-3 w-3" />;
      case 'delayed':
        return <AlertCircle className="h-3 w-3" />;
      case 'fallback':
        return <Info className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: DataSourceInfo['status']) => {
    switch (status) {
      case 'live':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'delayed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fallback':
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-1 ${className}`}>
          {sources.map((source, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div className={`p-1 rounded border ${getStatusColor(source.status)}`}>
                  {getStatusIcon(source.status)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-medium">{source.source}</p>
                  <p className="text-gray-500">{source.period}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 text-xs ${className}`}>
      {sources.map((source, index) => (
        <Badge
          key={index}
          variant="outline"
          className={`flex items-center gap-1 px-2 py-0.5 ${getStatusColor(source.status)}`}
        >
          {getStatusIcon(source.status)}
          <span className="font-medium">{source.source}:</span>
          <span>{source.period}</span>
        </Badge>
      ))}
    </div>
  );
}

/**
 * Hook to generate data source information for a metric
 */
export function useDataSourceInfo(
  metricName: string,
  orchestratedData: any
): DataSourceInfo[] {
  if (!orchestratedData) return [];

  const sources: DataSourceInfo[] = [];
  const { periodMetadata } = orchestratedData;

  // Client data (GA4)
  if (orchestratedData.metrics[metricName]?.Client !== undefined) {
    sources.push({
      source: 'Client (GA4)',
      period: periodMetadata.displayPeriod,
      status: 'live'
    });
  }

  // Competitor data (SEMrush)
  if (orchestratedData.metrics[metricName]?.Competitor !== undefined) {
    const semrushDisplay = new Date(periodMetadata.semrushPeriod + '-01')
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    sources.push({
      source: 'Competitors',
      period: semrushDisplay,
      status: 'delayed'
    });
  }

  // Portfolio average (SEMrush)
  if (orchestratedData.metrics[metricName]?.CD_Avg !== undefined) {
    const semrushDisplay = new Date(periodMetadata.semrushPeriod + '-01')
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    sources.push({
      source: 'CD Avg',
      period: semrushDisplay,
      status: 'delayed'
    });
  }

  return sources;
}