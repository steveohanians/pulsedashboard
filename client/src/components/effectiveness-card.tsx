import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Eye, Clock, TrendingUp, RotateCcw, Sparkles } from "lucide-react";
import { ButtonLoadingSpinner } from "@/components/loading";
import { useToast } from "@/hooks/use-toast";
import { useProgressiveToasts } from "@/hooks/useProgressiveToasts";
import { useEffectivenessData } from "@/hooks/useEffectivenessData";
import { useProgressStream } from "@/hooks/useProgressStream";
import { useEffectivenessActions } from "@/hooks/useEffectivenessActions";
import { cn } from "@/lib/utils";
import { EffectivenessErrorBoundary } from "./EffectivenessErrorBoundary";
import { getStatusMessaging, hasViewableResults, type EffectiveStatus } from "@/utils/status-utils";

// Lazy load non-critical components to optimize bundle size
const EvidenceDrawer = React.lazy(() => import("./evidence-drawer").then(module => ({ default: module.EvidenceDrawer })));
const EffectivenessRadarChart = React.lazy(() => import("./charts/effectiveness-radar-chart").then(module => ({ default: module.EffectivenessRadarChart })));
const EffectivenessAIInsights = React.lazy(() => import("./effectiveness-ai-insights").then(module => ({ default: module.EffectivenessAIInsights })));



interface EffectivenessCardProps {
  clientId: string;
  className?: string;
}

export function EffectivenessCard({ clientId, className }: EffectivenessCardProps) {
  const { toast } = useToast();
  const [showEvidence, setShowEvidence] = useState(false);

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
    "Packaging clear, do-this-next recommendations",
    "Also analyzing your competitors in parallel",
    "Building side-by-side comparisons for you",
    "Spotting what makes your site unique"
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

  // No manual cleanup needed - React Query handles polling lifecycle

  // Use SSE for real-time progress updates (only when analysis is running)
  const sseProgress = useProgressStream(clientId, {
    enabled: true, // Always try to connect, but only show progress when needed
    fallbackToPolling: true
  });

  // Use enhanced data layer hooks with new status system
  // First get the data without SSE optimization
  const { 
    data, 
    run, 
    client, 
    competitorData,
    effectiveStatus,
    isInProgress,
    isCompleted,
    isFailed,
    isPartial,
    hasData,
    progress,
    progressString,
    progressDetail,
    isLoading,
    isError,
    error,
    isRefetching
  } = useEffectivenessData(clientId, {
    // Disable polling when SSE is connected AND analysis is in progress
    sseConnected: sseProgress.isConnected && 
      sseProgress.progressData && 
      sseProgress.progressData.currentPhase !== 'completed'
  });
  

  // Get status messaging for UI display
  const statusMessage = getStatusMessaging(effectiveStatus);
  const showResults = hasViewableResults(effectiveStatus);

  // Use new simple actions hook
  const {
    startAnalysis,
    forceRestartAnalysis,
    refreshData,
    isStarting,
    startError
  } = useEffectivenessActions(clientId);

  // Manual polling removed - using React Query refetchInterval instead

  const handleRefresh = () => {
    startAnalysis();
  };

  // Memoize callback functions to prevent child re-renders
  const handleViewEvidence = React.useCallback(() => {
    setShowEvidence(true);
  }, []);

  const formatDate = React.useCallback((dateString: string | undefined) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, []);

  const getEffectivenessStatus = React.useCallback((score: number) => {
    if (score > 7.99) {
      return { text: "Very Effective", color: "text-green-600" };
    } else if (score > 3.99) {
      return { text: "Somewhat Effective", color: "text-orange-600" };
    } else {
      return { text: "Not Effective", color: "text-red-600" };
    }
  }, []);
  
  const canRefresh = !isInProgress && !isStarting;


  // Parse progress detail for enhanced display
  let progressState = null;
  if (progressDetail) {
    try {
      progressState = typeof progressDetail === 'string' 
        ? JSON.parse(progressDetail) 
        : progressDetail;
    } catch (e) {
      // Keep as string if parsing fails
      progressState = null;
    }
  }

  // Prefer SSE progress data when available and connected
  const progressPercentage = (sseProgress.isConnected && sseProgress.progressData) 
    ? sseProgress.progressData.overallPercent 
    : progress;
  
  const progressMessage = (sseProgress.isConnected && sseProgress.progressData) 
    ? sseProgress.progressData.message 
    : (progressString || 'Starting analysis...');

  // Use SSE progress state when available, fallback to parsed detail
  const currentProgressState = (sseProgress.isConnected && sseProgress.progressData) 
    ? sseProgress.progressData 
    : progressState;

  // Show time information if available
  const showTimeInfo = currentProgressState && currentProgressState.timeElapsed > 30000;

  // Progressive toast notifications for milestone completions
  useProgressiveToasts({
    status: run?.status,
    progress: progressMessage,
    overallScore: run?.overallScore,
    criterionScores: run?.criterionScores
  }, client?.name);

  return (
    <EffectivenessErrorBoundary clientName={client?.name}>
      <Card 
        className={cn("relative", className)}
        role="region"
        aria-label="Website Effectiveness Analysis"
        aria-describedby="effectiveness-description"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-lg lg:text-xl flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <span id="effectiveness-description">Website Effectiveness Engine™ Audit</span>
              {run && showResults && run.criterionScores && run.criterionScores.length > 0 && (
                <span 
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 w-fit"
                  data-testid="effectiveness-status-chip"
                  role="status"
                  aria-label={`Website effectiveness rating: ${getEffectivenessStatus(run.overallScore).text}`}
                >
                  <span aria-hidden="true">Your Website is</span>
                  <span className={`font-semibold ${getEffectivenessStatus(run.overallScore).color}`}>
                    {getEffectivenessStatus(run.overallScore).text}
                  </span>
                </span>
              )}
            </div>
            {run && showResults && run.criterionScores && run.criterionScores.length > 0 && (
              <span 
                className="text-xl sm:text-2xl lg:text-3xl font-light text-primary flex-shrink-0"
                role="status"
                aria-label={`Overall effectiveness score: ${run.overallScore} out of 10`}
              >
                {run.overallScore}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div 
              className="flex items-center justify-center py-8"
              role="status"
              aria-live="polite"
              aria-label="Loading effectiveness data"
            >
              <ButtonLoadingSpinner size="md" />
              <span className="sr-only">Loading website effectiveness analysis...</span>
            </div>
          )}

          {error && (
            <div 
              className="text-center py-8"
              role="alert"
              aria-live="assertive"
            >
              <div className="mb-3">
                <p className="text-muted-foreground text-sm">
                  {error.message?.includes('Access denied') ? 'Access denied' :
                   error.message?.includes('not found') ? 'Data not available' :
                   error.message?.includes('Server error') ? 'Server temporarily unavailable' :
                   error.message?.includes('VALIDATION_ERROR') ? 'Data validation failed - please retry' :
                   error.message?.includes('NETWORK_ERROR') ? 'Network connection issue - please check your connection' :
                   error.message?.includes('timeout') ? 'Request timed out - please try again' :
                   'Failed to load effectiveness data'}
                </p>
                {!error.message?.includes('Access denied') && (
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        window.location.reload();
                      }
                    }}
                    className="mt-3"
                    aria-describedby="refresh-page-description"
                    tabIndex={0}
                  >
                    Refresh Page
                  </Button>
                )}
                <span id="refresh-page-description" className="sr-only">
                  This will reload the entire page to resolve the error
                </span>
              </div>
            </div>
          )}

          {run && !run.criterionScores && (
            <div className="text-center py-8">
              <div className="mb-3">
                <p className="text-muted-foreground text-sm">
                  Effectiveness data appears incomplete. This may be due to a recent run or data processing issue.
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleRefresh} 
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && canRefresh) {
                      e.preventDefault();
                      handleRefresh();
                    }
                  }}
                  disabled={!canRefresh} 
                  className="mt-3"
                  aria-label="Refresh effectiveness data"
                  tabIndex={0}
                >
                  {isStarting ? (
                    <>
                      <ButtonLoadingSpinner size="sm" className="mr-2" />
                      Refreshing...
                    </>
                  ) : (
                    "Refresh Data"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Idle state - No analysis has been run yet */}
          {effectiveStatus === 'idle' && (
            <div className="text-center py-8">
              <div className="space-y-4">
                <div>
                  <p className="text-muted-foreground mb-2">{statusMessage.title}</p>
                  <p className="text-sm text-muted-foreground">{statusMessage.description}</p>
                </div>
                <Button 
                  onClick={handleRefresh} 
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && canRefresh) {
                      e.preventDefault();
                      handleRefresh();
                    }
                  }}
                  disabled={!canRefresh}
                  aria-label="Start website effectiveness analysis"
                  tabIndex={0}
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                >
                  {isStarting ? (
                    <>
                      <ButtonLoadingSpinner size="sm" className="mr-2" />
                      Scoring Website...
                    </>
                  ) : (
                    "Score Website"
                  )}
                </Button>
              </div>
            </div>
          )}

          {run && isInProgress && (
            <div 
              className="text-center py-8"
              role="status"
              aria-live="polite"
              aria-label="Effectiveness analysis in progress"
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <ButtonLoadingSpinner size="sm" />
                    <span 
                      className="text-muted-foreground font-medium"
                      id="progress-status"
                      role="status"
                    >
                      {progressMessage || 'Starting analysis...'}
                    </span>
                    {/* SSE Connection Indicator (subtle) */}
                    {sseProgress.isConnected && (
                      <span 
                        className="text-xs text-green-600 ml-2"
                        title={`Real-time updates active${isInProgress ? ' (polling disabled)' : ''}`}
                        aria-label="Real-time updates connected"
                      >
                        ●
                      </span>
                    )}
                  </div>
                  
                  {/* Progress bar with percentage */}
                  {progressPercentage > 0 && (
                    <div className="w-full max-w-md mx-auto">
                      <div 
                        className="bg-secondary rounded-full h-2 overflow-hidden"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(progressPercentage, 100)}
                        aria-labelledby="progress-status"
                        aria-describedby="progress-description"
                      >
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Time remaining info after 30 seconds */}
                  {showTimeInfo && currentProgressState.timeRemaining > 0 && (
                    <div 
                      className="text-xs text-muted-foreground"
                      role="status"
                      aria-live="polite"
                    >
                      {Math.ceil(currentProgressState.timeRemaining / 1000)} seconds remaining
                    </div>
                  )}
                </div>
                
                {/* Keep the rotating fun messages for engagement */}
                <p 
                  className="text-sm text-muted-foreground transition-opacity duration-500 ease-in-out"
                  style={{ opacity: messageOpacity }}
                >
                  {funMessages[currentMessageIndex]}
                </p>
              </div>
            </div>
          )}

          {/* New status-based UI - Partial Success */}
          {effectiveStatus === 'partial' && (
            <div className="text-center py-8">
              <div className="space-y-3">
                <p className="text-muted-foreground mb-2">{statusMessage.title}</p>
                <p className="text-xs text-muted-foreground">{statusMessage.description}</p>
              </div>
            </div>
          )}

          {/* New status-based UI - True Failure */}
          {effectiveStatus === 'failed' && (
            <div className="text-center py-8">
              <div className="space-y-3">
                <p className="text-muted-foreground mb-2">{statusMessage.title}</p>
                {progressMessage && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-red-600">{progressMessage}</p>
                  </div>
                )}
                <Button onClick={handleRefresh} disabled={!canRefresh}>
                  {isStarting ? (
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
            </div>
          )}

          {run && run.status === 'completed' && (!run.criterionScores || run.criterionScores.length === 0) && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Analysis completed but no scores available</p>
              <p className="text-sm text-amber-600 mb-4">There may have been an issue during scoring</p>
              <Button onClick={handleRefresh} disabled={!canRefresh}>
                {isStarting ? (
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

          {run && showResults && run.criterionScores && run.criterionScores.length > 0 && (
            <div className="space-y-4">
              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
                {/* AI Insights Card */}
                <Card className="h-full bg-slate-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gray-900" />
                      Pulse AI Insights for {client?.name || 'Unknown Client'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-full flex flex-col">
                    <React.Suspense fallback={
                      <div className="flex items-center justify-center h-32">
                        <ButtonLoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading insights...</span>
                      </div>
                    }>
                      <EffectivenessAIInsights
                        clientId={clientId}
                        runId={run.id}
                        clientName={client?.name || 'Unknown Client'}
                        overallScore={run.overallScore}
                        className="flex-1"
                        aiInsights={run.aiInsights}
                        insightsGeneratedAt={run.insightsGeneratedAt}
                      />
                    </React.Suspense>
                  </CardContent>
                </Card>

                {/* Criteria Radar Chart */}
                <Card className="h-full bg-slate-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Effectiveness Scores</CardTitle>
                  </CardHeader>
                  <CardContent className="h-full flex flex-col">
                    <React.Suspense fallback={
                      <div className="flex items-center justify-center h-32">
                        <ButtonLoadingSpinner size="sm" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading chart...</span>
                      </div>
                    }>
                      <EffectivenessRadarChart 
                        criterionScores={run.criterionScores}
                        competitorEffectivenessData={competitorData || []}
                        clientName={client?.name || 'Unknown Client'}
                        className="w-full"
                      />
                    </React.Suspense>
                  </CardContent>
                </Card>
              </div>

              {/* View Evidence Button */}
              <div className="pt-2 flex justify-center">
                <Button
                  onClick={handleViewEvidence}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleViewEvidence();
                    }
                  }}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white transition-all duration-200"
                  size="default"
                  aria-label="View detailed effectiveness analysis report"
                  tabIndex={0}
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
                    {isStarting ? (
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
      {run && showResults && run.criterionScores && run.criterionScores.length > 0 && (
        <React.Suspense fallback={null}>
          <EvidenceDrawer
            isOpen={showEvidence}
            onClose={() => setShowEvidence(false)}
            clientId={clientId}
            clientRun={run}
            competitorData={competitorData?.map(item => ({
              ...item,
              run: {
                ...item.run,
                createdAt: item.run?.createdAt || new Date().toISOString(),
                status: item.run?.status || 'completed' as const
              }
            })) || []}
          />
        </React.Suspense>
      )}
    </EffectivenessErrorBoundary>
  );
}