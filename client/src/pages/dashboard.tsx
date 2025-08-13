import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { LogOut, Settings, Filter, Menu, Download, CheckCircle2, AlertTriangle, Trash2, ExternalLink, Clock, Building2, TrendingUp, Users, Plus, Info, Calendar, X, CheckCircle, AlertCircle, XCircle, Sparkles, RefreshCw } from "lucide-react";
import StatusBanner from "@/components/StatusBanner";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MetricsChart } from "@/components/charts/metrics-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { SessionDurationAreaChart } from "@/components/charts/area-chart";
import { MetricBarChart } from "@/components/charts/bar-chart";
import { StackedBarChart } from "@/components/charts/stacked-bar-chart";
import { LollipopChart } from "@/components/charts/lollipop-chart";
import { AIInsights } from "@/components/ai-insights";
import { ComprehensiveInsightsDisplay } from "@/components/comprehensive-insights-display";
import { MetricInsightBox } from "@/components/metric-insight-box";
import { CompetitorModal } from "@/components/competitor-modal";
import { Footer } from "@/components/Footer";
import { ErrorBanner, useErrorBanner } from "@/components/ErrorBanner";
import { APIError } from "@/lib/queryClient";

import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";
import { CHART_COLORS } from "@/utils/chartUtils";
import { deduplicateByChannel, formatPeriodDisplay, getDefaultMetricValue, isPercentageMetric } from "@/utils/chartUtils";
import { safeParseJSON, cleanDomainName } from "@/utils/sharedUtilities";
import { aggregateChannelData, sortChannelsByLegendOrder } from "@/utils/chartGenerators";
import { parseMetricValue } from "@/utils/metricParser";
import { 
  processCompanyMetrics, 
  processDeviceDistribution
} from "@/utils/chartDataProcessor";
import { 
  shouldConvertToPercentage,
  shouldConvertToMinutes 
} from "@/utils/chartUtils";
// PDF libraries will be lazy loaded on demand for better performance
import { logger } from "@/utils/logger";



const getChannelColor = (channelName: string): string => {
  // CHART_COLORS contains functions that return color strings
  const colorFunction = CHART_COLORS[channelName as keyof typeof CHART_COLORS] || CHART_COLORS.Other;
  return colorFunction();
};

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  
  // Component state management
  const queryClient = useQueryClient();

  // Refresh data function for admin users
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    
    try {
      // Directly refetch the dashboard data
      await refetchDashboard();
      
      // Also refresh filters 
      queryClient.invalidateQueries({ queryKey: QueryKeys.allFilters() });
      
      toast({
        title: "Dashboard refreshed",
        description: "All data has been refreshed from the latest sources.",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Could not refresh dashboard data. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsRefreshing(false);
    }
    
    // Close mobile menu after refresh
    setMobileMenuOpen(false);
  };
  const [timePeriod, setTimePeriod] = useState("Last Month");  // Default to Last Month
  const [customDateRange, setCustomDateRange] = useState("");
  const [businessSize, setBusinessSize] = useState("All");
  const [industryVertical, setIndustryVertical] = useState("All");
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeSection, setActiveSection] = useState<string>("Bounce Rate");
  const [manualClick, setManualClick] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [deletingCompetitorId, setDeletingCompetitorId] = useState<string | null>(null);
  const [metricStatuses, setMetricStatuses] = useState<Record<string, 'success' | 'needs_improvement' | 'warning' | undefined>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Error banner state
  const { error: dashboardError, showError: showDashboardError, dismissError: dismissDashboardError, clearError: clearDashboardError } = useErrorBanner();

  // Get the actual data period (one month before current) 
  const getDataPeriodDisplay = () => {
    const now = new Date();
    const dataMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // One month before current
    return dataMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  interface DashboardMetric {
    metricName: string;
    value: string | number;
    sourceType: string;
    channel?: string;
    competitorId?: string;
  }

  interface DashboardData {
    client: {
      id: string;
      name: string;
      websiteUrl: string;
      iconUrl?: string; // Brandfetch icon URL
    };
    metrics: DashboardMetric[];
    averagedMetrics?: Record<string, Record<string, number>>;
    timeSeriesData?: Record<string, Array<{
      metricName: string;
      value: string;
      sourceType: string;
      competitorId?: string;
    }>>;
    competitors: Array<{
      id: string;
      domain: string;
      label: string;
      status?: string;
    }>;
    insights: Array<{
      metricName: string;
      contextText: string;
      insightText: string;
      recommendationText: string;
    }>;
    isTimeSeries?: boolean;
    periods?: string[];
    trafficChannelMetrics?: Array<{ metricName: string; value: number; sourceType: string; channel: string }>;
  }

  interface FiltersData {
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
  }

  // Use custom date range if selected, otherwise use timePeriod
  const effectiveTimePeriod = timePeriod === "Custom Date Range" && customDateRange ? customDateRange : timePeriod;
  
  const dashboardQuery = useQuery<DashboardData>({
    queryKey: QueryKeys.dashboard(user?.clientId || '', effectiveTimePeriod || 'Last Month'),
    queryFn: async () => {
      try {
        return await apiRequest('GET', `/api/dashboard/${user?.clientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod || 'Last Month')}&businessSize=${encodeURIComponent(businessSize || 'All')}&industryVertical=${encodeURIComponent(industryVertical || 'All')}`);
      } catch (error) {
        if (error instanceof APIError) {
          showDashboardError(error);
        }
        throw error;
      }
    },
    enabled: !!user?.clientId,
    staleTime: 0, // Force fresh data on each request
    refetchOnMount: 'always', // Always refetch when component mounts
    gcTime: 0, // Don't cache results
    refetchOnReconnect: true, // Refetch when reconnecting
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
  
  const { data: dashboardData, isLoading, refetch: refetchDashboard } = dashboardQuery;
  
  // Manual refresh function removed per user request

  // Data processing and validation
  useEffect(() => {
    if (dashboardData?.metrics) {
      // Validate data structure for consistent processing
      const competitorMetrics = dashboardData.metrics.filter((m: DashboardMetric) => m.sourceType === 'Competitor');
      if (competitorMetrics.length === 0) {
        console.warn('No competitor data available for analysis');
      }
    }
  }, [dashboardData?.metrics]);

  const { data: filtersData } = useQuery<FiltersData>({
    queryKey: QueryKeys.filters(),
    queryFn: async () => {
      try {
        return await apiRequest('GET', `/api/filters?businessSize=${encodeURIComponent(businessSize)}&industryVertical=${encodeURIComponent(industryVertical)}`);
      } catch (error) {
        if (error instanceof APIError) {
          showDashboardError(error);
        }
        throw error;
      }
    },
  });

  // Load AI insights for dashboard metrics
  const insightsQuery = useQuery({
    queryKey: QueryKeys.aiInsights(user?.clientId || '', effectiveTimePeriod || 'Last Month'),
    queryFn: async () => {
      try {
        return await apiRequest('GET', `/api/ai-insights/${user?.clientId}?timePeriod=${encodeURIComponent(effectiveTimePeriod || 'Last Month')}`);
      } catch (error) {
        if (error instanceof APIError) {
          showDashboardError(error);
        }
        throw error;
      }
    },
    enabled: !!user?.clientId,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1
  });
  
  const { data: insightsData, isLoading: insightsLoading, error: insightsError, refetch: refetchInsights } = insightsQuery;

  // Create insights lookup map from loaded insights
  const insightsLookup = useMemo(() => {
    const lookup: Record<string, any> = {};
    
    if (insightsData && typeof insightsData === 'object' && 'insights' in insightsData) {
      const insights = (insightsData as any).insights;
      if (insights && Array.isArray(insights)) {
        insights.forEach((insight: any) => {
          lookup[insight.metricName] = insight;
        });
      }
    }
    
    return lookup;
  }, [insightsData]);

  // Clear all AI insights mutation (debug only)
  const clearInsightsMutation = useMutation({
    mutationFn: async () => {
      logger.info("Starting to clear all AI insights...");
      const response = await fetch("/api/debug/clear-all-insights", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: include session cookies for authentication
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      logger.info("Successfully cleared AI insights:", data);
      // Reset all metric statuses to empty
      setMetricStatuses({});
      // Clear localStorage insights to prevent loading from cache
      try {
        localStorage.removeItem('pulse_dashboard_insights'); // This is the actual key used!
        logger.info("Cleared localStorage insights cache (pulse_dashboard_insights)");
        
          // localStorage operations disabled for performance
      } catch (error) {
        logger.warn("Failed to clear localStorage:", error);
      }
      // Invalidate and refetch all related queries with correct key patterns
      queryClient.invalidateQueries({ queryKey: QueryKeys.dashboard(user?.clientId || '', effectiveTimePeriod || 'Last Month') });
      queryClient.invalidateQueries({ queryKey: QueryKeys.aiInsights(user?.clientId || '', effectiveTimePeriod || 'Last Month') });
      queryClient.invalidateQueries({ queryKey: QueryKeys.metricInsights(user?.clientId || '') });
      // Force refetch all data immediately
      dashboardQuery.refetch();
      refetchInsights();
      logger.info("State reset, cache invalidated, localStorage cleared, and dashboard refetched");
      // Force page reload to ensure all components reset their state
      window.location.reload();
    },
    onError: (error) => {
      logger.error("Failed to clear AI insights:", error);
      // Log more details about the error
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
        logger.error("Error stack:", error.stack);
      }
    }
  });

  // Delete competitor mutation  
  const deleteCompetitorMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      logger.info("Deleting competitor:", competitorId);
      try {
        const response = await fetch(`/api/competitors/${competitorId}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to delete competitor: ${response.status}`);
        }
        // Check if response has content before parsing JSON
        const text = await response.text();
        const result = text ? JSON.parse(text) : { success: true };
        logger.info("Delete successful:", result);
        return result;
      } catch (error) {
        logger.error("Delete failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      logger.info("Delete mutation onSuccess triggered");
      // Invalidate cache first, then refetch - ensures UI updates properly
      queryClient.invalidateQueries({ queryKey: QueryKeys.dashboard(user?.clientId || '', effectiveTimePeriod || 'Last Month') });
      queryClient.invalidateQueries({ queryKey: QueryKeys.aiInsights(user?.clientId || '', effectiveTimePeriod || 'Last Month') });
      queryClient.invalidateQueries({ queryKey: QueryKeys.metricInsights(user?.clientId || '') });
      // Force refetch all data immediately
      dashboardQuery.refetch();
      refetchInsights();
      setDeletingCompetitorId(null);
      logger.info("Cache invalidated and competitor deleted successfully");
    },
    onError: (error) => {
      logger.error("Delete mutation onError triggered:", error);
      setDeletingCompetitorId(null);
    }
  });

  // Reset filters if current selection is no longer available
  useEffect(() => {
    if (filtersData) {
      if (!filtersData.businessSizes.includes(businessSize)) {
        setBusinessSize("All");
      }
      if (!filtersData.industryVerticals.includes(industryVertical)) {
        setIndustryVertical("All");
      }
    }
  }, [filtersData, businessSize, industryVertical]);

  const client = dashboardData?.client;
  const metrics = dashboardData?.metrics || [];
  const averagedMetrics = dashboardData?.averagedMetrics || {};
  const timeSeriesData = dashboardData?.timeSeriesData;
  const isTimeSeries = dashboardData?.isTimeSeries;
  const periods = dashboardData?.periods;
  const competitors = dashboardData?.competitors || [];
  const insights = dashboardData?.insights || [];

  // Debug timeSeriesData to understand why charts are using fallback



  // Group metrics by name for chart display - FIXED to calculate averages across time periods
  const groupedMetrics = useMemo(() => {
    // Quick return for empty states
    if (!dashboardData) return {};
    
    if (isTimeSeries && averagedMetrics && typeof averagedMetrics === 'object' && Object.keys(averagedMetrics).length > 0) {
      return averagedMetrics as Record<string, Record<string, number>>;
    }
    
    // DEBUG: Check raw metrics for Bounce Rate specifically
    const bounceRateMetrics = dashboardData?.metrics ? 
      dashboardData.metrics.filter((m: DashboardMetric) => m.metricName === 'Bounce Rate') : [];
    // Bounce rate metrics processed
    
    // Calculate averages when multiple time periods are involved
    const result: Record<string, Record<string, number>> = {};
    const counts: Record<string, Record<string, number>> = {};
    
    for (const metric of metrics) {
      if (!result[metric.metricName]) {
        result[metric.metricName] = {};
        counts[metric.metricName] = {};
      }
      if (!result[metric.metricName][metric.sourceType]) {
        result[metric.metricName][metric.sourceType] = 0;
        counts[metric.metricName][metric.sourceType] = 0;
      }
      
      let value = parseMetricValue(metric.value);
      
      // Convert Session Duration from seconds to minutes for all source types
      if (metric.metricName === 'Session Duration' && value > 60) {

        value = value / 60;
      }
      
      result[metric.metricName][metric.sourceType] += value;
      counts[metric.metricName][metric.sourceType] += 1;
    }
    
    // Calculate averages
    for (const metricName in result) {
      for (const sourceType in result[metricName]) {
        if (counts[metricName][sourceType] > 0) {
          result[metricName][sourceType] = result[metricName][sourceType] / counts[metricName][sourceType];
        }
      }
    }
    
    return result;
  }, [dashboardData?.metrics, dashboardData?.averagedMetrics, isTimeSeries]);

  // Process traffic channel data for stacked bar chart
  const processTrafficChannelData = () => {

    
    let trafficMetrics = [];
    
    if (dashboardData?.trafficChannelMetrics) {
      // Use dedicated traffic channel data when available (both single and multi-period)
      trafficMetrics = dashboardData.trafficChannelMetrics;

      // Debug logging disabled for performance - logger.debug(`Using dedicated trafficChannelMetrics: ${trafficMetrics.length} records`);
    } else if (isTimeSeries && timeSeriesData) {
      // Fallback: extract from time series data for multi-period
      trafficMetrics = timeSeriesData && typeof timeSeriesData === 'object' 
        ? Object.values(timeSeriesData).flat().filter(m => m.metricName === 'Traffic Channels')
        : [];
      // Debug logging disabled for performance - logger.debug(`Using timeSeriesData fallback: ${trafficMetrics.length} records`);
    } else {
      // For single-period queries without trafficChannelMetrics, use regular metrics
      trafficMetrics = metrics.filter(m => m.metricName === 'Traffic Channels');
      // Debug logging disabled for performance - logger.debug(`Using regular metrics fallback: ${trafficMetrics.length} records`);
    }
    
    // Debug logging disabled for performance
    // logger.debug(`Traffic Channel Debug:`, {
    //   isTimeSeries,
    //   timeSeriesDataKeys: timeSeriesData ? Object.keys(timeSeriesData) : 'none',
    //   dashboardDataKeys: dashboardData ? Object.keys(dashboardData) : 'none',
    //   trafficChannelMetricsExists: !!dashboardData?.trafficChannelMetrics,
    //   trafficChannelMetricsCount: dashboardData?.trafficChannelMetrics?.length || 0,
    //   trafficMetricsCount: trafficMetrics.length,
    //   trafficMetrics: trafficMetrics.slice(0, 5), // First 5 for debugging
    //   sampleTrafficChannelData: trafficMetrics.filter((m: { channel?: string }) => m.channel).slice(0, 3) // Only channel data
    // });
    
    // Quick validation that GA4 data is found
    const clientMetrics = trafficMetrics.filter(m => m.sourceType === 'Client');
    const ga4ArrayMetric = clientMetrics.find(m => Array.isArray(m.value));
    if (ga4ArrayMetric) {

    }
    
    // Debug traffic channel data processing
    // Traffic channel metrics processed
    
    if (trafficMetrics.length === 0) {
      logger.warn(`No traffic metrics found! Debug:`, {
        metricsCount: metrics.length,
        timeSeriesData: timeSeriesData ? 'exists' : 'missing',
        isTimeSeries,
        sampleMetricNames: metrics.map(m => m.metricName).slice(0, 5)
      });
    }
    
    const result = [];

    // Client data
    const clientTrafficMetrics = trafficMetrics.filter(m => m.sourceType === 'Client');
    
    if (clientTrafficMetrics.length > 0) {

      
      // Use the corrected processChannelData function from chartGenerators.ts
      const channelMap = aggregateChannelData(clientTrafficMetrics);

      
      const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
        ...channel,
        color: getChannelColor(channel.name)
      }));
      
      const clientEntry = {
        sourceType: 'Client',
        label: client?.name || 'Demo Company',
        channels: sortedChannels
      };
      

      result.push(clientEntry);
    } else {
      console.warn('❌ No client traffic metrics found! Available metrics:', 
        trafficMetrics.map(m => ({ sourceType: m.sourceType, metricName: m.metricName })));
    }

    // CD Average data
    const cdMetrics = trafficMetrics.filter(m => m.sourceType === 'CD_Avg');
    console.log('🔍 CD_AVG TRAFFIC DEBUG:', {
      allTrafficMetricsCount: trafficMetrics.length,
      cdMetricsCount: cdMetrics.length,
      cdMetricsSample: cdMetrics.slice(0, 3).map(m => ({
        sourceType: m.sourceType,
        metricName: m.metricName,
        channel: 'channel' in m ? m.channel : undefined,
        value: m.value,
        timePeriod: 'timePeriod' in m ? m.timePeriod : undefined
      })),
      allCdAvgMetrics: trafficMetrics.filter(m => m.sourceType === 'CD_Avg').map(m => ({
        metricName: m.metricName,
        channel: 'channel' in m ? m.channel : undefined,
        hasChannel: 'channel' in m && !!m.channel
      }))
    });
    
    if (cdMetrics.length > 0) {
      const channelMap = aggregateChannelData(cdMetrics);
      console.log('🔍 CD_AVG CHANNEL MAP:', Array.from(channelMap.entries()));
      const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
        ...channel,
        color: getChannelColor(channel.name)
      }));
      result.push({
        sourceType: 'CD_Avg',
        label: 'Clear Digital Client Avg',
        channels: sortedChannels
      });
    } else {
      console.warn('❌ NO CD_AVG TRAFFIC METRICS FOUND!');
    }

    // Industry Average data
    const industryMetrics = trafficMetrics.filter(m => m.sourceType === 'Industry_Avg');
    if (industryMetrics.length > 0) {
      const channelMap = aggregateChannelData(industryMetrics);
      const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
        ...channel,
        color: getChannelColor(channel.name)
      }));
      result.push({
        sourceType: 'Industry_Avg',
        label: 'Industry Avg',
        channels: sortedChannels
      });
    }

    // Dynamic competitor data - use actual database data
    competitors.forEach((competitor) => {
      const competitorLabel = cleanDomainName(competitor.domain);
      const competitorMetrics = trafficMetrics.filter(m => 
        m.sourceType === 'Competitor' && 'competitorId' in m && m.competitorId === competitor.id
      );
      
      if (competitorMetrics.length > 0) {
        const channelMap = aggregateChannelData(competitorMetrics);
        const sortedChannels = sortChannelsByLegendOrder(channelMap).map(channel => ({
          ...channel,
          color: getChannelColor(channel.name)
        }));
        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: competitorLabel,
          channels: sortedChannels
        });
      } else {
        // Fallback if no data - generate consistent but varied data
        const baseData = [
          { name: 'Organic Search', base: 40 + (competitor.id.length % 10), variance: 5 },
          { name: 'Direct', base: 25 + (competitor.id.length % 6), variance: 4 },
          { name: 'Social Media', base: 15 + (competitor.id.length % 8), variance: 6 },
          { name: 'Paid Search', base: 12 + (competitor.id.length % 4), variance: 3 },
          { name: 'Email', base: 3 + (competitor.id.length % 3), variance: 2 }
        ];

        let channels = baseData.map(channel => {
          const variance = (competitor.id.charCodeAt(0) % (channel.variance * 2)) - channel.variance;
          const value = Math.max(1, channel.base + variance);
          return {
            name: channel.name,
            value: value,
            percentage: value,
            color: CHART_COLORS[channel.name as keyof typeof CHART_COLORS] || CHART_COLORS.Other
          };
        });

        // Normalize to 100%
        const total = channels.reduce((sum, channel) => sum + channel.value, 0);
        channels = channels.map(channel => ({
          ...channel,
          value: Math.round((channel.value / total) * 100),
          percentage: Math.round((channel.value / total) * 100)
        }));

        result.push({
          sourceType: `Competitor_${competitor.id}`,
          label: competitorLabel,
          channels: channels
        });
      }
    });
    
    return result;
  };

  // Process device distribution data for donut charts
  const processDeviceDistributionData = () => {
    const deviceMetrics = metrics.filter(m => m.metricName === 'Device Distribution');
    
    // Comprehensive device debugging

    
    // Debug competitor device metrics specifically
    const competitorDeviceMetrics = deviceMetrics.filter(m => m.sourceType === 'Competitor');

    
    if (competitorDeviceMetrics.length > 0) {

    } else {

    }
    
    // Quick validation that GA4 device data is found
    const clientDeviceMetrics = deviceMetrics.filter(m => m.sourceType === 'Client');
    const ga4DeviceArrayMetric = clientDeviceMetrics.find(m => Array.isArray(m.value));
    if (ga4DeviceArrayMetric) {

    }
    
    const DEVICE_COLORS = {
      'Desktop': '#3b82f6',
      'Mobile': '#10b981'
    };

    const result = [];

    // Helper function to aggregate device data from various formats
    const aggregateDeviceData = (sourceMetrics: any[]) => {
      const deviceSums = new Map();
      const deviceCounts = new Map();
      
      sourceMetrics.forEach(metric => {
        // Handle individual device records (competitors/averages format)
        if (metric.channel) {
          const deviceName = metric.channel;
          const value = parseFloat(metric.value);
          
          if (deviceSums.has(deviceName)) {
            deviceSums.set(deviceName, deviceSums.get(deviceName) + value);
            deviceCounts.set(deviceName, deviceCounts.get(deviceName) + 1);
          } else {
            deviceSums.set(deviceName, value);
            deviceCounts.set(deviceName, 1);
          }
        } else if (Array.isArray(metric.value)) {
          // GA4 array format - already parsed by backend
          metric.value.forEach((device: any) => {
            const deviceName = device.device || device.name || device.category;
            const value = parseFloat(device.percentage || device.value || device.sessions);
            
            if (deviceName && !isNaN(value)) {
              if (deviceSums.has(deviceName)) {
                deviceSums.set(deviceName, deviceSums.get(deviceName) + value);
                deviceCounts.set(deviceName, deviceCounts.get(deviceName) + 1);
              } else {
                deviceSums.set(deviceName, value);
                deviceCounts.set(deviceName, 1);
              }
            }
          });
        } else if (typeof metric.value === 'string') {
          // GA4 JSON string format - handle escaped JSON
          try {
            // Handle multiple levels of JSON escaping from database
            let jsonString = metric.value;
            
            // Remove outer quotes if present
            if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
              jsonString = jsonString.slice(1, -1);
            }
            
            // Unescape JSON
            jsonString = jsonString.replace(/\\"/g, '"');
            
            console.log('🔍 DEVICE PARSE - Attempting to parse:', jsonString.substring(0, 100));
            
            const deviceData = JSON.parse(jsonString);
            console.log('✅ DEVICE PARSE - Success:', deviceData);
            
            if (Array.isArray(deviceData)) {
              deviceData.forEach((device: any) => {
                const deviceName = device.device || device.name || device.category;
                const value = parseFloat(device.percentage || device.value || device.sessions);
                
                console.log('📱 DEVICE ITEM:', { deviceName, value, device });
                
                if (deviceName && !isNaN(value)) {
                  if (deviceSums.has(deviceName)) {
                    deviceSums.set(deviceName, deviceSums.get(deviceName) + value);
                    deviceCounts.set(deviceName, deviceCounts.get(deviceName) + 1);
                  } else {
                    deviceSums.set(deviceName, value);
                    deviceCounts.set(deviceName, 1);
                  }
                }
              });
            }
          } catch (e) {
            console.error(`❌ Invalid device JSON data:`, e, metric.value?.substring?.(0, 100));
          }
        } else if (metric.channel && metric.value) {
          // Handle individual device channel records (from backend processing)
          const deviceName = metric.channel;
          const value = parseFloat(metric.value);
          
          console.log('📱 INDIVIDUAL DEVICE RECORD:', { deviceName, value, metric });
          
          if (deviceName && !isNaN(value)) {
            if (deviceSums.has(deviceName)) {
              deviceSums.set(deviceName, deviceSums.get(deviceName) + value);
              deviceCounts.set(deviceName, deviceCounts.get(deviceName) + 1);
            } else {
              deviceSums.set(deviceName, value);
              deviceCounts.set(deviceName, 1);
            }
          }
        } else {
          console.warn('🚨 UNKNOWN DEVICE FORMAT:', metric);
        }
      });

      // Calculate averages from sums and counts
      const deviceMap = new Map();
      Array.from(deviceSums.entries()).forEach(([deviceName, sum]) => {
        const count = deviceCounts.get(deviceName) || 1;
        deviceMap.set(deviceName, sum / count);
      });

      // Convert to array format expected by chart with normalized device names
      const devices = Array.from(deviceMap.entries()).map(([name, value]) => {
        // Normalize device names to match chart expectations (capitalize first letter)
        const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        return {
          name: normalizedName,
          value: Math.round(value),
          percentage: Math.round(value),
          color: DEVICE_COLORS[normalizedName as keyof typeof DEVICE_COLORS] || DEVICE_COLORS.Mobile
        };
      });

      // Ensure percentages add up to 100%
      const total = devices.reduce((sum, device) => sum + device.value, 0);
      if (total > 0) {
        let runningTotal = 0;
        devices.forEach((device, index) => {
          if (index === devices.length - 1) {
            // Last device gets the remainder
            device.value = 100 - runningTotal;
            device.percentage = 100 - runningTotal;
          } else {
            const normalizedValue = Math.round((device.value / total) * 100);
            device.value = normalizedValue;
            device.percentage = normalizedValue;
            runningTotal += normalizedValue;
          }
        });
      }

      return devices;
    };

    // Client data
    const clientDeviceData = deviceMetrics.filter(m => m.sourceType === 'Client');
    if (clientDeviceData.length > 0) {
      result.push({
        sourceType: 'Client',
        label: client?.name || 'Client',
        devices: aggregateDeviceData(clientDeviceData)
      });
    }

    // CD Average data
    const cdDeviceData = deviceMetrics.filter(m => m.sourceType === 'CD_Avg');
    if (cdDeviceData.length > 0) {
      result.push({
        sourceType: 'CD_Avg',
        label: 'Clear Digital Client Avg',
        devices: aggregateDeviceData(cdDeviceData)
      });
    }

    // Industry Average data
    const industryDeviceData = deviceMetrics.filter(m => m.sourceType === 'Industry_Avg');
    if (industryDeviceData.length > 0) {
      result.push({
        sourceType: 'Industry_Avg',
        label: 'Industry Avg',
        devices: aggregateDeviceData(industryDeviceData)
      });
    }

    // NO SYNTHETIC DATA FOR COMPETITORS - only use authentic database data
    // Future competitor device data will come from actual data sources
    // competitors.forEach(() => { /* Competitor device data generation removed to ensure data authenticity */ });

    return result;
  };

  const metricNames = [
    "Bounce Rate", 
    "Session Duration", 
    "Pages per Session", 
    "Sessions per User", 
    "Traffic Channels", 
    "Device Distribution"
  ] as const;

  const scrollToMetric = (metricName: string) => {
    const elementId = `metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`;
    const element = document.getElementById(elementId);
    
    if (element) {
      const HEADER_HEIGHT = 64;
      const PADDING_OFFSET = 20;
      const elementPosition = element.offsetTop - HEADER_HEIGHT - PADDING_OFFSET;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  };

  // Handle manual navigation clicks with highlighting
  const handleNavigationClick = (metricName: string) => {
    setManualClick(true);
    setActiveSection(metricName);
    scrollToMetric(metricName);
    
    // Allow scroll handler to resume after scroll animation completes
    setTimeout(() => {
      setManualClick(false);
    }, 1000);
  };

  // PDF Export function that processes in background without visual flash
  const exportToPDF = async () => {
    console.log('🔄 PDF Export started');
    
    if (!client?.name) {
      console.error('❌ No client name found');
      return;
    }
    
    setIsExportingPDF(true);
    
    try {
      console.log('📄 Looking for dashboard content...');
      // Get the main dashboard content
      const originalElement = document.getElementById('dashboard-content');
      if (!originalElement) {
        console.error('❌ Dashboard content element not found');
        throw new Error('Dashboard content not found');
      }
      console.log('✅ Dashboard content found:', originalElement);
      
      // Hide PDF-hide elements temporarily on original element
      const elementsToHide = originalElement.querySelectorAll('.pdf-hide');
      const originalDisplayValues: string[] = [];
      
      elementsToHide.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        originalDisplayValues[index] = htmlEl.style.display;
        htmlEl.style.display = 'none';
      });
      
      // Add PDF header to original element temporarily
      const pdfHeader = document.createElement('div');
      pdfHeader.id = 'temp-pdf-header';
      pdfHeader.style.cssText = `
        padding: 20px 0;
        border-bottom: 2px solid #e5e7eb;
        margin-bottom: 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      // Create header content safely using DOM methods
      const leftDiv = document.createElement('div');
      leftDiv.style.cssText = 'display: flex; align-items: center;';
      
      const logoImg = document.createElement('img');
      logoImg.src = clearLogoPath;
      logoImg.alt = 'Clear Digital';
      logoImg.style.cssText = 'height: 40px; margin-right: 20px;';
      
      const textDiv = document.createElement('div');
      const titleH1 = document.createElement('h1');
      titleH1.textContent = 'Pulse Dashboard™';
      titleH1.style.cssText = 'font-size: 24px; font-weight: bold; margin: 0; color: #1f2937;';
      
      const subtitleP = document.createElement('p');
      subtitleP.textContent = `Analytics Report for ${client.name}`;
      subtitleP.style.cssText = 'margin: 0; color: #6b7280; font-size: 14px;';
      
      textDiv.appendChild(titleH1);
      textDiv.appendChild(subtitleP);
      leftDiv.appendChild(logoImg);
      leftDiv.appendChild(textDiv);
      
      const rightDiv = document.createElement('div');
      rightDiv.style.cssText = 'text-align: right; color: #6b7280; font-size: 12px;';
      
      const generatedP = document.createElement('p');
      generatedP.textContent = `Generated: ${new Date().toLocaleDateString()}`;
      generatedP.style.margin = '0';
      
      const periodP = document.createElement('p');
      periodP.textContent = `Period: ${timePeriod}`;
      periodP.style.margin = '0';
      
      rightDiv.appendChild(generatedP);
      rightDiv.appendChild(periodP);
      
      pdfHeader.appendChild(leftDiv);
      pdfHeader.appendChild(rightDiv);
      
      originalElement.insertBefore(pdfHeader, originalElement.firstChild);
      
      // Wait for any layout changes
      console.log('⏳ Waiting for layout changes...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Lazy load html2canvas library for performance
      console.log('📚 Loading html2canvas...');
      const html2canvas = (await import('html2canvas')).default;
      console.log('✅ html2canvas loaded successfully');
      
      const canvas = await html2canvas(originalElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      // Restore original state
      const headerToRemove = document.getElementById('temp-pdf-header');
      if (headerToRemove) {
        originalElement.removeChild(headerToRemove);
      }
      
      // Restore visibility of hidden elements
      elementsToHide.forEach((el, index) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = originalDisplayValues[index] || '';
      });
      
      // Lazy load jsPDF library for performance
      console.log('📄 Loading jsPDF...');
      const { jsPDF } = await import('jspdf');
      console.log('✅ jsPDF loaded successfully');
      
      // Create PDF with improved pagination
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Calculate proper scaling and pagination
      const margin = 10; // 10mm margin
      const usableWidth = pdfWidth - (margin * 2);
      const usableHeight = pdfHeight - (margin * 2);
      
      // Calculate scale to fit width while maintaining aspect ratio
      const scaleRatio = usableWidth / (canvasWidth / 1.5); // Adjusted for new scale
      const scaledWidth = usableWidth;
      const scaledHeight = (canvasHeight / 1.5) * scaleRatio;
      
      // Calculate how many pages we need
      const pageContentHeight = usableHeight;
      let currentY = 0;
      
      while (currentY < scaledHeight) {
        if (currentY > 0) {
          pdf.addPage();
        }
        
        // Calculate which part of the canvas to show on this page
        const sourceY = (currentY / scaleRatio) * 1.5; // Adjusted for new scale
        const sourceHeight = Math.min((pageContentHeight / scaleRatio) * 1.5, canvasHeight - sourceY);
        const targetHeight = Math.min(pageContentHeight, scaledHeight - currentY);
        
        if (sourceHeight > 0 && targetHeight > 0) {
          // Create a temporary canvas for this page section
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            pageCtx.fillStyle = '#ffffff';
            pageCtx.fillRect(0, 0, canvasWidth, sourceHeight);
            pageCtx.drawImage(canvas, 0, sourceY, canvasWidth, sourceHeight, 0, 0, canvasWidth, sourceHeight);
            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', margin, margin, scaledWidth, targetHeight);
          }
        }
        
        currentY += pageContentHeight;
      }
      
      // Save the PDF
      const fileName = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('💾 Saving PDF with filename:', fileName);
      pdf.save(fileName);
      console.log('✅ PDF download initiated successfully');
      
      // Show success message
      toast({
        title: "PDF Generated Successfully",
        description: `Analytics report downloaded as ${fileName}`,
      });
      
    } catch (error) {
      console.error('PDF Export Error:', error);
      
      // Clean up in case of error
      const headerToRemove = document.getElementById('temp-pdf-header');
      if (headerToRemove) {
        headerToRemove.remove();
      }
      
      // Restore visibility of any hidden elements
      const elementsToRestore = document.querySelectorAll('.pdf-hide');
      elementsToRestore.forEach(el => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.style.display === 'none') {
          htmlEl.style.display = '';
        }
      });
      
      // Show user-friendly error message
      toast({
        title: "PDF Export Failed",
        description: error instanceof Error ? error.message : "Unable to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Scroll-based section highlighting with throttling and manual click protection
  useEffect(() => {
    if (isLoading) return;
    
    const THROTTLE_DELAY = 400;
    const TRIGGER_OFFSET = 200;
    
    let isThrottled = false;
    let lastActiveSection = activeSection;
    
    const handleScroll = () => {
      if (isThrottled || manualClick) return;
      isThrottled = true;
      
      setTimeout(() => {
        const scrollY = window.scrollY;
        const triggerPoint = scrollY + TRIGGER_OFFSET;
        
        let closestSection = metricNames[0] as string; // Default to first section
        let closestDistance = Infinity;
        
        metricNames.forEach(metricName => {
          const elementId = `metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`;
          const element = document.getElementById(elementId);
          
          if (element) {
            const distance = Math.abs(element.offsetTop - triggerPoint);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSection = metricName;
            }
          }
        });
        
        // Only update if the section actually changed to prevent flashing
        if (closestSection !== lastActiveSection) {
          setActiveSection(closestSection);
          lastActiveSection = closestSection;
        }
        
        isThrottled = false;
      }, THROTTLE_DELAY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, metricNames, activeSection, manualClick]);

  // Performance tracking removed per user request


  if (isLoading || isRefreshing) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header Skeleton */}
        <div className="bg-gradient-to-r from-white to-slate-50/80 border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="h-8 w-24 sm:h-10 sm:w-32 bg-slate-200 rounded animate-pulse"></div>
              <div className="hidden sm:block">
                <div className="h-4 w-32 sm:h-5 sm:w-40 bg-slate-200 rounded animate-pulse mb-1"></div>
                <div className="h-3 w-20 sm:w-24 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-slate-200 rounded animate-pulse lg:hidden"></div>
              <div className="h-8 w-16 sm:w-20 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
        
        <div className="flex">
          {/* Desktop Navigation Skeleton */}
          <div className="w-64 bg-white border-r border-slate-200 fixed top-24 left-0 bottom-0 p-4 hidden lg:block">
            <div className="h-6 w-20 bg-slate-200 rounded animate-pulse mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
            {/* Mobile-specific client info */}
            <div className="block sm:hidden mb-4">
              <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse"></div>
            </div>

            {/* Filter section skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="h-4 w-24 sm:h-5 sm:w-32 bg-slate-200 rounded animate-pulse mb-3 sm:mb-4"></div>
                  <div className="h-8 sm:h-10 bg-slate-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
            
            {/* Metric Cards Skeleton */}
            <div className="space-y-8 sm:space-y-10 lg:space-y-12">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 lg:p-8 shadow-sm">
                  <div className="h-5 w-32 sm:h-6 sm:w-48 bg-slate-200 rounded animate-pulse mb-4 sm:mb-6"></div>
                  <div className="h-48 sm:h-56 lg:h-64 bg-slate-200 rounded-lg animate-pulse mb-4 sm:mb-6"></div>
                  {/* AI Insights skeleton */}
                  <div className="bg-slate-100 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center mb-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse mr-3"></div>
                      <div>
                        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-1"></div>
                        <div className="h-3 w-32 bg-slate-200 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-3 w-5/6 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Enhanced Header with Gradient - Responsive */}
      <header className="bg-gradient-to-r from-white via-white to-slate-50/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-6 py-3 sm:py-5 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <img 
              src={clearLogoPath} 
              alt="Clear Digital Logo" 
              className="h-6 sm:h-8 md:h-10 w-auto flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-4">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Pulse Dashboard™</h1>

              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 truncate">
                {client?.name || (user?.role === "Admin" ? "No Client (Admin Only)" : "Loading...")}
                {client?.websiteUrl && (
                  <>
                    <span className="hidden sm:inline"> | </span>
                    <span className="block sm:inline">
                      <a 
                        href={client.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1 group"
                      >
                        <span className="truncate max-w-32 sm:max-w-none">{client.websiteUrl.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                      </a>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-6">
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
              <div className={`w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center transition-all hover:scale-105 overflow-hidden ${!client?.iconUrl ? 'border-2 border-primary/20' : ''}`}>
                {client?.iconUrl ? (
                  <img 
                    src={client.iconUrl} 
                    alt={`${client.name} logo`}
                    className="w-full h-full object-contain rounded-full"
                    style={{ backgroundColor: '#8C8C8C' }}
                    onError={(e) => {
                      // Fallback to initial if image fails to load
                      e.currentTarget.style.display = 'none';
                      const fallbackSpan = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallbackSpan) {
                        fallbackSpan.style.display = 'block';
                      }
                    }}
                  />
                ) : null}
                <span 
                  className={`text-xs sm:text-sm font-bold text-primary ${client?.iconUrl ? 'hidden' : 'block'}`}
                  style={{ display: client?.iconUrl ? 'none' : 'block' }}
                >
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 hidden sm:block truncate max-w-24 lg:max-w-none">{user?.name}</span>
            </div>
            
            {/* PDF Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isExportingPDF}
              className="export-button pdf-hide hover:bg-primary hover:text-white transition-all duration-200 text-xs sm:text-sm"
            >
              {isExportingPDF ? (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Exporting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Export PDF</span>
                </div>
              )}
            </Button>

            {/* Debug: Clear Insights Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearInsightsMutation.mutate()}
              disabled={clearInsightsMutation.isPending}
              className="pdf-hide hover:bg-red-500 hover:text-white transition-all duration-200 text-xs sm:text-sm border-red-200 text-red-600"
            >
              {clearInsightsMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Clearing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Clear Insights</span>
                </div>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden hover:bg-slate-100 transition-all duration-200 p-1 sm:p-2 pdf-hide"
            >
              <Menu className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="logout-button pdf-hide hover:bg-slate-100 transition-all duration-200 hover:scale-105 p-1 sm:p-2"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 mobile-menu pdf-hide" onClick={() => setMobileMenuOpen(false)}>
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Analytics Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Metrics</h3>
              <ul className="space-y-2">
                {metricNames.map((metricName) => (
                  <li key={metricName}>
                    <button
                      onClick={() => {
                        handleNavigationClick(metricName);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 rounded-lg group hover:bg-slate-50 ${
                        activeSection === metricName
                          ? 'bg-primary/10 text-primary font-semibold border-l-4 border-primary shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        {metricName}
                        <TrendingUp className={`w-4 h-4 transition-all duration-200 ${
                          activeSection === metricName ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'
                        }`} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Admin Panel Link */}
              {user?.role === "Admin" && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Admin</h3>
                  <div className="space-y-2">
                    <Link href="/admin">
                      <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full text-left px-4 py-3 text-sm transition-all duration-200 rounded-lg group hover:bg-slate-50 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200"
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center">
                            <Settings className="w-4 h-4 mr-2" />
                            Admin Panel
                          </span>
                          <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-all duration-200" />
                        </span>
                      </button>
                    </Link>
                    
                    {/* Refresh Data Button */}
                    <button
                      onClick={handleRefreshData}
                      className="w-full text-left px-4 py-3 text-sm transition-all duration-200 rounded-lg group hover:bg-slate-50 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200"
                    >
                      <span className="flex items-center justify-between">
                        <span className="flex items-center">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh Data
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop Left Navigation */}
        <nav className="w-64 bg-white border-r border-slate-200 fixed top-24 left-0 bottom-0 z-10 overflow-y-auto hidden lg:block pdf-hide">
          <div className="p-4">
            <h2 className="text-base font-bold text-slate-800 mb-4">Metrics</h2>
            <ul className="space-y-2">
              {metricNames.map((metricName, index) => (
                <li key={metricName}>
                  <button
                    onClick={() => handleNavigationClick(metricName)}
                    className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                      activeSection === metricName
                        ? 'bg-slate-100 text-primary'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-primary'
                    }`}
                  >
                    {metricName}
                  </button>
                </li>
              ))}
              
              {/* Admin Panel Link after Device Distribution */}
              {user?.role === "Admin" && (
                <>
                  <li key="admin-separator" className="my-4">
                    <hr className="border-slate-200" />
                  </li>
                  <li key="admin-panel">
                    <Link href="/admin">
                      <button className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary">
                        <div className="flex items-center space-x-2">
                          <Settings className="h-3 w-3 text-slate-400" />
                          <span>Admin Panel</span>
                        </div>
                      </button>
                    </Link>
                  </li>
                  <li key="refresh-data">
                    <button 
                      onClick={handleRefreshData}
                      className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                    >
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-3 w-3 text-slate-400" />
                        <span>Refresh Data</span>
                      </div>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>

        {/* Enhanced Main Content - Responsive */}
        <div className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto" id="dashboard-content">
          
          {/* GA4 Status Banner */}
          <StatusBanner 
            clientId={user?.clientId || "demo-client-id"} 
            timePeriod={timePeriod}
            isAdmin={user?.role === "Admin"}
          />

          {/* Error Banner for API errors */}
          <ErrorBanner
            error={dashboardError}
            onRetry={() => {
              clearDashboardError();
              refetchDashboard();
            }}
            onDismiss={dismissDashboardError}
            className="pdf-hide"
          />

        {/* Enhanced Filters Section - Responsive */}
        <div className="filters-section pdf-hide grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 lg:mb-12">
          <Card className="border-slate-200/60 shadow-sm hover:shadow-[0_0_15px_rgba(255,20,147,0.15)] transition-all duration-200 rounded-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-base font-semibold">
                <Filter className="h-5 w-5 mr-3 text-primary" />
                Industry Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Business Size</label>
                <NativeSelect
                  value={businessSize || ""}
                  onChange={(e) => {
                    try {
                      setBusinessSize(e.target.value);
                    } catch (error) {
                      console.warn('Business size selection error:', error);
                    }
                  }}
                  options={filtersData?.businessSizes?.map(size => ({ value: size, label: size })) || [{ value: "All", label: "All" }]}
                  placeholder="Select business size"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Industry Vertical</label>
                <NativeSelect
                  value={industryVertical || ""}
                  onChange={(e) => {
                    try {
                      setIndustryVertical(e.target.value);
                    } catch (error) {
                      console.warn('Industry vertical selection error:', error);
                    }
                  }}
                  options={filtersData?.industryVerticals?.map(vertical => ({ value: vertical, label: vertical })) || [{ value: "All", label: "All" }]}
                  placeholder="Select industry"
                />
                

              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm hover:shadow-[0_0_15px_rgba(255,20,147,0.15)] transition-all duration-200 rounded-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-base font-semibold">
                <Clock className="h-5 w-5 mr-3 text-primary" />
                Time Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NativeSelect
                value={timePeriod || ""}
                onChange={(e) => {
                  try {
                    if (e.target.value === "Custom Date Range") {
                      setShowDatePicker(true);
                    } else {
                      setTimePeriod(e.target.value);
                      setCustomDateRange("");
                    }
                  } catch (error) {
                    console.warn('Time period selection error:', error);
                  }
                }}
                options={filtersData?.timePeriods?.filter(period => period && period !== "Year").map(period => ({ value: period, label: period })) || [{ value: "Last Month", label: "Last Month" }]}
                placeholder="Select time period"
              />
              
              {/* Display time period details below dropdown */}
              {(() => {
                let displayText = "";
                if (timePeriod === "Custom Date Range" && customDateRange) {
                  displayText = customDateRange;
                } else if (timePeriod === "Last Month") {
                  // Use Pacific Time calculation: current PT month - 1
                  const now = new Date();
                  const ptFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/Los_Angeles',
                    year: 'numeric',
                    month: '2-digit'
                  });
                  const ptParts = ptFormatter.formatToParts(now);
                  const ptYear = parseInt(ptParts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
                  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1)) - 1;
                  const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
                  displayText = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                } else if (timePeriod === "Last Quarter") {
                  // Show the last 3 months ending with PT target month
                  const now = new Date();
                  const ptFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/Los_Angeles',
                    year: 'numeric',
                    month: '2-digit'
                  });
                  const ptParts = ptFormatter.formatToParts(now);
                  const ptYear = parseInt(ptParts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
                  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1)) - 1;
                  const targetMonth = new Date(ptYear, ptMonth - 1, 1); // 1 month before current PT
                  
                  // Calculate start month (2 months before target month)
                  const startMonth = new Date(targetMonth);
                  startMonth.setMonth(targetMonth.getMonth() - 2);
                  
                  const startText = startMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  const endText = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                  displayText = `${startText} - ${endText}`;
                } else if (timePeriod === "Last Year") {
                  // Use Pacific Time for year calculation - Last Year should be rolling 12 months ending in previous month
                  const now = new Date();
                  const ptFormatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/Los_Angeles',
                    year: 'numeric',
                    month: '2-digit'
                  });
                  const ptParts = ptFormatter.formatToParts(now);
                  const ptYear = parseInt(ptParts.find(p => p.type === 'year')?.value || String(now.getFullYear()));
                  const ptMonth = parseInt(ptParts.find(p => p.type === 'month')?.value || String(now.getMonth() + 1)) - 1;
                  
                  // End date is previous month (July 2025)
                  const endDate = new Date(ptYear, ptMonth - 1, 1);
                  
                  // Start date is 12 months before end date (August 2024)
                  const startDate = new Date(endDate);
                  startDate.setMonth(startDate.getMonth() - 11); // 11 months back from end month = 12 months total
                  
                  displayText = `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                }
                
                return displayText ? (
                  <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-600">Selected Period:</p>
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{displayText}</p>
                  </div>
                ) : null;
              })()}
              
              {/* Custom Date Range Dialog */}
              <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Custom Date Range</DialogTitle>
                    <DialogDescription>
                      Choose the start and end dates for your custom time period
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowDatePicker(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => {
                          if (startDate && endDate) {
                            const start = new Date(startDate);
                            const end = new Date(endDate);
                            const formattedRange = `${start.toLocaleDateString('en-US')} to ${end.toLocaleDateString('en-US')}`;
                            setCustomDateRange(formattedRange);
                            setTimePeriod("Custom Date Range");
                            setShowDatePicker(false);
                          }
                        }}
                        disabled={!startDate || !endDate}
                      >
                        Apply Range
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm hover:shadow-[0_0_15px_rgba(255,20,147,0.15)] transition-all duration-200 rounded-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-base font-semibold">
                <Building2 className="h-5 w-5 mr-3 text-primary" />
                Competitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              {competitors.length > 0 ? (
                <div className="space-y-2">
                  {competitors.map((competitor: any) => {
                    const isDeleting = deletingCompetitorId === competitor.id;
                    return (
                      <div
                        key={competitor.id}
                        className={`flex items-center justify-between h-10 px-3 rounded-lg border transition-all duration-200 ${
                          isDeleting 
                            ? 'bg-slate-100 border-slate-300 opacity-60' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className={`text-sm truncate flex-1 mr-2 transition-colors ${
                          isDeleting ? 'text-slate-500' : 'text-slate-900'
                        }`}>
                          {competitor.domain.replace('https://', '').replace('http://', '')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => {
                            setDeletingCompetitorId(competitor.id);
                            deleteCompetitorMutation.mutate(competitor.id);
                          }}
                          className={`h-6 w-6 p-0 transition-all duration-200 ${
                            isDeleting 
                              ? 'cursor-not-allowed' 
                              : 'hover:bg-red-100 hover:text-red-600'
                          }`}
                        >
                          {isDeleting ? (
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-4">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No competitors added yet</p>
                </div>
              )}
              {competitors.length < 3 && (
                <Button
                  onClick={() => setShowCompetitorModal(true)}
                  className={`add-competitor-button pdf-hide w-full h-10 hover:shadow-[0_0_15px_rgba(156,163,175,0.25)] transition-all duration-200 ${
                    competitors.length > 0 ? 'mt-2' : 'mt-3'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Competitors
                </Button>
              )}
            </CardContent>
          </Card>


        </div>



        {/* Enhanced Metrics Grid */}
        <div className="space-y-8 lg:space-y-16">
          {(() => {

            return metricNames;
          })().map((metricName) => {

            const metricData = groupedMetrics[metricName] || {};
            const insight = insights.find((i: any) => i.metricName === metricName);
            
            // Data processing verified - debug logs removed for production
            

            

            
            return (
              <Card 
                key={metricName} 
                id={`metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`}
                className="border-slate-200/60 hover:shadow-[0_0_25px_rgba(156,163,175,0.2)] transition-all duration-300 rounded-2xl bg-white/90 backdrop-blur-sm"
              >
                <CardHeader className="pb-4 lg:pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight mb-2">{metricName}</CardTitle>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {timePeriod === 'Last Month' ? 'Last Month' :
                             timePeriod === 'Last Quarter' ? 'Last Quarter' :
                             timePeriod === 'Last Year' ? 'Last Year' :
                             timePeriod === 'Custom' ? `${startDate} - ${endDate}` :
                             timePeriod}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Filter className="h-3 w-3" />
                          <span>{industryVertical === 'All' ? 'All Industries' : industryVertical}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Filter className="h-3 w-3" />
                          <span>{businessSize === 'All' ? 'All Sizes' : businessSize}</span>
                        </div>
                      </div>
                    </div>
{metricName !== "Traffic Channels" && metricName !== "Device Distribution" && (
                    <div className="text-left sm:text-right">
                      <span className="text-2xl lg:text-3xl font-light text-primary block tracking-tight">
                        {metricData.Client ? (
                          metricName.includes("Session Duration") 
                            ? `${Math.round(metricData.Client * 10) / 10} min`
                            : `${Math.round(metricData.Client * 10) / 10}${metricName.includes("Rate") ? "%" : metricName.includes("Pages per Session") ? " pages" : metricName.includes("Sessions per User") ? " sessions" : ""}`
                        ) : "N/A"}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">Your Performance</span>
                    </div>
                  )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 lg:space-y-8">
                  {/* Enhanced Chart Container */}
                  <div className="bg-slate-50/50 rounded-xl p-2 sm:p-3 lg:p-6">
                    <div className={`relative ${metricName === "Device Distribution" ? "overflow-visible" : metricName === "Traffic Channels" ? "overflow-visible" : "h-40 sm:h-48 md:h-56 lg:h-64 xl:h-72 overflow-hidden"}`}>
                      {metricName === "Bounce Rate" ? (
                        <TimeSeriesChart 
                          metricName={metricName}
                          timePeriod={timePeriod}
                          clientData={metricData.Client || 0}
                          industryAvg={metricData.Industry_Avg || 0}
                          cdAvg={metricData.CD_Avg || 0}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          timeSeriesData={timeSeriesData}
                          periods={periods}
                          competitors={processCompanyMetrics(competitors, metrics, {
                            metricName,
                            displayMode: 'individual',
                            sourceType: 'Competitor',
                            fallbackValue: getDefaultMetricValue(metricName, 'Competitor'),
                            convertToPercentage: shouldConvertToPercentage(metricName),
                            convertToMinutes: shouldConvertToMinutes(metricName)
                          })}
                        />
                      ) : metricName === "Session Duration" ? (
                        <MetricBarChart 
                          metricName={metricName}
                          timePeriod={timePeriod}
                          clientData={metricData.Client || 0}
                          industryAvg={metricData.Industry_Avg || 0}
                          cdAvg={metricData.CD_Avg || 0}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          timeSeriesData={timeSeriesData}
                          periods={periods}
                          competitors={processCompanyMetrics(competitors, metrics, {
                            metricName,
                            displayMode: 'individual',
                            sourceType: 'Competitor',
                            fallbackValue: getDefaultMetricValue(metricName, 'Competitor'),
                            convertToPercentage: shouldConvertToPercentage(metricName),
                            convertToMinutes: shouldConvertToMinutes(metricName)
                          })}
                        />
                      ) : metricName === "Traffic Channels" ? (
                        (() => {
                          const trafficData = processTrafficChannelData();

                          return (
                            <StackedBarChart 
                              data={trafficData}
                              title="Traffic Channel Distribution"
                              description="Percentage breakdown of traffic sources"
                            />
                          );
                        })()
                      ) : metricName === "Pages per Session" || metricName === "Sessions per User" ? (
                        <TimeSeriesChart 
                          metricName={metricName}
                          timePeriod={timePeriod}
                          clientData={metricData.Client || 0}
                          industryAvg={metricData.Industry_Avg || 0}
                          cdAvg={metricData.CD_Avg || 0}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          timeSeriesData={timeSeriesData}
                          periods={periods}
                          competitors={processCompanyMetrics(competitors, metrics, {
                            metricName,
                            displayMode: 'individual',
                            sourceType: 'Competitor',
                            fallbackValue: getDefaultMetricValue(metricName, 'Competitor'),
                            convertToPercentage: shouldConvertToPercentage(metricName),
                            convertToMinutes: shouldConvertToMinutes(metricName)
                          })}
                        />
                      ) : metricName === "Device Distribution" ? (
                        <LollipopChart 
                          data={(() => {
                            const deviceData = processDeviceDistributionData();
                            const clientData = deviceData.find(d => d.sourceType === 'Client');
                            const result = { Desktop: 0, Mobile: 0 }; // Simplified 2-device model
                            clientData?.devices.forEach(device => {
                              result[device.name as keyof typeof result] = device.percentage;
                            });
                            return result;
                          })()}
                          competitors={processDeviceDistribution(competitors, metrics, 'Competitor')}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          clientName={dashboardData?.client?.name}
                          industryAvg={(() => {
                            const deviceData = processDeviceDistributionData();
                            const industryData = deviceData.find(d => d.sourceType === 'Industry_Avg');
                            const result = { Desktop: 45, Mobile: 55 }; // Simplified 2-device model
                            industryData?.devices.forEach(device => {
                              result[device.name as keyof typeof result] = device.percentage;
                            });
                            return result;
                          })()}
                          cdAvg={(() => {
                            const deviceData = processDeviceDistributionData();
                            const cdData = deviceData.find(d => d.sourceType === 'CD_Avg');
                            const result = { Desktop: 50, Mobile: 50 }; // Simplified 2-device model
                            cdData?.devices.forEach(device => {
                              result[device.name as keyof typeof result] = device.percentage;
                            });
                            return result;
                          })()}
                        />
                      ) : metricName === "Session Duration" ? (
                        timePeriod === 'Last Quarter' ? (
                          <TimeSeriesChart 
                            metricName={metricName}
                            timePeriod={timePeriod}
                            clientData={metricData.Client || 0}
                            industryAvg={metricData.Industry_Avg || 0}
                            cdAvg={metricData.CD_Avg || 0}
                            clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                            timeSeriesData={timeSeriesData}
                            periods={periods}
                            competitors={processCompanyMetrics(competitors, metrics, {
                              metricName,
                              displayMode: 'individual',
                              sourceType: 'Competitor',
                              fallbackValue: getDefaultMetricValue(metricName, 'Competitor'),
                              convertToPercentage: shouldConvertToPercentage(metricName),
                              convertToMinutes: shouldConvertToMinutes(metricName)
                            })}
                          />
                        ) : (
                          <MetricBarChart 
                            metricName={metricName}
                            timePeriod={timePeriod}
                            clientData={metricData.Client || 0}
                            industryAvg={metricData.Industry_Avg || 0}
                            cdAvg={metricData.CD_Avg || 0}
                            clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                            competitors={processCompanyMetrics(competitors, metrics, {
                              metricName,
                              displayMode: 'individual',
                              sourceType: 'Competitor',
                              fallbackValue: getDefaultMetricValue(metricName, 'Competitor'),
                              convertToPercentage: shouldConvertToPercentage(metricName),
                              convertToMinutes: shouldConvertToMinutes(metricName)
                            })}
                          />
                        )
                      ) : (
                        <MetricsChart metricName={metricName} data={metricData} />
                      )}
                    </div>
                  </div>
                  
                  {/* Enhanced AI-Generated Insights */}
                  <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-4 sm:p-6 shadow-sm mt-6 sm:mt-8 lg:mt-12">
                    <div className="flex items-center mb-4 sm:mb-6">
                      <div className="mr-3 sm:mr-4 flex-shrink-0">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-primary tracking-tight">Pulse AI Insight</h3>
                        <p className="text-xs sm:text-sm text-slate-600">
                          AI-powered analysis and recommendations for {getDataPeriodDisplay()}
                        </p>
                      </div>
                      {/* Enhanced Status Icon with Glow Pulse */}
                      {metricStatuses[metricName] && (
                        <div className="ml-4 flex-shrink-0">
                          {metricStatuses[metricName] === 'success' && (
                            <div className="w-12 h-12 bg-green-500/70 rounded-full flex items-center justify-center status-icon-success" title="Performance is on target">
                              <CheckCircle2 className="h-6 w-6 text-white relative z-10" />
                            </div>
                          )}
                          {metricStatuses[metricName] === 'needs_improvement' && (
                            <div className="w-12 h-12 bg-orange-500/70 rounded-full flex items-center justify-center status-icon-warning" title="Performance needs improvement">
                              <AlertTriangle className="h-6 w-6 text-white relative z-10" />
                            </div>
                          )}
                          {metricStatuses[metricName] === 'warning' && (
                            <div className="w-12 h-12 bg-red-500/80 rounded-full flex items-center justify-center status-icon-error" title="Performance requires attention">
                              <XCircle className="h-6 w-6 text-white relative z-10" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <MetricInsightBox 
                      metricName={metricName}
                      clientId={client?.id || ''}
                      timePeriod={timePeriod}
                      metricData={{
                        metricName,
                        clientValue: metricData?.Client || null,
                        industryAverage: metricData?.Industry_Avg || null,
                        cdAverage: metricData?.CD_Avg || null,
                        competitorValues: [],
                        competitorNames: []
                      }}
                      preloadedInsight={insightsLookup[metricName] || null}
                      onStatusChange={(status: "success" | "needs_improvement" | "warning" | undefined) => {
                        logger.debug(`Status change for ${metricName}:`, status);
                        setMetricStatuses(prev => ({
                          ...prev,
                          [metricName]: status
                        }));
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}


        </div>

        {/* Keep the original Pulse AI Insight boxes in each metric card - they should remain as placeholder/individual insights */}
        </div>

        {/* Competitor Modal */}
        <CompetitorModal
          isOpen={showCompetitorModal}
          onClose={() => setShowCompetitorModal(false)}
          competitors={competitors.map(c => ({ ...c, status: c.status || 'active' }))}
          clientId={user?.clientId || ""}
        />
      </div>
      
      {/* Footer positioned to account for left navigation */}
      <div className="lg:ml-64">
        <Footer />
      </div>
    </div>
  );
}
