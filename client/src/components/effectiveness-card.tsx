import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Eye, Clock, TrendingUp, RotateCcw, Sparkles } from "lucide-react";
import { ButtonLoadingSpinner } from "@/components/loading";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./evidence-drawer";
import { EffectivenessRadarChart } from "./charts/effectiveness-radar-chart";
import { EffectivenessAIInsights } from "./effectiveness-ai-insights";

interface CriterionScore {
  id: string;
  criterion: string;
  score: number;
  evidence: {
    description: string;
    details: Record<string, any>;
    reasoning: string;
  };
  passes: {
    passed: string[];
    failed: string[];
  };
}

interface EffectivenessRun {
  id: string;
  overallScore: number;
  status: 'pending' | 'initializing' | 'scraping' | 'analyzing' | 'completed' | 'failed';
  progress?: string;
  createdAt: string;
  criterionScores: CriterionScore[];
}

interface EffectivenessData {
  client: {
    id: string;
    name: string;
    websiteUrl: string;
  };
  run: EffectivenessRun | null;
  competitorEffectivenessData?: {
    competitor: {
      id: string;
      domain: string;
      label: string;
    };
    run: {
      overallScore: number;
      criterionScores: CriterionScore[];
    };
  }[];
  hasData: boolean;
}

interface EffectivenessCardProps {
  clientId: string;
  className?: string;
}

export function EffectivenessCard({ clientId, className }: EffectivenessCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEvidence, setShowEvidence] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fun rotating messages for analysis progress
  const funMessages = [
    "Exploring your site like a friendly sleuth",
    "Scanning pixels and copy for clues",
    "Reading between the lines and <div>s",
    "Peeking under the hood—gently",
    "Snapping pixel-perfect screenshots",
    "Framing each page like a pro photo shoot",
    "Training our model on your brand signals",
    "Running 127 effectiveness checks (for real)",
    "Scoring for 8 effectiveness criteria signals",
    "Predicting how first-time visitors will feel",
    "Asking the big one: does this drive action?",
    "Packaging clear, do-this-next recommendations"
  ];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [messageOpacity, setMessageOpacity] = useState(1);

  // Rotate through fun messages every 4 seconds with fade effect
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setMessageOpacity(0);
      
      // After fade out completes, change message and fade in
      setTimeout(() => {
        setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % funMessages.length);
        setMessageOpacity(1);
      }, 250); // Half of the transition duration
    }, 4000);

    return () => clearInterval(interval);
  }, [funMessages.length]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Fetch effectiveness data
  const { data, isLoading, error } = useQuery<EffectivenessData>({
    queryKey: ['effectiveness', clientId, 'v2'], // Add version to bust cache
    queryFn: async () => {
      const response = await fetch(`/api/effectiveness/latest/${clientId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        if (response.status === 403) {
          throw new Error('Access denied');
        } else if (response.status === 404) {
          throw new Error('Client not found');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again later');
        } else {
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
      }
      
      return response.json();
    },
    refetchInterval: (query) => {
      // Refetch every 5 seconds if status is in progress (pending, initializing, scraping, analyzing)
      const status = query.state.data?.run?.status;
      return status && ['pending', 'initializing', 'scraping', 'analyzing', 'generating_insights'].includes(status) ? 5000 : false;
    },
    placeholderData: (previousData) => previousData, // Keep showing previous data while loading
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx) except for brief network issues
      if (error?.message?.includes('Access denied') || error?.message?.includes('not found')) {
        return false;
      }
      // Retry server errors up to 3 times with exponential backoff
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000,
    enabled: !!clientId
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/effectiveness/refresh/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }));
        
        if (response.status === 429) {
          // Cooldown active
          const hours = errorData.remainingHours || 'several';
          throw new Error(`Please wait ${hours} hours before requesting another analysis`);
        } else if (response.status === 403) {
          throw new Error('Access denied');
        } else if (response.status === 404) {
          throw new Error('Website not found');
        } else if (response.status >= 500) {
          throw new Error('Server error - please try again later');
        } else {
          throw new Error(errorData.message || 'Failed to start analysis');
        }
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scoring Started",
        description: "Website effectiveness scoring has been initiated. Results will appear shortly.",
        duration: 5000
      });
      
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['effectiveness', clientId, 'v2'] });
    },
    onError: (error: Error) => {
      let title = "Scoring Failed";
      let description = error.message;
      
      // Special handling for cooldown errors
      if (error.message.includes('wait') && error.message.includes('hours')) {
        title = "Too Soon to Re-analyze";
        description = error.message;
      }
      
      toast({
        title,
        description,
        variant: "destructive",
        duration: 8000
      });
    }
  });

  const startPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/effectiveness/latest/${clientId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update query cache with new data
          queryClient.setQueryData(['effectiveness', clientId, 'v2'], data);
          
          // Stop polling if status is completed or failed
          if (data.run && !['pending', 'initializing', 'scraping', 'analyzing', 'generating_insights'].includes(data.run.status)) {
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      } catch (error) {
        console.warn('Polling failed:', error);
      }
    }, 3000); // Poll every 3 seconds
    
    setPollingInterval(interval);
  };

  const handleRefresh = () => {
    refreshMutation.mutate();
    // Start polling after triggering refresh
    startPolling();
  };

  const handleViewEvidence = () => {
    setShowEvidence(true);
  };

  // Get criterion color based on score
  const getCriterionColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  // Format date for display - matches AI insights timestamp format
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get effectiveness status based on score
  const getEffectivenessStatus = (score: number) => {
    if (score > 7.99) {
      return { text: "Very Effective", color: "text-green-600" };
    } else if (score > 3.99) {
      return { text: "Somewhat Effective", color: "text-orange-600" };
    } else {
      return { text: "Not Effective", color: "text-red-600" };
    }
  };

  const run = data?.run;
  const isAnalyzing = run?.status ? ['pending', 'initializing', 'scraping', 'analyzing', 'generating_insights'].includes(run.status) : false;
  const canRefresh = !isAnalyzing && !refreshMutation.isPending;

  return (
    <>
      <Card className={cn("relative", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg lg:text-xl">
            Website Effectiveness Engine™ Audit
            {run && run.status === 'completed' && (
              <div className="flex flex-col gap-2 mt-2">
                <span 
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 w-fit"
                  data-testid="effectiveness-status-chip"
                >
                  <span>Your Website is</span>
                  <span className={`font-semibold ${getEffectivenessStatus(run.overallScore).color}`}>
                    {getEffectivenessStatus(run.overallScore).text}
                  </span>
                </span>
                <div className="text-xl sm:text-2xl lg:text-3xl font-light text-primary">
                  {run.overallScore}
                </div>
              </div>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <ButtonLoadingSpinner size="md" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="mb-3">
                <p className="text-muted-foreground text-sm">
                  {error.message?.includes('Access denied') ? 'Access denied' :
                   error.message?.includes('not found') ? 'Data not available' :
                   error.message?.includes('Server error') ? 'Server temporarily unavailable' :
                   'Failed to load effectiveness data'}
                </p>
                {!error.message?.includes('Access denied') && (
                  <Button variant="outline" onClick={() => window.location.reload()} className="mt-3">
                    Refresh Page
                  </Button>
                )}
              </div>
            </div>
          )}

          {data && !run && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No effectiveness data available
              </p>
              <Button onClick={handleRefresh} disabled={!canRefresh}>
                {refreshMutation.isPending ? (
                  <>
                    <ButtonLoadingSpinner size="sm" className="mr-2" />
                    Scoring Website...
                  </>
                ) : (
                  "Score Website"
                )}
              </Button>
            </div>
          )}

          {run && isAnalyzing && (
            <div className="text-center py-8">
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium flex items-center justify-center gap-2">
                  <ButtonLoadingSpinner size="sm" />
                  {run.status === 'initializing' && 'Preparing analysis...'}
                  {run.status === 'scraping' && 'Analyzing website effectiveness...'}
                  {run.status === 'analyzing' && 'Scoring criteria...'}
                  {run.status === 'pending' && 'Starting analysis...'}
                  {run.status === 'generating_insights' && 'Generating AI insights...'}
                </p>
                <p 
                  className="text-sm text-muted-foreground transition-opacity duration-500 ease-in-out"
                  style={{ opacity: isAnalyzing ? messageOpacity : 1 }}
                >
                  {isAnalyzing ? funMessages[currentMessageIndex] : run.progress}
                </p>
              </div>
            </div>
          )}

          {run && run.status === 'failed' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Analysis failed</p>
              {run.progress && (
                <p className="text-sm text-red-600 mb-4">{run.progress}</p>
              )}
              <Button onClick={handleRefresh} disabled={!canRefresh}>
                {refreshMutation.isPending ? (
                  <>
                    <ButtonLoadingSpinner size="sm" className="mr-2" />
                    Scoring Website...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </>
                )}
              </Button>
            </div>
          )}

          {run && run.status === 'completed' && (
            <div className="space-y-4">
              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
                {/* AI Insights Card */}
                <Card className="h-full bg-slate-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gray-900" />
                      Pulse AI Insights for {data.client.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-full flex flex-col">
                    <EffectivenessAIInsights
                      clientId={clientId}
                      runId={run.id}
                      clientName={data.client.name}
                      overallScore={run.overallScore}
                      className="flex-1"
                      aiInsights={run.aiInsights}
                      insightsGeneratedAt={run.insightsGeneratedAt}
                    />
                  </CardContent>
                </Card>

                {/* Criteria Radar Chart */}
                <Card className="h-full bg-slate-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Effectiveness Scores</CardTitle>
                  </CardHeader>
                  <CardContent className="h-full flex flex-col">
                    <EffectivenessRadarChart 
                      criterionScores={run.criterionScores}
                      competitorEffectivenessData={data.competitorEffectivenessData || []}
                      clientName={data.client.name}
                      className="w-full"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* View Evidence Button */}
              <div className="pt-2 flex justify-center">
                <Button
                  onClick={handleViewEvidence}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white transition-all duration-200"
                  size="default"
                >
                  View Detailed Report
                </Button>
              </div>

              {/* Date and Refresh Section */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-slate-400">{formatDate(run.createdAt)}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={!canRefresh}
                    className="text-slate-500 hover:text-slate-700 h-7 px-2"
                  >
                    {refreshMutation.isPending ? (
                      <ButtonLoadingSpinner size="sm" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Drawer */}
      {run && run.status === 'completed' && (
        <EvidenceDrawer
          isOpen={showEvidence}
          onClose={() => setShowEvidence(false)}
          clientId={clientId}
          runId={run.id}
          effectivenessData={{
            overallScore: run.overallScore,
            criterionScores: run.criterionScores,
            createdAt: run.createdAt
          }}
        />
      )}
    </>
  );
}