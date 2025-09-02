import { useState, useEffect, useRef } from "react";
import { useDashboardData, useDashboardFilters, useSmartFilterCombinations } from "@/hooks/useDashboardData";
import { useAuth } from "@/hooks/use-auth";
import { useLoadKit } from "@/components/loading";
import LoadKit, { ButtonLoadingSpinner, useFeatureFlag } from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EffectivenessCard } from "@/components/effectiveness-card";

import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LogOut,
  Settings,
  Filter,
  Menu,
  Download,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Clock,
  Building2,
  TrendingUp,
  Users,
  Plus,
  Info,
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";

import { ViewAsSelector } from '@/components/admin/ViewAsSelector';
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
import PdfExportButton from "@/components/pdf/PdfExportButton";
import ComparisonChip from "@/components/ComparisonChip";
import { generateComparisonData } from "@/utils/comparisonUtils";
import { convertMetricValue, formatMetricDisplay } from "@/utils/metricConversion";
import { enableConversionDebug } from "@/utils/conversionValidator";

import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function Dashboard() {
  const dashboardRootRef = useRef<HTMLDivElement>(null);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  // State management
  const [timePeriod, setTimePeriod] = useState("Last Month");
  const [businessSize, setBusinessSize] = useState("All");
  const [industryVertical, setIndustryVertical] = useState("All");
  const [viewAsClientId, setViewAsClientId] = useState<string | null>(null);
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUser, setViewAsUser] = useState<any>(null);
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("Bounce Rate");
  const [manualClick, setManualClick] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [metricStatuses, setMetricStatuses] = useState<
    Record<string, "success" | "needs_improvement" | "warning" | undefined>
  >({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Clear metric statuses when switching between clients to prevent cross-client contamination
  const effectiveClientId = viewAsClientId || user?.clientId;
  useEffect(() => {
    setMetricStatuses({});
  }, [effectiveClientId]);

  // Enable conversion debugging in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      enableConversionDebug();
    }
  }, []);

  // Error banner state
  const {
    error: dashboardError,
    showError: showDashboardError,
    dismissError: dismissDashboardError,
    clearError: clearDashboardError,
  } = useErrorBanner();

  // Use the new unified data hook
  const {
    data: dashboardData,
    processedData,
    isLoading,
    error,
    insights,
    insightsLoading,
    competitors,
    deleteCompetitor,
    deletingCompetitorId,
    refetch,
    clearInsights,
    client,
    metrics,
    periods,
    dataQuality,
  } = useDashboardData({
    timePeriod,
    businessSize,
    industryVertical,
    clientId: viewAsClientId || user?.clientId || '',
  });

  // Use filters hook with dynamic filtering (only companies with metrics)
  const {
    businessSizes,
    industryVerticals,
    timePeriods,
    dataSourceInfo,
    isLoading: filtersLoading,
  } = useDashboardFilters(true);

  // Use smart filter combinations for interdependent filtering
  const {
    availableBusinessSizes,
    availableIndustryVerticals,
    disabledCount,
    totalCombinations,
    isLoading: combinationsLoading,
  } = useSmartFilterCombinations(businessSize, industryVertical);

  // Show error if there's an issue
  useEffect(() => {
    if (error) {
      showDashboardError(error);
    }
  }, [error]);

  // Admin refresh function
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
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
      setMobileMenuOpen(false);
    }
  };

  // Get processed metrics from unified service
  const groupedMetrics = processedData?.metrics || {};
  const trafficChannelData = processedData?.trafficChannels || [];
  const deviceDistributionData = processedData?.deviceDistribution || [];

  // Helper function to get competitor data for charts
  const getCompetitorChartData = (metricName: string) => {
    if (!competitors || !metrics) return [];
    
    return competitors.map((competitor: any) => {
      const competitorMetric = metrics.find((m: any) => 
        m.sourceType === 'Competitor' && 
        m.competitorId === competitor.id && 
        m.metricName === metricName
      );
      
      let convertedValue = 0;
      if (competitorMetric) {
        // Apply centralized conversion to ensure consistency
        const converted = convertMetricValue({
          metricName,
          sourceType: 'Competitor',
          rawValue: parseFloat(competitorMetric.value)
        });
        convertedValue = converted.value;
      }
      
      return {
        id: competitor.id,
        label: competitor.label || competitor.domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        value: Math.round(convertedValue * 10) / 10,
      };
    });
  };

  const metricNames = [
    "Website Effectiveness",
    "Bounce Rate", 
    "Session Duration",
    "Pages per Session",
    "Sessions per User",
    "Traffic Channels",
    "Device Distribution",
  ] as const;

  const scrollToMetric = (metricName: string) => {
    const elementId = `metric-${metricName.replace(/\s+/g, "-").toLowerCase()}`;
    const element = document.getElementById(elementId);

    if (element) {
      const HEADER_HEIGHT = 64;
      const PADDING_OFFSET = 20;
      const elementPosition =
        element.offsetTop - HEADER_HEIGHT - PADDING_OFFSET;

      window.scrollTo({
        top: elementPosition,
        behavior: "smooth",
      });
    }
  };

  const handleNavigationClick = (metricName: string) => {
    setManualClick(true);
    setActiveSection(metricName);
    scrollToMetric(metricName);

    setTimeout(() => {
      setManualClick(false);
    }, 1000);
  };

  // Scroll-based section highlighting
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

        let closestSection = metricNames[0] as string;
        let closestDistance = Infinity;

        metricNames.forEach((metricName) => {
          const elementId = `metric-${metricName.replace(/\s+/g, "-").toLowerCase()}`;
          const element = document.getElementById(elementId);

          if (element) {
            const distance = Math.abs(element.offsetTop - triggerPoint);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSection = metricName;
            }
          }
        });

        if (closestSection !== lastActiveSection) {
          setActiveSection(closestSection);
          lastActiveSection = closestSection;
        }

        isThrottled = false;
      }, THROTTLE_DELAY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLoading, metricNames, activeSection, manualClick]);

  // Create insights lookup
  const insightsLookup = insights.reduce((acc: any, insight: any) => {
    acc[insight.metricName] = insight;
    return acc;
  }, {});

  // LoadKit integration - behavioral cloning
  const { shouldUse: useLoadKitDashboard } = useLoadKit('dashboard');
  
  // LoadKit state preparation - mirror existing exactly
  const dashboardLoadingState = {
    isLoading,
    isRefreshing,
    filtersLoading,
    combinationsLoading,
    insightsLoading
  };

  if (isLoading || isRefreshing) {
    return (
      <LoadKit.Dashboard state={dashboardLoadingState}>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <ButtonLoadingSpinner size="md" />
        </div>
      </LoadKit.Dashboard>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Keep existing header exactly as is */}
      <header className="bg-gradient-to-r from-white via-white to-slate-50/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-6 py-3 sm:py-5 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <img
              src={clearLogoPath}
              alt="Clear Digital Logo"
              className="h-6 sm:h-8 md:h-10 w-auto flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Pulse Dashboard™
              </h1>
              <div className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 truncate">
                {client?.name || "Loading..."}
                {client?.websiteUrl && (
                  <>
                    <span className="hidden sm:inline"> | </span>
                    <a
                      href={client.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline inline-flex items-center gap-1 group"
                    >
                      <span className="truncate max-w-32 sm:max-w-none">
                        {client.websiteUrl.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-6">
            {/* User Avatar and Name - Show viewed user when admin is viewing as someone */}
            {user && (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Avatar className={`h-8 w-8 ${client?.iconUrl ? 'bg-[#8c8c8c]' : ''}`}>
                  {client?.iconUrl && (
                    <AvatarImage 
                      src={client.iconUrl}
                      alt={client?.name || "Client"}
                      className="object-contain"
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {(viewAsUser?.name || user.name || user.email || "User").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline truncate max-w-24 lg:max-w-32">
                  {viewAsUser?.name || user.name || user.email}
                </span>
                {viewAsUser && viewAsUser.id !== user?.id && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    Viewing as
                  </span>
                )}
              </div>
            )}
            
            {(viewAsUser?.role === "Admin" || (!viewAsUser && user?.role === "Admin")) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearInsights}
                className="hover:bg-red-500 hover:text-white transition-all duration-200 text-xs sm:text-sm border-red-200 text-red-600"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-2">Clear Insights</span>
              </Button>
            )}
            <PdfExportButton
              targetRef={dashboardRootRef}
              clientLabel={client?.name}
              clientName={client?.name}
              className="ml-1"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
            >
              <Menu className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <ButtonLoadingSpinner size="sm" />
              ) : (
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="fixed top-0 left-0 w-64 h-full bg-white shadow-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800">Navigation</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ×
                </Button>
              </div>
              
              <nav>
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-800 mb-2">Vitals</h3>
                  <ul className="space-y-1">
                    {metricNames.map((metricName) => (
                      <li key={metricName}>
                        <button
                          onClick={() => {
                            handleNavigationClick(metricName);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                            activeSection === metricName
                              ? "bg-slate-100 text-primary"
                              : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                          }`}
                        >
                          {metricName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <hr className="border-slate-200 my-4" />
                
                <ul className="space-y-2">
                  <li>
                    <Link href="/brand-signals">
                      <button 
                        className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Brand Signals
                      </button>
                    </Link>
                  </li>
                  
                  {(viewAsUser?.role === "Admin" || (!viewAsUser && user?.role === "Admin")) && (
                    <>
                      <li className="my-4">
                        <hr className="border-slate-200" />
                      </li>
                      <li>
                        <Link href="/admin">
                          <button 
                            className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Settings className="h-3 w-3 inline mr-2" />
                            Admin Panel
                          </button>
                        </Link>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            handleRefreshData();
                            setMobileMenuOpen(false);
                          }}
                          className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                        >
                          <RefreshCw className="h-3 w-3 inline mr-2" />
                          Refresh Data
                        </button>
                      </li>
                    </>
                  )}
                  
                  <li className="my-4">
                    <hr className="border-slate-200" />
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        logoutMutation.mutate();
                      }}
                      className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                    >
                      <LogOut className="h-3 w-3 inline mr-2" />
                      Logout
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop Navigation - Keep existing */}
        <nav className="w-64 bg-white border-r border-slate-200 fixed top-24 left-0 bottom-0 z-10 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <h2 className="text-base font-bold text-slate-800 mb-4">Vitals</h2>
            <ul className="space-y-2">
              {metricNames.map((metricName) => (
                <li key={metricName}>
                  <button
                    onClick={() => handleNavigationClick(metricName)}
                    className={`w-full text-left p-2 rounded-lg transition-colors text-xs ${
                      activeSection === metricName
                        ? "bg-slate-100 text-primary"
                        : "text-slate-700 hover:bg-slate-100 hover:text-primary"
                    }`}
                  >
                    {metricName}
                  </button>
                </li>
              ))}
              <li className="my-4">
                <hr className="border-slate-200" />
              </li>
              <li>
                <Link href="/brand-signals">
                  <button className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary">
                    Brand Signals
                  </button>
                </Link>
              </li>
              {(viewAsUser?.role === "Admin" || (!viewAsUser && user?.role === "Admin")) && (
                <>
                  <li className="my-4">
                    <hr className="border-slate-200" />
                  </li>
                  <li>
                    <Link href="/admin">
                      <button className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary">
                        <Settings className="h-3 w-3 inline mr-2" />
                        Admin Panel
                      </button>
                    </Link>
                  </li>
                  <li>
                    <button
                      onClick={handleRefreshData}
                      className="w-full text-left p-2 rounded-lg transition-colors text-xs text-slate-700 hover:bg-slate-100 hover:text-primary"
                    >
                      <RefreshCw className="h-3 w-3 inline mr-2" />
                      Refresh Data
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <div
          ref={dashboardRootRef}
          className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
        >


          {/* Admin View-As Selector */}
          {user?.role === "Admin" && (
            <ViewAsSelector
              currentUserId={user.id}
              currentClientId={user.clientId || ''}
              viewAsUserId={viewAsUserId}
              isAdmin={true}
              onViewAs={(clientId, userName, userId, userData) => {
                setViewAsClientId(clientId);
                setViewAsUserName(userName);
                setViewAsUserId(userId);
                setViewAsUser(userData);
              }}
              onReset={() => {
                setViewAsClientId(null);
                setViewAsUserName(null);
                setViewAsUserId(null);
                setViewAsUser(null);
              }}
            />
          )}

          <ErrorBanner
            error={dashboardError}
            onRetry={() => {
              clearDashboardError();
              refetch();
            }}
            onDismiss={dismissDashboardError}
          />



          {/* Filters Section - Simplified */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 lg:mb-12">
            {/* Keep existing filter cards but use data from hooks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Filter className="h-5 w-5 mr-3 text-primary" />
                  Industry Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Business Size
                    {disabledCount?.businessSizes && disabledCount.businessSizes > 0 && (
                      <span className="text-xs text-slate-500 ml-2">
                        ({disabledCount.businessSizes} options filtered out)
                      </span>
                    )}
                  </label>
                  <NativeSelect
                    value={businessSize}
                    onChange={(e) => setBusinessSize(e.target.value)}
                    options={(availableBusinessSizes.length > 0 ? availableBusinessSizes : businessSizes).map((size) => ({
                      value: size,
                      label: size,
                    }))}
                    placeholder="Select business size"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Industry Vertical
                    {disabledCount?.industries && disabledCount.industries > 0 && (
                      <span className="text-xs text-slate-500 ml-2">
                        ({disabledCount.industries} options filtered out)
                      </span>
                    )}
                  </label>
                  <NativeSelect
                    value={industryVertical}
                    onChange={(e) => setIndustryVertical(e.target.value)}
                    options={(availableIndustryVerticals.length > 0 ? availableIndustryVerticals : industryVerticals).map((vertical) => ({
                      value: vertical,
                      label: vertical,
                    }))}
                    placeholder="Select industry"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Time Period Card - Keep existing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Clock className="h-5 w-5 mr-3 text-primary" />
                  Time Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NativeSelect
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  options={timePeriods
                    .filter((period) => period !== "Year")
                    .map((period) => ({ value: period, label: period }))}
                  placeholder="Select time period"
                />
                {/* Display time period details below dropdown */}
                {(() => {
                  let displayText = "";
                  if (timePeriod === "Last Month" && periods) {
                    // Use the display period designed for user-facing presentation
                    displayText = periods.displayPeriod;
                  } else if (timePeriod === "Last Quarter") {
                    // Show the last 3 months based on display period
                    if (periods) {
                      // Parse "July 2025" format properly
                      const [monthName, year] = periods.displayPeriod.split(' ');
                      const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
                      const endDate = new Date(parseInt(year), monthIndex + 1, 0); // Last day of the month
                      const startDate = new Date(endDate);
                      startDate.setMonth(startDate.getMonth() - 2);
                      displayText = `${startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
                    }
                  } else if (timePeriod === "Last Year" && periods) {
                    // Parse "July 2025" format properly for 12-month range
                    const [monthName, year] = periods.displayPeriod.split(' ');
                    const monthIndex = new Date(`${monthName} 1, 2000`).getMonth();
                    const endDate = new Date(parseInt(year), monthIndex + 1, 0); // Last day of the month
                    const startDate = new Date(endDate);
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    startDate.setMonth(startDate.getMonth() + 1); // Start from next month of previous year
                    displayText = `${startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
                  }

                  return displayText ? (
                    <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-600">
                        Selected Period:
                      </p>
                      <p className="text-xs font-semibold text-slate-800 leading-tight">
                        {displayText}
                      </p>
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>

            {/* Competitors Card - Keep existing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Building2 className="h-5 w-5 mr-3 text-primary" />
                  Competitors
                </CardTitle>
              </CardHeader>
              <CardContent>
                {competitors.length > 0 ? (
                  <div className="space-y-2">
                    {competitors.map((competitor: any) => (
                      <div
                        key={competitor.id}
                        className="flex items-center justify-between h-10 px-3 rounded-lg border bg-slate-50 border-slate-200"
                      >
                        <span className="text-sm truncate flex-1 mr-2">
                          {competitor.domain.replace(/^https?:\/\//, "")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingCompetitorId === competitor.id}
                          onClick={() => deleteCompetitor(competitor.id)}
                          className="h-6 w-6 p-0"
                        >
                          {deletingCompetitorId === competitor.id ? (
                            <ButtonLoadingSpinner size="sm" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))}
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
                    className="w-full h-10 mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Manage Competitors
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Metrics Grid - Simplified with processed data */}
          <div className="space-y-8 lg:space-y-16">
            {metricNames.map((metricName) => {
              // Special handling for Website Effectiveness metric
              if (metricName === "Website Effectiveness") {
                return (
                  <div
                    key={metricName}
                    id={`metric-${metricName.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <EffectivenessCard clientId={effectiveClientId || ''} className="mb-8" />
                  </div>
                );
              }

              const metricData = groupedMetrics[metricName] || {};
              const insight = insightsLookup[metricName];

              return (
                <Card
                  key={metricName}
                  id={`metric-${metricName.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg lg:text-xl flex justify-between items-start">
                      <div className="flex flex-col gap-2">
                        <span>{metricName}</span>
                        {!["Traffic Channels", "Device Distribution", "Website Effectiveness"].includes(metricName) && (
                          <div>
                            {(() => {
                              // Only show comparison chips for target metrics
                              const targetMetrics = ["Bounce Rate", "Session Duration", "Pages per Session", "Sessions per User"];
                              const showComparisons = targetMetrics.includes(metricName) && metricData.Client;
                              
                              if (showComparisons) {
                                const competitors = getCompetitorChartData(metricName);
                                const comparisonData = generateComparisonData(
                                  metricData.Client,
                                  metricData.Industry_Avg || 0,
                                  competitors,
                                  metricName
                                );
                                
                                return (
                                  <div className="flex flex-wrap items-center gap-1">
                                    {comparisonData.industry && (
                                      <ComparisonChip
                                        label="Industry Avg"
                                        percentage={comparisonData.industry.percentage}
                                        isOutperforming={comparisonData.industry.isOutperforming}
                                        className="text-xs"
                                        data-testid={`industry-chip-${metricName.replace(/\s+/g, '-').toLowerCase()}`}
                                      />
                                    )}
                                    {comparisonData.bestCompetitor && (
                                      <ComparisonChip
                                        label="Best Competitor"
                                        percentage={comparisonData.bestCompetitor.percentage}
                                        isOutperforming={comparisonData.bestCompetitor.isOutperforming}
                                        className="text-xs"
                                        data-testid={`competitor-chip-${metricName.replace(/\s+/g, '-').toLowerCase()}`}
                                      />
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      {!["Traffic Channels", "Device Distribution", "Website Effectiveness"].includes(metricName) && (
                        <span className="text-xl sm:text-2xl lg:text-3xl font-light text-primary flex-shrink-0">
                          {metricData.Client
                            ? (() => {
                                const converted = convertMetricValue({
                                  metricName,
                                  sourceType: 'Client',
                                  rawValue: metricData.Client
                                });
                                return formatMetricDisplay(converted);
                              })()
                            : "N/A"}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50/50 rounded-xl p-4 sm:p-6">
                      <div className="h-64">
                        {/* Render appropriate chart based on metric */}
                        {metricName === "Bounce Rate" && (
                          <TimeSeriesChart
                            metricName={metricName}
                            timePeriod={timePeriod}
                            clientData={metricData.Client || 0}
                            industryAvg={metricData.Industry_Avg || 0}
                            cdAvg={metricData.CD_Avg || 0}
                            clientUrl={client?.name || client?.websiteUrl}
                            timeSeriesData={dashboardData?.timeSeriesData}
                            periods={dashboardData?.periods}
                            competitors={getCompetitorChartData(metricName)}
                          />
                        )}
                        {metricName === "Session Duration" && (
                          <MetricBarChart
                            metricName={metricName}
                            timePeriod={timePeriod}
                            clientData={metricData.Client || 0}
                            industryAvg={metricData.Industry_Avg || 0}
                            cdAvg={metricData.CD_Avg || 0}
                            clientUrl={client?.name || client?.websiteUrl}
                            timeSeriesData={dashboardData?.timeSeriesData}
                            periods={dashboardData?.periods}
                            competitors={getCompetitorChartData(metricName)}
                          />
                        )}
                        {metricName === "Traffic Channels" && (
                          <StackedBarChart
                            data={trafficChannelData}
                            title="Traffic Channel Distribution"
                            description="Percentage breakdown of traffic sources"
                          />
                        )}
                        {(metricName === "Pages per Session" || metricName === "Sessions per User") && (
                          <TimeSeriesChart
                            metricName={metricName}
                            timePeriod={timePeriod}
                            clientData={metricData.Client || 0}
                            industryAvg={metricData.Industry_Avg || 0}
                            cdAvg={metricData.CD_Avg || 0}
                            clientUrl={client?.name || client?.websiteUrl}
                            timeSeriesData={dashboardData?.timeSeriesData}
                            periods={dashboardData?.periods}
                            competitors={getCompetitorChartData(metricName)}
                          />
                        )}
                        {metricName === "Device Distribution" && (() => {
                          // Get fresh data right when we need it
                          const currentDeviceData = processedData?.deviceDistribution || [];
                          
                          // Extract REAL data for each source - NO FALLBACKS
                          interface DeviceData {
                            name: string;
                            percentage?: number;
                            value?: number;
                          }
                          
                          interface DeviceDistribution {
                            sourceType: string;
                            devices?: DeviceData[];
                          }
                          
                          const clientData = (() => {
                            const data = currentDeviceData.find((d: DeviceDistribution) => d.sourceType === "Client");
                            if (!data || !data.devices || data.devices.length === 0) return null;
                            const desktop = data.devices.find((d: DeviceData) => d.name === 'Desktop');
                            const mobile = data.devices.find((d: DeviceData) => d.name === 'Mobile');
                            if (!desktop && !mobile) return null;
                            return {
                              Desktop: desktop?.percentage || desktop?.value || 0,
                              Mobile: mobile?.percentage || mobile?.value || 0
                            };
                          })();
                          
                          const industryData = (() => {
                            const data = currentDeviceData.find((d: DeviceDistribution) => d.sourceType === "Industry_Avg");
                            if (!data || !data.devices || data.devices.length === 0) return null;
                            const desktop = data.devices.find((d: DeviceData) => d.name === 'Desktop');
                            const mobile = data.devices.find((d: DeviceData) => d.name === 'Mobile');
                            if (!desktop && !mobile) return null;
                            return {
                              Desktop: desktop?.percentage || desktop?.value || 0,
                              Mobile: mobile?.percentage || mobile?.value || 0
                            };
                          })();
                          
                          const cdData = (() => {
                            const data = currentDeviceData.find((d: DeviceDistribution) => d.sourceType === "CD_Avg");
                            if (!data || !data.devices || data.devices.length === 0) return null;
                            const desktop = data.devices.find((d: DeviceData) => d.name === 'Desktop');
                            const mobile = data.devices.find((d: DeviceData) => d.name === 'Mobile');
                            if (!desktop && !mobile) return null;
                            return {
                              Desktop: desktop?.percentage || desktop?.value || 0,
                              Mobile: mobile?.percentage || mobile?.value || 0
                            };
                          })();
                          
                          // Get REAL competitor data only - transform to LollipopChart format
                          const competitorData = competitors.map((competitor: any) => {
                            const data = currentDeviceData.find((d: DeviceDistribution) => d.sourceType === `Competitor_${competitor.id}`);
                            if (!data || !data.devices || data.devices.length === 0) return null;
                            const desktop = data.devices.find((d: DeviceData) => d.name === 'Desktop');
                            const mobile = data.devices.find((d: DeviceData) => d.name === 'Mobile');
                            // Include even if only desktop or only mobile (that might be real data)
                            if (!desktop && !mobile) return null;
                            return {
                              id: competitor.id,
                              label: competitor.label || competitor.domain.replace(/^https?:\/\//, "").replace(/^www\./, ""),
                              value: {
                                Desktop: desktop?.percentage || desktop?.value || 0,
                                Mobile: mobile?.percentage || mobile?.value || 0
                              }
                            };
                          }).filter((item): item is NonNullable<typeof item> => item !== null); // Remove nulls with proper typing
                          
                          // Only render chart if we have client data at minimum
                          if (!clientData) {
                            return (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center text-slate-500">
                                  <div className="mb-2">📊</div>
                                  <div className="text-sm">No device distribution data available</div>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <LollipopChart
                              data={clientData}
                              competitors={competitorData}
                              clientUrl={client?.websiteUrl}
                              clientName={client?.name}
                              industryAvg={industryData || { Desktop: 0, Mobile: 0 }}
                              cdAvg={cdData || { Desktop: 0, Mobile: 0 }}
                            />
                          );
                        })()}
                      </div>
                    </div>

                    {/* AI Insights Section */}
                    <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-4 sm:p-6 mt-6">
                      <div className="flex items-center mb-4">
                        <Sparkles className="h-5 w-5 text-primary mr-3" />
                        <h3 className="text-base sm:text-lg font-bold text-primary">
                          Pulse AI Insight
                        </h3>
                        {metricStatuses[metricName] && (
                          <div className="ml-auto">
                            {metricStatuses[metricName] === "success" && (
                              <CheckCircle2 className="h-6 w-6 text-green-500" />
                            )}
                            {metricStatuses[metricName] === "needs_improvement" && (
                              <AlertTriangle className="h-6 w-6 text-orange-500" />
                            )}
                            {metricStatuses[metricName] === "warning" && (
                              <XCircle className="h-6 w-6 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                      <MetricInsightBox
                        metricName={metricName}
                        clientId={client?.id || ""}
                        timePeriod={timePeriod}
                        metricData={{
                          metricName,
                          clientValue: metricData?.Client || null,
                          industryAverage: metricData?.Industry_Avg || null,
                          cdAverage: metricData?.CD_Avg || null,
                          competitorValues: [],
                          competitorNames: [],
                        }}
                        preloadedInsight={insight || null}
                        onStatusChange={(status) => {
                          setMetricStatuses((prev) => ({
                            ...prev,
                            [metricName]: status,
                          }));
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Competitor Modal */}
      <CompetitorModal
        isOpen={showCompetitorModal}
        onClose={() => setShowCompetitorModal(false)}
        competitors={competitors}
        clientId={viewAsClientId || user?.clientId || ""}
      />

      {/* Footer */}
      <div className="lg:ml-64">
        <Footer />
      </div>
    </div>
  );
}