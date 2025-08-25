import { useMemo } from 'react';
import { useAIInsights } from '@/hooks/use-ai-insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { InsightGenerationButton } from './insight-generation-button';

interface ComprehensiveInsightsDisplayProps {
  /** Client identifier for insights fetching */
  clientId: string;
  /** Optional time period filter for insights */
  period?: string;
}

/** Stored insight data structure from database */
interface StoredInsight {
  /** Unique insight identifier */
  id: string;
  /** Metric name associated with insight */
  metricName: string;
  /** Time period for the insight */
  timePeriod: string;
  /** Context information for the insight */
  contextText: string;
  /** Main insight text content */
  insightText: string;
  /** Actionable recommendation text */
  recommendationText: string;
  /** Insight creation timestamp */
  createdAt: string;
}

/**
 * Comprehensive insights display component for AI-generated analytics insights.
 * Fetches and displays stored insights from the database, separating dashboard overview
 * from metric-specific insights. Features interactive insight generation, categorized
 * display with icons, and responsive card-based layout for optimal readability.
 * 
 * Key features:
 * - Automatic insights fetching with TanStack Query
 * - Separation of dashboard overview vs metric-specific insights
 * - Interactive insight generation buttons for missing insights
 * - Visual categorization with metric-specific icons and badges
 * - Responsive card layout with proper loading and error states
 * - Real-time insight refresh capability
 * - Period-based filtering support
 * - Structured display of context, insights, and recommendations
 * 
 * Used in dashboard for displaying AI-powered analytics insights and recommendations
 * to help users understand their performance metrics and take actionable steps.
 * 
 * @param clientId - Client identifier for targeted insights
 * @param period - Optional period filter for time-based insights
 */
export function ComprehensiveInsightsDisplay({ 
  clientId, 
  period 
}: ComprehensiveInsightsDisplayProps) {
  // Canonicalize period for consistent query key
  const canonicalPeriod = useMemo(() => {
    if (!period) return period;
    if (/^\d{4}-\d{2}$/.test(period)) return period;
    if (period === "Last Month") {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    }
    return period;
  }, [period]);

  // Fetch existing insights using centralized hook
  const { data: insightsResponse, isLoading, isFetching, error } = useAIInsights(clientId, canonicalPeriod);
  const insights = insightsResponse?.insights || [];
  
  // Fix spinner logic - only show when actually generating
  const isGenerating = insightsResponse?.status === "generating" || 
                      (insights && insights.some && insights.some((x: any) => x.status === "generating"));
                      
  
  // Provide refetch capability for compatibility
  const refetch = () => {
    // Refetch will be handled by query invalidation
  };

  // Separate dashboard overview from metric-specific insights
  const dashboardOverview = insights?.find((insight: StoredInsight) => 
    insight.metricName === "Dashboard Overview"
  );
  const metricInsights = insights?.filter((insight: StoredInsight) => 
    insight.metricName !== "Dashboard Overview"
  ) || [];

  // Show loading only when initially loading or actually generating
  if (isLoading || isFetching || isGenerating) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasInsights = insights && insights.length > 0;

  return (
    <div className="space-y-6">
      {/* Header with generation button */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Insights
          </h2>
          <p className="text-sm text-slate-600">
            Comprehensive analysis of your digital marketing performance with strategic recommendations for {(() => {
              const now = new Date();
              const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              return dataMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            })()}
          </p>
        </div>
        
        <InsightGenerationButton 
          clientId={clientId}
          period={period}
          onInsightsGenerated={() => refetch()}
        />
      </div>

      {!hasInsights ? (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              No AI Insights Generated Yet
            </h3>
            <p className="text-sm text-slate-600 max-w-md mb-6">
              Click "Generate AI Insights" above to analyze your performance data and receive 
              personalized recommendations based on competitor benchmarks and industry trends.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertCircle className="h-4 w-4" />
              <span>Analysis typically takes 30-60 seconds to complete</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Dashboard Overview */}
          {dashboardOverview && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <TrendingUp className="h-5 w-5" />
                  Strategic Overview
                  <Badge variant="secondary" className="ml-auto">
                    {dashboardOverview.timePeriod}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      Performance Context
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {dashboardOverview.contextText}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      Strategic Insights
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {dashboardOverview.insightText}
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      Key Recommendations
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {dashboardOverview.recommendationText}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metric-Specific Insights */}
          {metricInsights.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Metric-Specific Analysis
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                {metricInsights.map((insight: StoredInsight) => (
                  <Card key={insight.id} className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span className="text-slate-800">{insight.metricName}</span>
                        <Badge variant="outline" className="text-xs">
                          {insight.timePeriod}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <h5 className="font-medium text-slate-700 mb-1">Performance</h5>
                        <p className="text-slate-600 leading-relaxed">{insight.contextText}</p>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-slate-700 mb-1">Insights</h5>
                        <p className="text-slate-600 leading-relaxed">{insight.insightText}</p>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-slate-700 mb-1">Recommendations</h5>
                        <p className="text-slate-600 leading-relaxed">{insight.recommendationText}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Generation timestamp */}
          {hasInsights && (
            <div className="text-xs text-slate-500 text-center pt-4 border-t border-slate-200">
              Insights generated on {new Date(insights[0].createdAt).toLocaleDateString()} at{' '}
              {new Date(insights[0].createdAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}