import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ChartLine, LogOut, Plus, Settings, Users, Building2, Filter, Calendar } from "lucide-react";
import { Link } from "wouter";
import MetricsChart from "@/components/metrics-chart";
import AIInsights from "@/components/ai-insights";
import CompetitorModal from "@/components/competitor-modal";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const [timePeriod, setTimePeriod] = useState("Last Month");
  const [businessSize, setBusinessSize] = useState("Medium Business (100–500 employees)");
  const [industryVertical, setIndustryVertical] = useState("All");
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center">
              <ChartLine className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pulse Dashboard™</h1>
              <p className="text-sm text-slate-600">{client?.name || "Loading..."}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600">{client?.websiteUrl}</span>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-slate-700">
                  {user?.name?.charAt(0) || "U"}
                </span>
              </div>
              <span className="text-sm font-medium text-slate-700">{user?.name}</span>
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
      </nav>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Industry Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Business Size</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry Vertical</label>
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
              <CardTitle>Time Period</CardTitle>
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
                  <SelectValue />
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
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
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
                            setTimePeriod(`${startDate} to ${endDate}`);
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
              <CardTitle>Competitors</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowCompetitorModal(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage Competitors
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {metricNames.map((metricName) => {
            const metricData = groupedMetrics[metricName] || {};
            const insight = insights.find((i: any) => i.metricName === metricName);
            
            return (
              <Card key={metricName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{metricName}</CardTitle>
                    <span className="text-2xl font-bold text-primary">
                      {metricData.Client || "N/A"}
                      {metricName.includes("Rate") ? "%" : ""}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 mb-6">
                    <MetricsChart metricName={metricName} data={metricData} />
                  </div>
                  {insight && (
                    <AIInsights
                      context={insight.contextText}
                      insight={insight.insightText}
                      recommendation={insight.recommendationText}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Admin Panel Link */}
        {user?.role === "Admin" && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Admin Panel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/admin?tab=filters">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Filter className="h-6 w-6 mb-2" />
                    <span className="text-sm">Filters Editor</span>
                  </Button>
                </Link>
                <Link href="/admin?tab=benchmark">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Building2 className="h-6 w-6 mb-2" />
                    <span className="text-sm">Benchmark Companies</span>
                  </Button>
                </Link>
                <Link href="/admin?tab=clients">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Users className="h-6 w-6 mb-2" />
                    <span className="text-sm">Clients Manager</span>
                  </Button>
                </Link>
                <Link href="/admin?tab=users">
                  <Button variant="outline" className="w-full h-20 flex flex-col">
                    <Settings className="h-6 w-6 mb-2" />
                    <span className="text-sm">Users Manager</span>
                  </Button>
                </Link>
              </div>
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
  );
}
