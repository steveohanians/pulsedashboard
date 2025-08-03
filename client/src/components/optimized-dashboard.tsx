import { memo, useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardSkeleton } from './dashboard-skeleton';

// Lazy load heavy components
const MetricInsightBox = lazy(() => import('./metric-insight-box'));
const PerformanceChart = lazy(() => import('./performance-chart'));

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

  return (
    <div className="p-6 space-y-6">
      <Suspense fallback={<div className="h-8 bg-gray-200 animate-pulse rounded" />}>
        <h1 className="text-2xl font-bold">
          Analytics Dashboard - {data.client?.name}
        </h1>
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.insights?.map((insight, index) => (
          <Suspense key={insight.metricName} fallback={
            <div className="h-[300px] bg-gray-200 animate-pulse rounded-lg" />
          }>
            <MetricInsightBox
              insight={insight}
              data={data}
              index={index}
            />
          </Suspense>
        ))}
      </div>
    </div>
  );
});

OptimizedDashboard.displayName = 'OptimizedDashboard';

export { OptimizedDashboard };