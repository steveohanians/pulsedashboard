import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ChartLine, LogOut, Plus, Settings, Users, Building2, Filter, Calendar, Lightbulb, Info, TrendingUp, Clock } from "lucide-react";
import { Link } from "wouter";
import MetricsChart from "@/components/metrics-chart";
import AIInsights from "@/components/ai-insights";
import CompetitorModal from "@/components/competitor-modal";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [timePeriod, setTimePeriod] = useState("Last Month");
  const [businessSize, setBusinessSize] = useState("All");
  const [industryVertical, setIndustryVertical] = useState("All");
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeSection, setActiveSection] = useState<string>("Bounce Rate");
  const [manualClick, setManualClick] = useState<boolean>(false);

  interface DashboardData {
    client: any;
    metrics: any[];
    competitors: any[];
    insights: any[];
  }

  interface FiltersData {
    businessSizes: string[];
    industryVerticals: string[];
    timePeriods: string[];
  }

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard", user?.clientId, { period: timePeriod }],
    enabled: !!user?.clientId,
  });

  const { data: filtersData } = useQuery<FiltersData>({
    queryKey: ["/api/filters"],
  });

  const client = dashboardData?.client;
  const metrics = dashboardData?.metrics || [];
  const competitors = dashboardData?.competitors || [];
  const insights = dashboardData?.insights || [];

  // Group metrics by name for chart display
  const groupedMetrics = metrics.reduce((acc: any, metric: any) => {
    if (!acc[metric.metricName]) {
      acc[metric.metricName] = {};
    }
    acc[metric.metricName][metric.sourceType] = parseFloat(metric.value);
    return acc;
  }, {});

  const metricNames = ["Bounce Rate", "Avg Session Duration", "Pages per Session", "Sessions per User", "Traffic Channels", "Device Distribution"];

  const scrollToMetric = (metricName: string) => {
    const element = document.getElementById(`metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`);
    if (element) {
      const headerHeight = 64; // Height of sticky header
      const elementPosition = element.offsetTop - headerHeight - 20; // Extra 20px padding
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

  // Simple scroll-based highlighting with throttling
  useEffect(() => {
    if (isLoading) return;
    
    let isThrottled = false;
    let lastActiveSection = activeSection;
    
    const handleScroll = () => {
      if (isThrottled || manualClick) return;
      isThrottled = true;
      
      setTimeout(() => {
        const scrollY = window.scrollY;
        const triggerPoint = scrollY + 200; // Simple trigger point
        
        // Find active section by checking which section's top is closest to trigger point
        let closestSection = "Bounce Rate";
        let closestDistance = Infinity;
        
        metricNames.forEach(metricName => {
          const element = document.getElementById(`metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`);
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
      }, 400); // Increased throttle to 400ms for stability
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, metricNames]);



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src={clearLogoPath} 
              alt="Clear Digital Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold text-slate-900">Pulse Dashboard™</h1>
              <p className="text-xs text-slate-600">{client?.name || "Client Name"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-slate-600">{client?.websiteUrl}</span>
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-slate-700">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-700">{user?.name}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Navigation */}
        <nav className="w-64 bg-white border-r border-slate-200 fixed top-16 left-0 bottom-0 z-10 overflow-y-auto">
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

        {/* Main Content */}
        <div className="flex-1 ml-64 p-6 max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <Filter className="h-4 w-4 mr-2" />
                Industry Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <Clock className="h-4 w-4 mr-2" />
                Time Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={timePeriod} onValueChange={(value) => {
                if (value === "Custom Date Range") {
                  setShowDatePicker(true);
                } else {
                  setTimePeriod(value);
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
                            const formattedRange = `Custom: ${startDate} to ${endDate}`;
                            setTimePeriod(formattedRange);
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <Building2 className="h-4 w-4 mr-2" />
                Competitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowCompetitorModal(true)}
                className="w-full mb-3"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage Competitors
              </Button>
            </CardContent>
          </Card>


        </div>

        {/* AI Insights Generation */}
        <div className="mb-6">
          <Button
            onClick={async () => {
              try {
                const response = await fetch(`/api/generate-insights/${user?.clientId}?period=${timePeriod}`, {
                  method: 'POST',
                  credentials: 'include'
                });
                if (response.ok) {
                  // Refresh dashboard data to show new insights
                  window.location.reload();
                }
              } catch (error) {
                console.error('Error generating insights:', error);
              }
            }}
            className="w-full h-12"
          >
            <Lightbulb className="h-5 w-5 mr-2" />
            Generate AI Insights for All Metrics
          </Button>
        </div>

        {/* Metrics Grid - Full Width */}
        <div className="grid grid-cols-1 gap-8">
          {metricNames.map((metricName) => {
            const metricData = groupedMetrics[metricName] || {};
            const insight = insights.find((i: any) => i.metricName === metricName);
            
            return (
              <Card key={metricName} id={`metric-${metricName.replace(/\s+/g, '-').toLowerCase()}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{metricName}</CardTitle>
                    <span className="text-xl font-bold text-primary">
                      {metricData.Client || "N/A"}
                      {metricName.includes("Rate") ? "%" : ""}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 mb-6">
                    <MetricsChart metricName={metricName} data={metricData} />
                  </div>
                  
                  {/* Mandatory AI-Generated Insights */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                    <div className="flex items-center mb-3">
                      <Lightbulb className="h-5 w-5 text-primary mr-2" />
                      <h3 className="text-sm font-bold text-primary">Pulse™ AI Insight</h3>
                    </div>
                    {insight ? (
                      <AIInsights
                        context={insight.contextText}
                        insight={insight.insightText}
                        recommendation={insight.recommendationText}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center">
                            <Info className="h-3 w-3 mr-2 text-primary" />
                            Context
                          </h4>
                          <p className="text-xs text-slate-600">
                            {metricName} is a key performance indicator that measures {
                              metricName === "Bounce Rate" ? "the percentage of visitors who leave your site after viewing only one page" :
                              metricName === "Avg Session Duration" ? "how long users spend on your website during a single visit" :
                              metricName === "Pages per Session" ? "the average number of pages viewed during a single session" :
                              metricName === "Sessions per User" ? "how frequently users return to your website" :
                              metricName === "Traffic Channels" ? "how visitors find and reach your website" :
                              "user engagement and device preferences"
                            }. This metric is crucial for understanding user engagement and optimizing your digital strategy.
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center">
                            <Lightbulb className="h-3 w-3 mr-2 text-yellow-500" />
                            Insight
                          </h4>
                          <p className="text-xs text-slate-600">
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
                          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-2 text-green-500" />
                            Recommendation
                          </h4>
                          <p className="text-xs text-slate-600">
                            {metricData.Client > (metricData.Industry_Avg || 0) ? 
                              `Continue your current strategy while exploring advanced optimization techniques. Consider A/B testing new approaches to maintain your competitive advantage.` :
                              `Focus on improving ${metricName.toLowerCase()} through targeted optimization. Consider analyzing user behavior, improving page load times, and enhancing content relevance.`
                            } Monitor this metric weekly and implement data-driven improvements.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin Panel Link */}
        {user?.role === "Admin" && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <Settings className="h-4 w-4 mr-2" />
                Admin Panel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link href="/admin-panel">
                <Button className="w-full h-12 flex items-center justify-center">
                  <Settings className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Go to Admin Panel</span>
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
