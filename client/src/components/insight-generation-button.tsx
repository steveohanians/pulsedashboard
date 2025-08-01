import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface InsightGenerationButtonProps {
  clientId: string;
  period?: string;
  onInsightsGenerated?: () => void;
}

export default function InsightGenerationButton({ 
  clientId, 
  period, 
  onInsightsGenerated 
}: InsightGenerationButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const queryParams = period ? `?period=${period}` : '';
      const response = await fetch(`/api/generate-comprehensive-insights/${clientId}${queryParams}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to generate insights');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI Insights Generated Successfully",
        description: `Generated insights for ${data.context.metricsAnalyzed} metrics with ${data.context.competitorsTracked} competitors tracked.`,
      });
      
      // Invalidate relevant queries to refresh the dashboard
      queryClient.invalidateQueries({ 
        queryKey: ['/api/insights', clientId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/dashboard', clientId] 
      });
      
      onInsightsGenerated?.();
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Generate Insights",
        description: error.message || "Unable to generate AI insights at this time. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
      <Button
        onClick={() => generateInsightsMutation.mutate()}
        disabled={isGenerating}
        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg hover:shadow-xl transition-all duration-200 relative overflow-hidden group"
        size="default"
      >
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
          )}
          {isGenerating ? "Generating AI Insights..." : "Generate AI Insights"}
        </div>
        
        {/* Animated background effect when generating */}
        {isGenerating && (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-pulse" />
        )}
      </Button>
      
      {/* Information about the process */}
      <div className="text-xs text-slate-600 max-w-sm">
        <div className="flex items-center gap-1 mb-1">
          <TrendingUp className="h-3 w-3" />
          <span className="font-medium">AI-Powered Analysis</span>
        </div>
        <p className="leading-relaxed">
          Analyzes last month's performance vs. competitors, industry benchmarks, and Clear Digital portfolio to generate strategic insights and recommendations.
        </p>
        {isGenerating && (
          <div className="mt-2 text-primary font-medium">
            ⏱️ This may take 30-60 seconds to complete
          </div>
        )}
      </div>
    </div>
  );
}