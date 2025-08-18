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
  const [progressSteps, setProgressSteps] = useState<{
    step: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    message?: string;
  }[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [showRawData, setShowRawData] = useState(false);
  
  // Get client and competitors from existing dashboard data
  const { client, competitors } = useDashboardData({
    clientId: user?.clientId || '',
    timePeriod: 'Last Month',
    businessSize: 'All',
    industryVertical: 'All'
  });

  // Initialize progress steps
  const initializeProgress = () => {
    const steps = [
      { step: 'Initializing analysis...', status: 'pending' as const },
      { step: 'Generating research questions...', status: 'pending' as const },
      { step: 'Analyzing brand mentions...', status: 'pending' as const },
      { step: 'Processing competitor data...', status: 'pending' as const },
      { step: 'Calculating Share of Voice...', status: 'pending' as const },
      { step: 'Generating insights...', status: 'pending' as const }
    ];
    setProgressSteps(steps);
    setCurrentStep(-1);
  };

  const updateProgress = (stepIndex: number, status: 'running' | 'completed' | 'error', message?: string) => {
    setCurrentStep(stepIndex);
    setProgressSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status, message } : step
    ));
  };

  // Function to run SoV analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResults(null);
    initializeProgress();
    
    try {
      // Step 1: Initialize
      updateProgress(0, 'running');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause to show step
      
      // Fix URL formatting - ensure they're proper URLs
      const formatUrl = (url: string) => {
        if (!url) return 'https://unknown.com';
        // Remove any protocol if exists
        let cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
        // Add https:// to make it a valid URL
        return `https://${cleanUrl}`;
      };

      // Fix competitor names and URLs  
      const formattedCompetitors = competitors.map((c: any) => {
        const cleanDomain = c.domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        return {
          name: c.label || cleanDomain.split('.')[0], // Use stored label (competitor name) from database
          url: formatUrl(c.domain)
        };
      });

      const payload = {
        brand: {
          name: client?.name || 'Unknown',
          url: formatUrl(client?.websiteUrl || 'unknown.com')
        },
        competitors: formattedCompetitors,
        vertical: client?.industryVertical || 'General'
      };

      updateProgress(0, 'completed');
      updateProgress(1, 'running');

      const response = await fetch('/api/sov/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(600000) // 10 minute timeout
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      // Simulate progress updates during the long analysis
      const progressInterval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev < 4) {
            const nextStep = prev + 1;
            updateProgress(nextStep, 'running');
            if (nextStep > 1) {
              // Complete previous step
              updateProgress(nextStep - 1, 'completed');
            }
            return nextStep;
          }
          return prev;
        });
      }, 30000); // Update every 30 seconds

      const rawText = await response.text();
      const data = JSON.parse(rawText);
      clearInterval(progressInterval);
      
      // Mark all steps as completed
      for (let i = 1; i < 6; i++) {
        updateProgress(i, 'completed');
      }
      
      setAnalysisResults(data);
      
      if (data.success !== false) {
        toast({
          title: "Analysis Complete",
          description: "Share of Voice analysis has been completed.",
        });
      } else {
        toast({
          title: "Analysis Error",
          description: data.error || "Analysis completed with errors.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      // Mark current step as error
      if (currentStep >= 0) {
        updateProgress(currentStep, 'error', error instanceof Error ? error.message : 'Unknown error');
      }
      
      let errorMessage = "Could not complete the analysis. Please try again.";
      if (error.name === 'TimeoutError') {
        errorMessage = "Analysis is taking longer than expected. This is normal for comprehensive brand analysis. Please try again or check back later.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Analysis Failed",
        description: errorMessage,
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
              
              {/* Progress Steps */}
              {isAnalyzing && progressSteps.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-slate-700">Analysis Progress:</h4>
                  {progressSteps.map((step, index) => (
                    <div key={index} className="flex items-center space-x-3 text-sm">
                      <div className="flex-shrink-0">
                        {step.status === 'completed' && (
                          <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                            <span className="text-green-600 text-xs font-bold">✓</span>
                          </div>
                        )}
                        {step.status === 'running' && (
                          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                          </div>
                        )}
                        {step.status === 'error' && (
                          <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 text-xs font-bold">✕</span>
                          </div>
                        )}
                        {step.status === 'pending' && (
                          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center">
                            <span className="text-slate-400 text-xs">○</span>
                          </div>
                        )}
                      </div>
                      <span className={`${
                        step.status === 'completed' ? 'text-green-700' : 
                        step.status === 'running' ? 'text-blue-700' : 
                        step.status === 'error' ? 'text-red-700' : 
                        'text-slate-500'
                      }`}>
                        {step.step}
                      </span>
                      {step.message && (
                        <span className="text-xs text-slate-500">- {step.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Share of Voice Results
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  {showRawData ? 'Hide' : 'Show'} Raw Data
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Summary */}
                {analysisResults.summary && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-800">Executive Summary</h3>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-slate-700 leading-relaxed">{analysisResults.summary}</p>
                    </div>
                  </div>
                )}

                {/* Share of Voice Metrics */}
                {analysisResults.metrics && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-800">Share of Voice Breakdown</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(analysisResults.metrics).map(([brand, percentage]) => (
                        <div key={brand} className="bg-slate-50 p-3 rounded-lg">
                          <div className="font-medium text-slate-800">{brand}</div>
                          <div className="text-2xl font-bold text-primary">{percentage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overall Share of Voice */}
                {analysisResults.overallSoV && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-800">Overall Market Position</h3>
                    <div className="bg-green-50 p-4 rounded-lg">
                      {Object.entries(analysisResults.overallSoV).map(([brand, data]: [string, any]) => (
                        <div key={brand} className="mb-2">
                          <span className="font-medium">{brand}:</span>
                          <span className="ml-2 text-lg font-bold text-green-700">{data.percentage}%</span>
                          <span className="ml-2 text-sm text-slate-600">({data.mentions} mentions)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Results Summary */}
                {analysisResults.questionResults && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-800">Research Coverage</h3>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-slate-700">
                        Analyzed <strong>{analysisResults.questionResults.length} research questions</strong> across multiple AI platforms to gather comprehensive brand intelligence.
                      </p>
                    </div>
                  </div>
                )}

                {/* Raw Data (Collapsible) */}
                {showRawData && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-slate-800">Raw Analysis Data</h3>
                    <div className="bg-slate-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap">
                        {JSON.stringify(analysisResults, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
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