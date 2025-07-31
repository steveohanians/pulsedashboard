import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { LogOut, Plus, Settings, Users, Building2, Filter, Calendar, Clock, Lightbulb, Info, TrendingUp, ExternalLink, X, Menu } from "lucide-react";
import { Link } from "wouter";
import MetricsChart from "@/components/metrics-chart";
import TimeSeriesChart from "@/components/time-series-chart";
import SessionDurationAreaChart from "@/components/area-chart";
import MetricBarChart from "@/components/bar-chart";
import { StackedBarChart } from "@/components/stacked-bar-chart";
import AIInsights from "@/components/ai-insights";
import CompetitorModal from "@/components/competitor-modal";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [timePeriod, setTimePeriod] = useState("Last Month");
  const [customDateRange, setCustomDateRange] = useState("");
  const [businessSize, setBusinessSize] = useState("All");
  const [industryVertical, setIndustryVertical] = useState("All");
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  // Date picker state (currently unused but preserved for future custom date range feature)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeSection, setActiveSection] = useState<string>("Bounce Rate");
  const [manualClick, setManualClick] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  interface DashboardData {
    client: {
      id: string;
      name: string;
      websiteUrl: string;
    };
    metrics: Array<{
      metricName: string;
      value: string;
      sourceType: string;
      channel?: string;
      competitorId?: string;
    }>;
    competitors: Array<{
      id: string;
      name: string;
      websiteUrl: string;
      domain: string;
    }>;
    insights: Array<{
      metricName: string;
      context: string;
      insight: string;
      recommendation: string;
    }>;
  }

  interface FiltersData {
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
  }

  const dashboardQuery = useQuery<DashboardData>({
    queryKey: [`/api/dashboard/${user?.clientId}?period=${encodeURIComponent(timePeriod)}`],
    enabled: !!user?.clientId,
  });
  
  const { data: dashboardData, isLoading } = dashboardQuery;

  const { data: filtersData } = useQuery<FiltersData>({
    queryKey: ["/api/filters"],
  });

  const client = dashboardData?.client;
  const metrics = dashboardData?.metrics || [];
  const competitors = dashboardData?.competitors || [];
  const insights = dashboardData?.insights || [];



  // Group metrics by name for chart display
  const groupedMetrics = metrics.reduce((acc: Record<string, Record<string, number>>, metric) => {
    if (!acc[metric.metricName]) {
      acc[metric.metricName] = {};
    }
    acc[metric.metricName][metric.sourceType] = parseFloat(metric.value);
    return acc;
  }, {} as Record<string, Record<string, number>>);

  // Process traffic channel data for stacked bar chart
  const processTrafficChannelData = () => {
    const trafficMetrics = metrics.filter(m => m.metricName === 'Traffic Channels');
    const sourceTypes = ['Client', 'CD_Avg', 'Industry_Avg'];
    
    // Add competitor data
    const competitorData = trafficMetrics.filter(m => m.sourceType === 'Competitor');
    const competitorSources = competitors.map((comp, index) => `Competitor ${index + 1}`);

    const CHANNEL_COLORS = {
      'Organic Search': '#10b981',
      'Direct': '#3b82f6', 
      'Social Media': '#8b5cf6',
      'Paid Search': '#f59e0b',
      'Email': '#ec4899',
      'Other': '#6b7280',
    };

    const allSources = [...sourceTypes, ...competitorSources];
    
    return allSources.map((sourceType, index) => {
      let sourceMetrics;
      let label;
      
      if (sourceType.startsWith('Competitor')) {
        const competitorIndex = parseInt(sourceType.split(' ')[1]) - 1;
        const competitor = competitors[competitorIndex];
        sourceMetrics = trafficMetrics.filter(m => 
          m.sourceType === 'Competitor' && m.competitorId === competitor?.id
        );
        label = competitor?.domain?.replace(/https?:\/\//, '') || sourceType;
      } else {
        sourceMetrics = trafficMetrics.filter(m => m.sourceType === sourceType);
        label = sourceType === 'Client' ? client?.name || 'Client' :
               sourceType === 'CD_Avg' ? 'CD Client Avg' :
               'Industry Avg';
      }

      const channels = sourceMetrics.map(m => ({
        name: m.channel || 'Other',
        value: parseFloat(m.value),
        percentage: parseFloat(m.value),
        color: CHANNEL_COLORS[m.channel as keyof typeof CHANNEL_COLORS] || CHANNEL_COLORS.Other
      }));

      return {
        sourceType,
        label,
        channels
      };
    }).filter(item => item.channels.length > 0);
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



  if (isLoading) {
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
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Pulse Dashboard™</h1>
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
          <div className="flex items-center space-x-2 sm:space-x-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 rounded-full flex items-center justify-center transition-all hover:scale-105">
                <span className="text-xs sm:text-sm font-bold text-primary">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-slate-700 hidden sm:block">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden hover:bg-slate-100 transition-all duration-200"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="hover:bg-slate-100 transition-all duration-200 hover:scale-105"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
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
            </div>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Desktop Left Navigation */}
        <nav className="w-64 bg-white border-r border-slate-200 fixed top-24 left-0 bottom-0 z-10 overflow-y-auto hidden lg:block">
          <div className="p-4">
            <h2 className="text-base font-bold text-slate-800 mb-4">Metrics</h2>
            <ul className="space-y-2">
              {metricNames.map((metricName) => (
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
            </ul>
          </div>
        </nav>

        {/* Enhanced Main Content - Responsive */}
        <div className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Enhanced Filters Section - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 lg:mb-12">
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
                <Select value={businessSize} onValueChange={setBusinessSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filtersData?.businessSizes?.map((size: string) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Industry Vertical</label>
                <Select value={industryVertical} onValueChange={setIndustryVertical}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filtersData?.industryVerticals?.map((vertical: string) => (
                      <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Select value={timePeriod} onValueChange={(value) => {
                if (value === "Custom Date Range") {
                  setShowDatePicker(true);
                } else {
                  setTimePeriod(value);
                  setCustomDateRange("");
                }
              }}>
                <SelectTrigger>
                  <SelectValue>{timePeriod || "Select time period"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filtersData?.timePeriods?.map((period: string) => (
                    <SelectItem key={period} value={period}>{period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Display time period details below dropdown */}
              {(() => {
                let displayText = "";
                if (timePeriod === "Custom Date Range" && customDateRange) {
                  displayText = customDateRange;
                } else if (timePeriod === "Last Month") {
                  const lastMonth = new Date();
                  lastMonth.setMonth(lastMonth.getMonth() - 1);
                  displayText = lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                } else if (timePeriod === "Last Quarter") {
                  const now = new Date();
                  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
                  const lastQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
                  const lastQuarterYear = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
                  displayText = `Q${lastQuarter} ${lastQuarterYear}`;
                } else if (timePeriod === "Last Year") {
                  const endDate = new Date();
                  endDate.setMonth(endDate.getMonth() - 1); // Last month
                  const startDate = new Date(endDate);
                  startDate.setFullYear(startDate.getFullYear() - 1); // 12 months ago
                  displayText = `${startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                }
                
                return displayText ? (
                  <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-600">Selected Period:</p>
                    <p className="text-sm font-semibold text-slate-800">{displayText}</p>
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
                  {competitors.map((competitor: any) => (
                    <div
                      key={competitor.id}
                      className="flex items-center justify-between h-10 px-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <span className="text-sm text-slate-900 truncate flex-1 mr-2">
                        {competitor.domain.replace('https://', '').replace('http://', '')}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/competitors/${competitor.id}`, {
                              method: 'DELETE',
                              credentials: 'include'
                            });
                            if (response.ok) {
                              // Use React Query to refetch data instead of page reload
                              dashboardQuery.refetch();
                            }
                          } catch (error) {
                            console.error('Error deleting competitor:', error);
                          }
                        }}
                        className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
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
                  className={`w-full h-10 hover:shadow-[0_0_15px_rgba(156,163,175,0.25)] transition-all duration-200 ${
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

        {/* AI Insights Generation */}
        <div className="mb-12">
          <Button
            onClick={async () => {
              try {
                const response = await fetch(`/api/generate-insights/${user?.clientId}?period=${timePeriod}`, {
                  method: 'POST',
                  credentials: 'include'
                });
                if (response.ok) {
                  // Refresh dashboard data to show new insights
                  dashboardQuery.refetch();
                }
              } catch (error) {
                console.error('Error generating insights:', error);
              }
            }}
            className="w-full h-14 text-base font-semibold hover:shadow-[0_0_20px_rgba(156,163,175,0.3)] transition-all duration-200 bg-gradient-to-r from-primary to-primary/90"
          >
            <Lightbulb className="h-5 w-5 mr-3" />
            Generate AI Insights for All Metrics
          </Button>
        </div>

        {/* Enhanced Metrics Grid */}
        <div className="space-y-8 lg:space-y-16">
          {metricNames.map((metricName) => {
            const metricData = groupedMetrics[metricName] || {};
            const insight = insights.find((i: any) => i.metricName === metricName);
            

            
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
                    <div className="text-left sm:text-right">
                      <span className="text-2xl lg:text-3xl font-light text-primary block tracking-tight">
                        {metricData.Client ? Math.round(metricData.Client * 10) / 10 : "N/A"}
                        {metricName.includes("Rate") ? "%" : metricName.includes("Session Duration") ? " min" : metricName.includes("Pages per Session") ? " pages" : metricName.includes("Sessions per User") ? " sessions" : ""}
                      </span>
                      <span className="text-sm text-slate-500 font-medium">Your Performance</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 lg:space-y-8">
                  {/* Enhanced Chart Container */}
                  <div className="bg-slate-50/50 rounded-xl p-3 sm:p-4 lg:p-6 mb-6 lg:mb-8">
                    <div className="h-48 sm:h-64 lg:h-72">
                      {metricName === "Bounce Rate" ? (
                        <TimeSeriesChart 
                          metricName={metricName}
                          timePeriod={timePeriod}
                          clientData={metricData.Client || 0}
                          industryAvg={metricData.Industry_Avg || 0}
                          cdAvg={metricData.CD_Avg || 0}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          competitors={competitors.map((comp: any) => {
                            // Find metric for this competitor
                            const competitorMetric = metrics.find((m: any) => 
                              m.competitorId === comp.id && m.metricName === metricName
                            );
                            return {
                              id: comp.id,
                              label: comp.domain.replace('https://', '').replace('http://', ''),
                              value: competitorMetric ? parseFloat(competitorMetric.value) : 42.3
                            };
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
                          competitors={competitors.map((comp: any) => {
                            // Find metric for this competitor
                            const competitorMetric = metrics.find((m: any) => 
                              m.competitorId === comp.id && m.metricName === metricName
                            );
                            return {
                              id: comp.id,
                              label: comp.domain.replace('https://', '').replace('http://', ''),
                              value: competitorMetric ? parseFloat(competitorMetric.value) : 3.2
                            };
                          })}
                        />
                      ) : metricName === "Traffic Channels" ? (
                        <StackedBarChart 
                          data={processTrafficChannelData()}
                          title="Traffic Channel Distribution"
                          description="Percentage breakdown of traffic sources"
                        />
                      ) : metricName === "Pages per Session" || metricName === "Sessions per User" ? (
                        <TimeSeriesChart 
                          metricName={metricName}
                          timePeriod={timePeriod}
                          clientData={metricData.Client || 0}
                          industryAvg={metricData.Industry_Avg || 0}
                          cdAvg={metricData.CD_Avg || 0}
                          clientUrl={dashboardData?.client?.websiteUrl?.replace('https://', '').replace('http://', '')}
                          competitors={competitors.map((comp: any) => {
                            // Find metric for this competitor
                            const competitorMetric = metrics.find((m: any) => 
                              m.competitorId === comp.id && m.metricName === metricName
                            );
                            return {
                              id: comp.id,
                              label: comp.domain.replace('https://', '').replace('http://', ''),
                              value: competitorMetric ? parseFloat(competitorMetric.value) : (metricName === "Sessions per User" ? 1.6 : 2.8)
                            };
                          })}
                        />
                      ) : (
                        <MetricsChart metricName={metricName} data={metricData} />
                      )}
                    </div>
                  </div>
                  
                  {/* Enhanced AI-Generated Insights */}
                  <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-4 sm:p-6 shadow-sm">
                    <div className="flex items-center mb-4 sm:mb-6">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-full flex items-center justify-center mr-3 sm:mr-4 flex-shrink-0">
                        <Lightbulb className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-primary tracking-tight">Pulse™ AI Insight</h3>
                        <p className="text-xs sm:text-sm text-slate-600">AI-powered analysis and recommendations</p>
                      </div>
                    </div>
                    {insight ? (
                      <AIInsights
                        context={insight.context}
                        insight={insight.insight}
                        recommendation={insight.recommendation}
                      />
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center">
                              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                                <Info className="h-3 w-3 text-primary" />
                              </div>
                              Context
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {metricName} is a key performance indicator that measures {
                                metricName === "Bounce Rate" ? "the percentage of visitors who leave your site after viewing only one page" :
                                metricName === "Session Duration" ? "how long users spend on your website during a single visit" :
                                metricName === "Pages per Session" ? "the average number of pages viewed during a single session" :
                                metricName === "Sessions per User" ? "how frequently users return to your website" :
                                metricName === "Traffic Channels" ? "how visitors find and reach your website" :
                                "user engagement and device preferences"
                              }. This metric is crucial for understanding user engagement and optimizing your digital strategy.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center">
                              <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center mr-3">
                                <Lightbulb className="h-3 w-3 text-yellow-600" />
                              </div>
                              Insight
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              Your current {metricName.toLowerCase()} of {metricData.Client || "N/A"} 
                              {metricName.includes("Rate") ? "%" : ""} shows {
                                metricData.Client > (metricData.Industry_Avg || 0) ? "above-average" : "below-average"
                              } performance compared to industry benchmarks. This indicates {
                                metricData.Client > (metricData.Industry_Avg || 0) ? 
                                "strong user engagement and effective content strategy" :
                                "opportunities for improvement in user experience and content optimization"
                              }.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center">
                              <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mr-3">
                                <TrendingUp className="h-3 w-3 text-green-600" />
                              </div>
                              Recommendation
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {metricData.Client > (metricData.Industry_Avg || 0) ? 
                                `Continue your current strategy while exploring advanced optimization techniques. Consider A/B testing new approaches to maintain your competitive advantage.` :
                                `Focus on improving ${metricName.toLowerCase()} through targeted optimization. Consider analyzing user behavior, improving page load times, and enhancing content relevance.`
                              } Monitor this metric weekly and implement data-driven improvements.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enhanced Admin Panel Link */}
        {user?.role === "Admin" && (
          <Card className="mt-16 border-slate-200/60 shadow-lg hover:shadow-[0_0_25px_rgba(156,163,175,0.2)] transition-all duration-300 rounded-2xl bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg font-bold">
                <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center mr-3">
                  <Settings className="h-4 w-4 text-primary" />
                </div>
                Admin Panel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin-panel">
                <Button className="w-full h-14 flex items-center justify-center text-base font-semibold shadow-md hover:shadow-[0_0_20px_rgba(255,20,147,0.3)] transition-all duration-200 bg-gradient-to-r from-primary to-primary/90">
                  <Settings className="h-5 w-5 mr-3" />
                  <span>Go to Admin Panel</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </div>

        {/* Competitor Modal */}
        <CompetitorModal
          isOpen={showCompetitorModal}
          onClose={() => setShowCompetitorModal(false)}
          competitors={competitors}
          clientId={user?.clientId || ""}
        />
      </div>
    </div>
  );
}
