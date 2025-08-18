import { useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  LogOut, 
  TrendingUp, 
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Circle,
  XCircle,
  Info,
  Sparkles
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
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);
  const [isTestAnalysis, setIsTestAnalysis] = useState(false);
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

  // Function to run test analysis with well-known brands
  const runTestAnalysis = async () => {
    setIsAnalyzing(true);
    setIsTestAnalysis(true);
    setAnalysisResults(null);
    setProgressSteps([]);
    setErrorMessage("");
    
    try {
      // Hardcoded test data
      const testPayload = {
        brand: {
          name: "HubSpot",
          url: "https://www.hubspot.com"
        },
        competitors: [
          { name: "Salesforce", url: "https://www.salesforce.com" },
          { name: "Zoho", url: "https://www.zoho.com" },
          { name: "Mailchimp", url: "https://mailchimp.com" }
        ],
        vertical: "Marketing Software"
      };
      
      // Show progress messages
      setProgressSteps([`Starting test analysis for ${testPayload.brand.name}...`]);
      
      setTimeout(() => {
        setProgressSteps(prev => [...prev, `Analyzing against well-known competitors`]);
      }, 500);
      
      setTimeout(() => {
        setProgressSteps(prev => [...prev, `Processing... This may take 2-3 minutes`]);
      }, 1000);
      
      // Call the API with test data
      const response = await fetch('/api/sov/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if we got valid results
      if (data.success === false) {
        setErrorMessage(data.error || "Test analysis failed");
        setProgressSteps(prev => [...prev, `❌ Error: ${data.error}`]);
        return;
      }
      
      // Set the results
      setAnalysisResults(data);
      setProgressSteps(prev => [...prev, `✅ Test analysis complete! Processed ${data.summary?.totalQuestions || 0} questions`]);
      
      toast({
        title: "Test Analysis Complete",
        description: `Successfully analyzed HubSpot vs competitors`,
      });
      
    } catch (error: any) {
      const errorMsg = error?.message || 'Test analysis failed';
      setErrorMessage(errorMsg);
      setProgressSteps(prev => [...prev, `❌ Error: ${errorMsg}`]);
      
      toast({
        title: "Test Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setIsTestAnalysis(false);
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
        
        {/* Main Container Card - Similar to Dashboard's Bounce Rate */}
        <Card id="ai-share-of-voice" className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg lg:text-xl">AI Share of Voice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50/50 rounded-xl p-6">
              {/* Description */}
              <p className="text-slate-600 text-sm mb-6">
                This analysis reflects how OpenAI's ChatGPT responds to key industry questions. 
                It is not based on SEO rankings, ads, or social mentions.
              </p>

              {/* Pulse AI Analysis Section - Matching Dashboard's Pulse AI Insight styling */}
              <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-6">
                <div className="flex items-center mb-4">
                  <Sparkles className="h-5 w-5 text-primary mr-3" />
                  <h3 className="text-lg font-bold text-primary">Pulse AI Analysis</h3>
                </div>

                {/* Client/Website/Competitors Info Block */}
                <div className="text-sm text-slate-600 mb-6">
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
                
                {/* Two Buttons */}
                <div className="flex gap-4 mb-6">
                  <Button 
                    className="flex-1 h-10"
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
                  
                  <Button 
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={runTestAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Test Analysis
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Progress Steps - appear below buttons when running */}
                {isAnalyzing && progressSteps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">Analysis Progress:</h4>
                    {progressSteps.map((step, index) => {
                      const isExplicitlyCompleted = step.includes('✅');
                      const isFailed = step.includes('❌');
                      const isCurrentStep = index === progressSteps.length - 1 && !isExplicitlyCompleted && !isFailed;
                      const isImplicitlyCompleted = !isExplicitlyCompleted && !isFailed && !isCurrentStep;
                      
                      return (
                        <div key={index} className="flex items-center space-x-3 text-sm">
                          <div className="flex-shrink-0">
                            {(isExplicitlyCompleted || isImplicitlyCompleted) && (
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 text-xs font-bold">✓</span>
                              </div>
                            )}
                            {isFailed && (
                              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-red-600 text-xs font-bold">✕</span>
                              </div>
                            )}
                            {isCurrentStep && (
                              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                              </div>
                            )}
                          </div>
                          <span className={step.includes('❌') ? 'text-red-700' : 'text-slate-700'}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Error Message Display */}
                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {errorMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResults && (
          <>
            {/* Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Overall ChatGPT SoV</div>
                  <div className="text-2xl font-bold text-primary">
                    {analysisResults.metrics?.overallSoV?.[analysisResults.summary?.brand] || 0}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">Question Coverage</div>
                  <div className="text-2xl font-bold text-primary">
                    {analysisResults.metrics?.questionCoverage?.[analysisResults.summary?.brand] || 0}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="text-xs font-medium text-slate-600 mb-1">AI Visibility Leader</div>
                  <div className="text-lg font-bold text-slate-800 truncate">
                    {(() => {
                      const sov = analysisResults.metrics?.overallSoV || {};
                      const leader = Object.entries(sov).reduce((a, b) => 
                        (b[1] as number) > (a[1] as number) ? b : a, ['None', 0]);
                      return leader[0];
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
                </CardContent>
              </Card>
            </div>

            {/* Two Side-by-Side Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Performance by Buyer Journey Stage */}
              {analysisResults.questionResults && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Performance by Buyer Journey Stage</CardTitle>
                    <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
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
                        
                        return (
                          <div key={stage} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{stage}</span>
                                <button 
                                  onClick={() => setShowQuestionsDialog(true)}
                                  className="text-sm text-slate-500 hover:text-primary underline cursor-pointer"
                                >
                                  ({stageQuestions.length} questions)
                                </button>
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

              {/* AI Share of Voice by Competitor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Share of Voice by Competitor</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
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
                                style={{ width: `${String(percentage)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-800 w-16 text-right">
                              {String(percentage)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Questions Dialog */}
            {showQuestionsDialog && analysisResults.questionResults && (
              <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Research Questions by Stage</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    {['awareness', 'consideration', 'decision'].map(stage => {
                      const stageQuestions = analysisResults.questionResults.filter((q: any) => q.stage === stage);
                      
                      return (
                        <div key={stage}>
                          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                            <span className="capitalize">{stage} Stage</span>
                            <span className="text-slate-500">({stageQuestions.length} questions)</span>
                          </h3>
                          <div className="space-y-2">
                            {stageQuestions.map((q: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                                <p className="text-sm text-slate-700 mb-2">{q.question}</p>
                                <div className="text-xs text-slate-500">
                                  Share of Voice: {Object.entries(q.sov || {}).map(([brand, pct]) => 
                                    `${brand}: ${String(pct)}%`
                                  ).join(', ') || 'No mentions detected'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Strategic Insights */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  Strategic Insights & Recommendations
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">Data source: AI responses to generated questions</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const brandName = analysisResults.summary?.brand;
                    const questionResults = analysisResults.questionResults || [];
                    
                    // Define TypeScript interfaces
                    interface StageMetric {
                      brandSoV: number;
                      competitorAvg: number;
                      othersAvg: number;
                      questionCount: number;
                    }
                    
                    interface ArchetypeInsight {
                      title: string;
                      rationale: string;
                      action: string;
                      deliverables: string;
                      priority: number;
                      type: 'critical' | 'warning' | 'success' | 'opportunity' | 'info';
                    }
                    
                    // Calculate stage-specific metrics
                    const stages = ['awareness', 'consideration', 'decision'];
                    const stageMetrics: Record<string, StageMetric> = {};
                    
                    stages.forEach(stage => {
                      const stageQuestions = questionResults.filter((q: any) => q.stage === stage);
                      const brandSoV = stageQuestions.reduce((sum: number, q: any) => 
                        sum + (q.sov?.[brandName] || 0), 0) / (stageQuestions.length || 1);
                      
                      // Calculate competitor average (excluding "Others")
                      const allBrands = new Set<string>();
                      stageQuestions.forEach((q: any) => {
                        Object.keys(q.sov || {}).forEach(brand => {
                          if (brand !== 'Others') allBrands.add(brand);
                        });
                      });
                      
                      const competitorSoVs = Array.from(allBrands)
                        .filter(brand => brand !== brandName)
                        .map(brand => {
                          return stageQuestions.reduce((sum: number, q: any) => 
                            sum + (q.sov?.[brand] || 0), 0) / (stageQuestions.length || 1);
                        });
                      
                      const competitorAvg = competitorSoVs.length > 0 ? 
                        competitorSoVs.reduce((sum, val) => sum + val, 0) / competitorSoVs.length : 0;
                      
                      // Calculate "Others" percentage
                      const othersAvg = stageQuestions.reduce((sum: number, q: any) => 
                        sum + (q.sov?.['Others'] || 0), 0) / (stageQuestions.length || 1);
                      
                      stageMetrics[stage] = {
                        brandSoV: Math.round(brandSoV * 10) / 10,
                        competitorAvg: Math.round(competitorAvg * 10) / 10,
                        othersAvg: Math.round(othersAvg * 10) / 10,
                        questionCount: stageQuestions.length
                      };
                    });
                    
                    // Apply archetype logic with priority: largest gap, then Decision → Consideration → Awareness
                    const stageOrder = ['decision', 'consideration', 'awareness'];
                    const archetype_insights: ArchetypeInsight[] = [];
                    const addedInsights = new Set<string>(); // Track added insights to prevent duplicates
                    const addedArchetypes = new Set<string>(); // Track added archetype types to prevent repeats
                    
                    stageOrder.forEach(stage => {
                      const metrics = stageMetrics[stage];
                      if (!metrics || metrics.questionCount < 3) return; // Insufficient data
                      
                      const brandSoV = metrics.brandSoV;
                      const competitorAvg = metrics.competitorAvg;
                      const othersAvg = metrics.othersAvg;
                      const gap = competitorAvg - brandSoV;
                      
                      // Check for fragmentation first (takes priority)
                      const fragmentationKey = `fragmentation-${stage}`;
                      if (othersAvg >= Math.max(competitorAvg, 20) && !addedInsights.has(fragmentationKey) && !addedArchetypes.has('Control the Fragmented Space')) {
                        addedInsights.add(fragmentationKey);
                        addedInsights.add(`${stage}-archetype`); // Block other insights for this stage
                        addedArchetypes.add('Control the Fragmented Space');
                        archetype_insights.push({
                          title: "Control the Fragmented Space",
                          rationale: `"Others" at ${othersAvg}% in ${stage} stage indicates market fragmentation. Opportunity to consolidate authority.`,
                          action: "Publish authoritative, comprehensive category resources to consolidate scattered mentions.",
                          deliverables: "Authoritative content hubs; comparison matrices; backlink/analyst citation plan.",
                          priority: othersAvg,
                          type: 'opportunity'
                        });
                      } 
                      // Skip other archetypes if fragmentation already handled this stage
                      else if (!addedInsights.has(`${stage}-archetype`)) {
                        // Archetype matching with new 14-archetype system
                        if (brandSoV === 0) {
                          // Absent triggers
                          if (stage === 'awareness' && !addedArchetypes.has('Crack the Visibility Lists')) {
                            addedArchetypes.add('Crack the Visibility Lists');
                            archetype_insights.push({
                              title: "Crack the Visibility Lists",
                              rationale: `${brandName} absent in awareness stage (0% vs competitor avg ${competitorAvg}%). Missing from category discovery.`,
                              action: "Earn inclusion in category roundups/directories and publish cite-able explainers.",
                              deliverables: "Educational content hub; roundup/directories outreach plan; lightweight messaging alignment (not full brand refresh).",
                              priority: competitorAvg === 0 ? 100 : gap,
                              type: 'critical'
                            });
                          } else if (stage === 'consideration' && !addedArchetypes.has('Close the Shortlist Gap')) {
                            addedArchetypes.add('Close the Shortlist Gap');
                            archetype_insights.push({
                              title: "Close the Shortlist Gap",
                              rationale: `${brandName} absent in consideration stage (0% vs competitor avg ${competitorAvg}%). Missing from evaluation shortlists.`,
                              action: "Build comparison pages, evaluator checklists, \"why us\" proof.",
                              deliverables: "Structured comparison pages (with schema); evaluator checklist templates; targeted landing pages.",
                              priority: gap,
                              type: 'critical'
                            });
                          } else if (stage === 'decision' && !addedArchetypes.has('Strengthen Trust Signals')) {
                            addedArchetypes.add('Strengthen Trust Signals');
                            archetype_insights.push({
                              title: "Strengthen Trust Signals",
                              rationale: `${brandName} absent in decision stage (0% vs competitor avg ${competitorAvg}%). Trust/credibility barriers evident.`,
                              action: "Surface certifications, compliance, recognizable clients, SLAs, accessibility — plus reviews/analyst mentions.",
                              deliverables: "Trust-center content hub; accessibility audit; client logos/testimonials; third-party reviews integration.",
                              priority: gap,
                              type: 'critical'
                            });
                          }
                        } else if (brandSoV + 5 < competitorAvg) {
                          // Underperforming triggers
                          if (stage === 'awareness' && !addedArchetypes.has('Own the Category Narrative')) {
                            addedArchetypes.add('Own the Category Narrative');
                            archetype_insights.push({
                              title: "Own the Category Narrative",
                              rationale: `${brandName} underperforming in awareness (${brandSoV}% vs competitor avg ${competitorAvg}%). Lagging in thought leadership.`,
                              action: "Publish POV frameworks, definitions, and comparison primers AI can quote.",
                              deliverables: "POV content frameworks; category definition articles; campaign creative to distribute/seed.",
                              priority: gap,
                              type: 'warning'
                            });
                          } else if (stage === 'consideration' && !addedArchetypes.has('Differentiate with Signature Strengths')) {
                            addedArchetypes.add('Differentiate with Signature Strengths');
                            archetype_insights.push({
                              title: "Differentiate with Signature Strengths",
                              rationale: `${brandName} underperforming in consideration (${brandSoV}% vs competitor avg ${competitorAvg}%). Present but generic (no unique associations).`,
                              action: "Name/seed distinctive features, verticals, methods across site & content — and propagate through earned mentions.",
                              deliverables: "Positioning + product messaging; vertical/feature landing pages; earned media/PR amplification.",
                              priority: gap,
                              type: 'warning'
                            });
                          } else if (stage === 'decision' && !addedArchetypes.has('Prove Measurable Outcomes')) {
                            addedArchetypes.add('Prove Measurable Outcomes');
                            archetype_insights.push({
                              title: "Prove Measurable Outcomes",
                              rationale: `${brandName} underperforming in decision (${brandSoV}% vs competitor avg ${competitorAvg}%). ROI/impact evidence lacking.`,
                              action: "Quantified case studies; before/after KPIs; outcome dashboards.",
                              deliverables: "Case study templates with metrics; conversion & engagement analytics; outcome dashboards.",
                              priority: gap,
                              type: 'warning'
                            });
                          }
                        } else if (brandSoV >= competitorAvg - 5 && !addedArchetypes.has('Scale Market Momentum')) {
                          // Strong performance trigger
                          addedArchetypes.add('Scale Market Momentum');
                          const gapDescription = Math.abs(gap) <= 5 ? "near parity; efficient to amplify" : "strong position to amplify";
                          archetype_insights.push({
                            title: "Scale Market Momentum",
                            rationale: `${brandName} strong in ${stage} stage (${brandSoV}% vs competitor avg ${competitorAvg}%)—${gapDescription}.`,
                            action: "Amplify what's working across paid/earned/owned; expand into new formats.",
                            deliverables: "Paid search/social + programmatic plan; SEO retargeting program; campaign creative & motion assets.",
                            priority: -Math.abs(gap), // Negative for opportunities
                            type: 'success'
                          });
                        }

                        // Additional specialized archetypes for specific conditions
                        if (stage === 'awareness' && brandSoV > 0 && !addedArchetypes.has('Accelerate Buyer Education')) {
                          // When competitors dominate awareness explainers
                          const dominatedByCompetitorExplainers = competitorAvg > brandSoV + 10;
                          if (dominatedByCompetitorExplainers) {
                            addedArchetypes.add('Accelerate Buyer Education');
                            archetype_insights.push({
                              title: "Accelerate Buyer Education",
                              rationale: `Awareness queries dominated by competitor explainers (competitor avg ${competitorAvg}% vs ${brandName} ${brandSoV}%).`,
                              action: "Guides, glossaries, \"what is / how it works\" series; schema/IA to surface it.",
                              deliverables: "Content strategy & creation; UX/IA + schema markup; SEO strategy.",
                              priority: gap,
                              type: 'warning'
                            });
                          }
                        }

                        if (stage === 'consideration' && !addedArchetypes.has('Expand Vertical Proof')) {
                          // When competitors tied to verticals; brand is not
                          const verticalTiedCompetitors = competitorAvg > brandSoV + 8;
                          if (verticalTiedCompetitors && brandSoV > 0) {
                            addedArchetypes.add('Expand Vertical Proof');
                            archetype_insights.push({
                              title: "Expand Vertical Proof",
                              rationale: `Competitors tied to verticals while ${brandName} shows generic positioning (${brandSoV}% vs competitor avg ${competitorAvg}%).`,
                              action: "Publish tailored case studies, outcomes, logos per industry.",
                              deliverables: "Vertical case stories; modular web templates; outcome metrics embedded via analytics snippets.",
                              priority: gap,
                              type: 'warning'
                            });
                          }
                        }

                        if (stage === 'decision' && brandSoV > 0 && brandSoV + 5 < competitorAvg && !addedArchetypes.has('Improve Ease of Choice')) {
                          // When decision-stage queries show confusion
                          addedArchetypes.add('Improve Ease of Choice');
                          archetype_insights.push({
                            title: "Improve Ease of Choice",
                            rationale: `Decision-stage queries show confusion (${brandName} ${brandSoV}% vs competitor avg ${competitorAvg}%). Pricing, integrations, fit unclear.`,
                            action: "Clarify pricing/tiers, integration guides, evaluation tools.",
                            deliverables: "Pricing schema + comparators; integration documentation; interactive fit calculators/tools.",
                            priority: gap,
                            type: 'warning'
                          });
                        }
                        addedInsights.add(`${stage}-archetype`);
                      }
                      
                      // Fragmentation check moved above to take priority
                    });
                    
                    // Sort by priority: largest gaps first, then by stage importance (Decision → Consideration → Awareness)
                    const stageImportance = { 'decision': 3, 'consideration': 2, 'awareness': 1 };
                    const prioritizedInsights = archetype_insights
                      .sort((a, b) => {
                        // First by priority (gap size)
                        if (Math.abs(b.priority - a.priority) > 0.1) return b.priority - a.priority;
                        // Then by stage importance if priorities are similar
                        const aStage = a.title.toLowerCase().includes('decision') ? 'decision' : 
                                      a.title.toLowerCase().includes('consideration') ? 'consideration' : 'awareness';
                        const bStage = b.title.toLowerCase().includes('decision') ? 'decision' :
                                      b.title.toLowerCase().includes('consideration') ? 'consideration' : 'awareness';
                        return stageImportance[bStage] - stageImportance[aStage];
                      })
                      .slice(0, 5);
                    
                    // If no specific insights, add technical/enabler archetypes
                    if (prioritizedInsights.length === 0) {
                      const overallBrandSoV = analysisResults.metrics?.overallSoV?.[brandName] || 0;
                      
                      if (overallBrandSoV < 10) {
                        prioritizedInsights.push({
                          title: "Fix Technical Discoverability",
                          rationale: `${brandName} showing ${overallBrandSoV}% overall share of voice. Low awareness suggests technical issues.`,
                          action: "Improve crawlability, speed, metadata, structured content.",
                          deliverables: "Technical SEO audit + fixes; site speed/performance optimization; structured data activation.",
                          priority: 10 - overallBrandSoV,
                          type: 'info'
                        });
                      }
                    }
                    
                    return prioritizedInsights.map((insight, idx) => {
                      // Extract stage from title for tag display
                      const titleParts = insight.title.match(/^(.*?) \((.+?)\)$/);
                      const mainTitle = titleParts ? titleParts[1] : insight.title;
                      const stage = titleParts ? titleParts[2] : '';
                      
                      return (
                        <div key={idx} className={`p-4 rounded-lg ${
                          insight.type === 'critical' ? 'bg-red-100' :
                          insight.type === 'warning' ? 'bg-orange-100' : 
                          insight.type === 'success' ? 'bg-green-100' : 
                          'bg-orange-100'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="font-semibold text-sm text-black">
                              {mainTitle}
                            </div>
                            {stage && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-white text-slate-800 rounded-full border border-slate-200">
                                {stage}
                              </span>
                            )}
                          </div>
                          <div className="text-xs mb-2 text-black">
                            {insight.rationale}
                          </div>
                          <div className="text-xs mb-2 font-medium text-black">
                            Action: {insight.action}
                          </div>
                          <div className="text-xs text-black">
                            <strong>Deliverables:</strong> {insight.deliverables}
                          </div>
                        </div>
                      );
                    });
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
            
            {/* Rerun Analysis Buttons */}
            <div className="flex gap-4 mt-6">
              <Button 
                className="flex-1 h-10"
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
              
              <Button 
                variant="outline"
                className="flex-1 h-10"
                onClick={runTestAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Run Test Analysis
                  </>
                )}
              </Button>
            </div>
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