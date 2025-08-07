import { memo, useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardSkeleton } from './dashboard-skeleton';

// Lazy load heavy components  
const MetricInsightBox = lazy(() => import('./metric-insight-box'));

interface OptimizedDashboardProps {
  clientId: string;
  timePeriod: string;
  businessSize: string;
  industryVertical: string;
}

const OptimizedDashboard = memo(({ clientId, timePeriod, businessSize, industryVertical }: OptimizedDashboardProps) => {
  
  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => [
    `/api/dashboard/${clientId}?timePeriod=${encodeURIComponent(timePeriod)}&businessSize=${encodeURIComponent(businessSize)}&industryVertical=${encodeURIComponent(industryVertical)}`
  ], [clientId, timePeriod, businessSize, industryVertical]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

  // Load all AI insights once at dashboard level to prevent rate limiting
  const { data: insightsData, isLoading: insightsLoading, error: insightsError } = useQuery({
    queryKey: [`/api/insights/${clientId}`],
    enabled: !!clientId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1 // Reduce retries to prevent spam
  });
  
    loading: insightsLoading, 
    hasData: !!insightsData, 
    error: insightsError,
    clientId,
    rawData: insightsData 
  });
  
  // Always log insights debug to see what's happening
    loading: insightsLoading,
    error: insightsError,
    hasData: !!insightsData,
    dataType: typeof insightsData,
    dataKeys: insightsData ? Object.keys(insightsData) : null,
    fullData: insightsData
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-semibold text-red-600">Error loading dashboard</h2>
        <p className="text-gray-600 mt-2">Please try again later</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Prepare insights lookup for fast access
  const insightsLookup = useMemo(() => {
    // Handle both possible response formats: {insights: [...]} or direct array
    const insightsResponse = insightsData as any;
    const insights = insightsResponse?.insights || insightsResponse || [];
    const lookup: Record<string, any> = {};
    
      hasInsightsData: !!insightsData, 
      insightsCount: Array.isArray(insights) ? insights.length : 0,
      insightsPreview: insights.slice(0, 2),
      fullInsightsResponse: insightsData
    });
    
    if (Array.isArray(insights)) {
      insights.forEach((insight: any) => {
        lookup[insight.metricName] = insight;
      });
    }
    
    return lookup;
  }, [insightsData]);

  // Standard metrics to display
  const metrics = [
    'Session Duration',
    'Bounce Rate', 
    'Pages per Session',
    'Sessions per User',
    'Traffic Channels',
    'Device Distribution'
  ];

  return (
    <div className="p-6 space-y-6">
      <Suspense fallback={<div className="h-8 bg-gray-200 animate-pulse rounded" />}>
        <h1 className="text-2xl font-bold">
          Analytics Dashboard - {(data as any)?.client?.name || 'Loading...'}
        </h1>
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metricName, index) => (
          <Suspense key={metricName} fallback={
            <div className="h-[300px] bg-gray-200 animate-pulse rounded-lg" />
          }>
            <MetricInsightBox
              metricName={metricName}
              clientId={clientId}
              timePeriod={timePeriod}
              metricData={{
                metricName,
                clientValue: null,
                industryAverage: null,
                cdAverage: null,
                competitorValues: [],
                competitorNames: []
              }}
              preloadedInsight={insightsLookup[metricName]}
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
});

OptimizedDashboard.displayName = 'OptimizedDashboard';

export { OptimizedDashboard };