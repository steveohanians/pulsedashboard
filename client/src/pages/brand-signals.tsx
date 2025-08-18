import { useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  LogOut, 
  TrendingUp, 
  RefreshCw,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PdfExportButton from "@/components/pdf/PdfExportButton";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function BrandSignals() {
  const brandSignalsRef = useRef<HTMLDivElement>(null);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [showRawData, setShowRawData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // Get client and competitors from existing dashboard data
  const { client, competitors } = useDashboardData({
    clientId: user?.clientId || '',
    timePeriod: 'Last Month',
    businessSize: 'All',
    industryVertical: 'All'
  });

  // Add progress with simple string format
  const addProgress = (message: string) => {
    setProgressSteps(prev => [...prev, message]);
    setCurrentStep(prev => prev + 1);
  };

  // Function to run SoV analysis with direct response
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResults(null);
    setProgressSteps([]);
    setErrorMessage("");
    setCurrentStep(-1);
    
    try {
      // Format URLs properly
      const formatUrl = (url: string) => {
        if (!url) return 'https://unknown.com';
        let cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
        return `https://${cleanUrl}`;
      };

      // Build the request payload
      const payload = {
        brand: {
          name: client?.name || 'Unknown',
          url: formatUrl(client?.websiteUrl || 'unknown.com')
        },
        competitors: competitors.slice(0, 3).map((c: any) => ({
          name: c.label || c.name || c.domain.split('.')[0],
          url: formatUrl(c.domain)
        })),
        vertical: client?.industryVertical || 'General'
      };
      
      // Show progress messages one at a time with delays
      addProgress(`Starting analysis for ${payload.brand.name}...`);
      
      // Add delay to show progress
      setTimeout(() => {
        addProgress(`Analyzing against ${payload.competitors.length} competitors`);
      }, 500);
      
      setTimeout(() => {
        addProgress(`Processing... This may take 2-3 minutes`);
      }, 1000);
      
      // Call the API and wait for results
      const response = await fetch('/api/sov/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if we got valid results
      if (data.success === false) {
        setErrorMessage(data.error || "Analysis failed");
        return;
      }
      
      // Set the results
      setAnalysisResults(data);
      addProgress(`✅ Analysis complete! Processed ${data.summary?.totalQuestions || 0} questions`);
      
      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${data.summary?.totalQuestions || 0} questions`,
      });
      
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : 'Analysis failed';
      setErrorMessage(errorMsg);
      
      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - EXACT SAME AS DASHBOARD */}
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
            {/* User Avatar and Name - Same as dashboard */}
            {user && (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Avatar className="h-8 w-8">
                  {client?.iconUrl && (
                    <AvatarImage 
                      src={client.iconUrl}
                      alt={client?.name || "Client"}
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {(user.name || user.email || "User").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline truncate max-w-24 lg:max-w-32">
                  {user.name || user.email}
                </span>
              </div>
            )}
            
            <PdfExportButton
              targetRef={brandSignalsRef}
              clientLabel={client?.name}
              clientName={client?.name}
              className="ml-1"
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div ref={brandSignalsRef} className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        
        {/* Back to Dashboard Link - IN BODY NOW */}
        <div className="mb-4">
          <Link href="/" className="inline-flex items-center text-sm text-slate-600 hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
        
        {/* Analysis Control Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 mr-3 text-primary" />
              Share of Voice Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                <p><strong>Client:</strong> {client?.name || 'Loading...'}</p>
                <p><strong>Website:</strong> {client?.websiteUrl?.replace(/^https?:\/\//, '') || 'Loading...'}</p>
                <p><strong>Competitors:</strong> {competitors?.length || 0} configured</p>
                {competitors?.length > 0 && (
                  <ul className="mt-2 ml-4">
                    {competitors.map((c: any) => (
                      <li key={c.id} className="text-xs">
                        • {c.label || c.domain.replace(/^https?:\/\//, '').replace(/^www\./, '')} ({c.domain.replace(/^https?:\/\//, '').replace(/^www\./, '')})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <Button 
                className="w-full h-10"
                onClick={runAnalysis}
                disabled={isAnalyzing || !client}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run New Analysis
                  </>
                )}
              </Button>
              
              {/* Progress Steps - Simplified */}
              {isAnalyzing && progressSteps.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Analysis Progress:</h4>
                  <div className="bg-slate-50 p-3 rounded-lg space-y-1">
                    {progressSteps.map((message, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-slate-700">{message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResults && (
          <>
            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Overall SoV</div>
                  <div className="text-2xl font-bold text-primary">
                    {analysisResults.metrics?.overallSoV?.[analysisResults.summary?.brand] || 0}%
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Question Coverage</div>
                  <div className="text-2xl font-bold text-primary">
                    {analysisResults.metrics?.questionCoverage?.[analysisResults.summary?.brand] || 0}%
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Market Leader</div>
                  <div className="text-lg font-bold text-slate-800 truncate">
                    {(() => {
                      const sov = analysisResults.metrics?.overallSoV || {};
                      const leader = Object.entries(sov).reduce((a, b) => 
                        (b[1] as number) > (a[1] as number) ? b : a, ['None', 0]);
                      return leader[0];
                    })()}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Total Mentions</div>
                  <div className="text-2xl font-bold text-primary">
                    {Object.values(analysisResults.metrics?.totalMentions || {})
                      .reduce((sum: number, val: any) => sum + (val as number), 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stage Performance Breakdown */}
            {analysisResults.questionResults && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg">Performance by Buyer Journey Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {['awareness', 'consideration', 'decision'].map(stage => {
                      const stageQuestions = analysisResults.questionResults.filter((q: any) => q.stage === stage);
                      const brandName = analysisResults.summary?.brand;
                      
                      // Calculate average SoV for this stage
                      const stageSoV = stageQuestions.reduce((sum: number, q: any) => {
                        return sum + (q.sov?.[brandName] || 0);
                      }, 0) / (stageQuestions.length || 1);
                      
                      // Find stage leader
                      const allBrands = new Set<string>();
                      stageQuestions.forEach((q: any) => {
                        Object.keys(q.sov || {}).forEach(brand => allBrands.add(brand));
                      });
                      
                      const brandAverages = Array.from(allBrands).map(brand => ({
                        brand,
                        avg: stageQuestions.reduce((sum: number, q: any) => 
                          sum + (q.sov?.[brand] || 0), 0) / (stageQuestions.length || 1)
                      }));
                      
                      const stageLeader = brandAverages.reduce((a, b) => 
                        b.avg > a.avg ? b : a, { brand: 'None', avg: 0 });
                      
                      const stageEmoji = stage === 'awareness' ? '🔍' : 
                                       stage === 'consideration' ? '🤔' : '✅';
                      
                      return (
                        <div key={stage} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{stageEmoji}</span>
                              <span className="font-medium capitalize">{stage}</span>
                              <span className="text-sm text-slate-500">({stageQuestions.length} questions)</span>
                            </div>
                            <div className="text-sm text-slate-600">
                              Leader: <span className="font-medium">{stageLeader.brand}</span> ({Math.round(stageLeader.avg)}%)
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-slate-700 w-20">Your SoV:</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-3">
                                  <div 
                                    className="bg-primary h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.round(stageSoV))}%` }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-slate-800 w-12 text-right">
                                  {Math.round(stageSoV)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitive Comparison */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Share of Voice by Competitor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(analysisResults.metrics?.overallSoV || {}).map(([brand, percentage]) => (
                    <div key={brand} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium text-slate-700 truncate">{brand}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                                brand === analysisResults.summary?.brand ? 'bg-primary' : 'bg-slate-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-800 w-16 text-right">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Strategic Insights */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>💡</span> Strategic Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const brandName = analysisResults.summary?.brand;
                    const brandSoV = analysisResults.metrics?.overallSoV?.[brandName] || 0;
                    const insights = [];
                    
                    // Generate insights based on data
                    if (brandSoV < 20) {
                      insights.push({
                        type: 'warning',
                        title: 'Low Brand Visibility',
                        text: 'Your brand has limited presence in AI-generated responses. Consider creating more authoritative content and building stronger brand signals.'
                      });
                    } else if (brandSoV > 40) {
                      insights.push({
                        type: 'success',
                        title: 'Strong Market Position',
                        text: 'Your brand is well-represented in AI responses. Continue building on this momentum with consistent content strategy.'
                      });
                    }
                    
                    // Check stage performance
                    const stages = ['awareness', 'consideration', 'decision'];
                    stages.forEach(stage => {
                      const stageQ = analysisResults.questionResults?.filter((q: any) => q.stage === stage) || [];
                      const avgSoV = stageQ.reduce((sum: number, q: any) => 
                        sum + (q.sov?.[brandName] || 0), 0) / (stageQ.length || 1);
                      
                      if (avgSoV < 15) {
                        insights.push({
                          type: 'warning',
                          title: `Weak ${stage.charAt(0).toUpperCase() + stage.slice(1)} Stage`,
                          text: `Low visibility in ${stage} stage queries. Focus on creating content that addresses ${
                            stage === 'awareness' ? 'educational and introductory topics' :
                            stage === 'consideration' ? 'comparison and evaluation criteria' :
                            'implementation and pricing information'
                          }.`
                        });
                      }
                    });
                    
                    return insights.map((insight, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${
                        insight.type === 'warning' ? 'bg-orange-50' : 'bg-green-50'
                      }`}>
                        <div className={`font-medium text-sm mb-1 ${
                          insight.type === 'warning' ? 'text-orange-800' : 'text-green-800'
                        }`}>
                          {insight.title}
                        </div>
                        <div className={`text-xs ${
                          insight.type === 'warning' ? 'text-orange-700' : 'text-green-700'
                        }`}>
                          {insight.text}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Raw Data Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Detailed Analysis Data
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRawData(!showRawData)}
                  >
                    {showRawData ? 'Hide' : 'Show'} Raw Data
                  </Button>
                </CardTitle>
              </CardHeader>
              {showRawData && (
                <CardContent>
                  <div className="bg-slate-100 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                      {JSON.stringify(analysisResults, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        )}

        {/* Placeholder for future sections */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-slate-400">Brand Perception - Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Track how AI platforms describe your brand with sentiment analysis and competitive positioning.
            </p>
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}