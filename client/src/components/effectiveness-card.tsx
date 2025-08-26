import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Eye, Clock, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EvidenceDrawer } from "./evidence-drawer";

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
  status: 'pending' | 'completed' | 'failed';
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

  // Fetch effectiveness data
  const { data, isLoading, error } = useQuery<EffectivenessData>({
    queryKey: ['effectiveness', clientId],
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
    refetchInterval: (queryData) => {
      // Refetch every 10 seconds if status is pending
      return queryData?.run?.status === 'pending' ? 10000 : false;
    },
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
      queryClient.invalidateQueries({ queryKey: ['effectiveness', clientId] });
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

  const handleRefresh = () => {
    refreshMutation.mutate();
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

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const run = data?.run;
  const canRefresh = run?.status !== 'pending' && !refreshMutation.isPending;

  return (
    <>
      <Card className={cn("relative", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg lg:text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Website Effectiveness
              {run && run.status === 'completed' && (
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="text-2xl lg:text-3xl font-light px-3 py-1">
                    {run.overallScore}/10
                  </Badge>
                </div>
              )}
            </CardTitle>
          </div>
          
          {run && run.status === 'completed' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Scored {formatDate(run.createdAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={!canRefresh}
                className="ml-auto h-8 px-2"
              >
                <RefreshCw className={cn(
                  "h-4 w-4", 
                  refreshMutation.isPending && "animate-spin"
                )} />
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
                <TrendingUp className="h-4 w-4 mr-2" />
                Score Website
              </Button>
            </div>
          )}

          {run && run.status === 'pending' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Analyzing website effectiveness...</p>
            </div>
          )}

          {run && run.status === 'failed' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Scoring failed</p>
              <Button onClick={handleRefresh} disabled={!canRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {run && run.status === 'completed' && (
            <div className="space-y-4">
              {/* Criterion Chips */}
              <div className="flex flex-wrap gap-2">
                {run.criterionScores.map((score) => (
                  <Badge
                    key={score.criterion}
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-sm font-medium border",
                      getCriterionColor(score.score)
                    )}
                  >
                    {score.criterion}: {score.score}
                  </Badge>
                ))}
              </div>

              {/* View Evidence Button */}
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={handleViewEvidence}
                  className="w-full"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Detailed Evidence
                </Button>
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