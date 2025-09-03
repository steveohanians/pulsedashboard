import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Eye, Clock, TrendingUp, RotateCcw, Sparkles } from "lucide-react";
import { ButtonLoadingSpinner } from "@/components/loading";
import { useToast } from "@/hooks/use-toast";
import { useProgressiveToasts } from "@/hooks/useProgressiveToasts";
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
  status: 'pending' | 'initializing' | 'scraping' | 'analyzing' | 'tier1_analyzing' | 'tier1_complete' | 'tier2_analyzing' | 'tier2_complete' | 'tier3_analyzing' | 'completed' | 'failed' | 'generating_insights';
  progress?: string;
  progressDetail?: string | any;
  createdAt: string;
  criterionScores: CriterionScore[];
  screenshotUrl?: string;
  fullPageScreenshotUrl?: string;
  aiInsights?: any;
  insightsGeneratedAt?: string;
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
        clearTimeout(pollingInterval); // Changed to clearTimeout since we now use setTimeout
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
      const status = query.state.data?.run?.status;
      
      if (!status) return false;
      
      const inProgressStatuses = ['pending', 'initializing', 'scraping', 'analyzing', 'tier1_analyzing', 'tier1_complete', 'tier2_analyzing', 'tier2_complete', 'tier3_analyzing', 'generating_insights'];
      
      if (!inProgressStatuses.includes(status)) return false;
      
      // Faster polling during active analysis phases
      const activeAnalysisStatuses = ['scraping', 'analyzing', 'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing'];
      const isActivelyAnalyzing = activeAnalysisStatuses.includes(status);
      
      return isActivelyAnalyzing ? 1000 : 3000; // 1 second during analysis, 3 seconds during initialization/completion phases
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
      clearTimeout(pollingInterval); // Use clearTimeout since we now use setTimeout
    }
    
    const pollWithDynamicInterval = async () => {
      try {
        const response = await fetch(`/api/effectiveness/latest/${clientId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update query cache with new data
          queryClient.setQueryData(['effectiveness', clientId, 'v2'], data);
          
          // Stop polling if status is completed or failed
          const inProgressStatuses = ['pending', 'initializing', 'scraping', 'analyzing', 'tier1_analyzing', 'tier1_complete', 'tier2_analyzing', 'tier2_complete', 'tier3_analyzing', 'generating_insights'];
          
          if (data.run && !inProgressStatuses.includes(data.run.status)) {
            if (pollingInterval) {
              clearTimeout(pollingInterval); // Use clearTimeout since we now use setTimeout
              setPollingInterval(null);
            }
            return;
          }
          
          // Schedule next poll with dynamic interval based on current status
          const activeAnalysisStatuses = ['scraping', 'analyzing', 'tier1_analyzing', 'tier2_analyzing', 'tier3_analyzing'];
          const isActivelyAnalyzing = activeAnalysisStatuses.includes(data.run?.status);
          const nextInterval = isActivelyAnalyzing ? 1000 : 3000; // 1 second during analysis, 3 seconds otherwise
          
          const timeoutId = setTimeout(pollWithDynamicInterval, nextInterval);
          setPollingInterval(timeoutId);
        }
      } catch (error) {
        console.warn('Polling failed:', error);
        // Retry with longer interval on error
        const timeoutId = setTimeout(pollWithDynamicInterval, 5000);
        setPollingInterval(timeoutId);
      }
    };
    
    // Start polling immediately
    pollWithDynamicInterval();
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
  const isAnalyzing = run?.status ? ['pending', 'initializing', 'scraping', 'analyzing', 'tier1_analyzing', 'tier1_complete', 'tier2_analyzing', 'tier2_complete', 'tier3_analyzing', 'generating_insights'].includes(run.status) : false;
  const canRefresh = !isAnalyzing && !refreshMutation.isPending;

  // Parse progressDetail for enhanced progress display
  // First try to parse from embedded progress field (new format)
  const progressData = run?.progress ? 
    (typeof run.progress === 'string' && run.progress.startsWith('{') ? 
      (() => {
        try {
          return JSON.parse(run.progress);
        } catch {
          return { message: run.progress };
        }
      })() : 
      { message: run.progress }) : 
    null;

  // Fallback to old progressDetail field if available
  const fallbackProgressDetail = run?.progressDetail ? 
    (typeof run.progressDetail === 'string' ? 
      (() => {
        try {
          return JSON.parse(run.progressDetail);
        } catch {
          return null;
        }
      })() : 
      run.progressDetail) : null;

  // Use progressDetail from embedded format or fallback
  const progressDetail = progressData?.progressDetail || fallbackProgressDetail;
  const progressMessage = progressData?.message || run?.progress;

  // Progressive toast notifications for milestone completions
  useProgressiveToasts({
    status: run?.status,
    progress: progressMessage,
    overallScore: run?.overallScore,
    criterionScores: run?.criterionScores
  }, data?.client?.name);

  return (
    <>
      <Card className={cn("relative", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg lg:text-xl flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <span>Website Effectiveness Engine™ Audit</span>
              {run && run.status === 'completed' && run.criterionScores && run.criterionScores.length > 0 && (
                <span 
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 w-fit"
                  data-testid="effectiveness-status-chip"
                >
                  <span>Your Website is</span>
                  <span className={`font-semibold ${getEffectivenessStatus(run.overallScore).color}`}>
                    {getEffectivenessStatus(run.overallScore).text}
                  </span>
                </span>
              )}
            </div>
            {run && run.status === 'completed' && run.criterionScores && run.criterionScores.length > 0 && (
              <span className="text-xl sm:text-2xl lg:text-3xl font-light text-primary flex-shrink-0">
                {run.overallScore}
              </span>
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

          {data && !run && data.hasData === false && (
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
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <ButtonLoadingSpinner size="sm" />
                    <span className="text-muted-foreground font-medium">
                      {progressMessage || 'Processing...'}
                    </span>
                    {progressDetail?.progress && (
                      <span className="text-sm text-muted-foreground">
                        {progressDetail.progress}%
                      </span>
                    )}
                  </div>
                  
                  {progressDetail && (
                    <>
                      {/* Progress bar */}
                      <div className="w-full max-w-md mx-auto bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progressDetail.progress || 0}%` }}
                        />
                      </div>
                      
                      {/* Phase and current item */}
                      <div className="text-xs text-muted-foreground space-y-1">
                        {progressDetail.currentItem && (
                          <div>Currently: {progressDetail.currentItem}</div>
                        )}
                        {progressDetail.estimatedTimeRemaining && (
                          <div>
                            ~{Math.round(progressDetail.estimatedTimeRemaining / 1000)}s remaining
                          </div>
                        )}
                        {progressDetail.phase && (
                          <div>Phase: {progressDetail.phase.replace(/_/g, ' ')}</div>
                        )}
                      </div>
                      
                      {/* Completed items */}
                      {progressDetail.completedItems?.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          ✓ {progressDetail.completedItems.join(', ')}
                        </div>
                      )}
                      
                      {/* Tier progress details */}
                      {progressDetail.tierDetails && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Tier {progressDetail.tierDetails.tier} - {progressDetail.tierDetails.completedCriteria}/{progressDetail.tierDetails.totalCriteria} criteria</div>
                          {progressDetail.tierDetails.overallScore && (
                            <div>Current Score: {progressDetail.tierDetails.overallScore}/10</div>
                          )}
                        </div>
                      )}
                      
                      {/* Overall progress summary */}
                      {progressDetail.completedTiers && progressDetail.totalTiers && (
                        <div className="text-xs text-muted-foreground">
                          Completed Tiers: {progressDetail.completedTiers}/{progressDetail.totalTiers}
                          {progressDetail.overallScore && (
                            <span> • Score: {progressDetail.overallScore}/10</span>
                          )}
                        </div>
                      )}
                      
                      {/* Competitor progress */}
                      {progressDetail.currentCompetitor && progressDetail.totalCompetitors && (
                        <div className="text-xs text-muted-foreground">
                          Competitor {progressDetail.currentCompetitor}/{progressDetail.totalCompetitors}
                          {progressDetail.competitorName && (
                            <span>: {progressDetail.competitorName}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <p 
                  className="text-sm text-muted-foreground transition-opacity duration-500 ease-in-out"
                  style={{ opacity: isAnalyzing ? messageOpacity : 1 }}
                >
                  {isAnalyzing ? funMessages[currentMessageIndex] : progressMessage}
                </p>
              </div>
            </div>
          )}

          {run && run.status === 'failed' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Analysis failed</p>
              {progressMessage && (
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-red-600">{progressMessage}</p>
                  {progressDetail && (
                    <div className="text-xs text-muted-foreground">
                      {progressDetail.phase && (
                        <div>Failed during: {progressDetail.phase.replace(/_/g, ' ')}</div>
                      )}
                      {progressDetail.currentCompetitor && progressDetail.totalCompetitors && (
                        <div>
                          Progress: Competitor {progressDetail.currentCompetitor}/{progressDetail.totalCompetitors}
                          {progressDetail.competitorName && (
                            <span> ({progressDetail.competitorName})</span>
                          )}
                        </div>
                      )}
                      {progressDetail.error && (
                        <div className="text-red-500 mt-1">Error: {progressDetail.error}</div>
                      )}
                    </div>
                  )}
                </div>
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

          {run && run.status === 'completed' && (!run.criterionScores || run.criterionScores.length === 0) && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Analysis completed but no scores available</p>
              <p className="text-sm text-amber-600 mb-4">There may have been an issue during scoring</p>
              <Button onClick={handleRefresh} disabled={!canRefresh}>
                {refreshMutation.isPending ? (
                  <>
                    <ButtonLoadingSpinner size="sm" className="mr-2" />
                    Scoring Website...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Analysis
                  </>
                )}
              </Button>
            </div>
          )}

          {run && run.status === 'completed' && run.criterionScores && run.criterionScores.length > 0 && (
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
      {run && run.status === 'completed' && run.criterionScores && run.criterionScores.length > 0 && (
        <EvidenceDrawer
          isOpen={showEvidence}
          onClose={() => setShowEvidence(false)}
          clientId={clientId}
          clientRun={run}
          competitorData={data?.competitorEffectivenessData || []}
        />
      )}
    </>
  );
}