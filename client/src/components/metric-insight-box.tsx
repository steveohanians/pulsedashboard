import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AIInsights from "@/components/ai-insights";

interface MetricInsightBoxProps {
  metricName: string;
  clientId: string;
  timePeriod: string;
  metricData: any;
}

export default function MetricInsightBox({ metricName, clientId, timePeriod, metricData }: MetricInsightBoxProps) {
  const [insight, setInsight] = useState<any>(null);
  const queryClient = useQueryClient();

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/generate-metric-insight/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          metricName,
          timePeriod,
          metricData
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      // Set insight with typing effect enabled
      setInsight({ ...data.insight, isTyping: true });
      // Invalidate insights cache
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    },
    onError: (error) => {
      console.error('Failed to generate insight:', error);
    }
  });

  if (insight) {
    return (
      <AIInsights
        context={insight.contextText}
        insight={insight.insightText}
        recommendation={insight.recommendationText}
        isTyping={insight.isTyping}
      />
    );
  }

  return (
    <div className="relative p-4 sm:p-6 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-lg border border-primary/20 min-h-[140px] sm:min-h-[160px] overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-primary/20"></div>
        <div className="absolute bottom-6 left-6 w-12 h-12 rounded-full bg-primary/15"></div>
        <div className="absolute top-1/2 right-1/3 w-6 h-6 rounded-full bg-primary/10"></div>
      </div>
      
      <div className="relative text-center">
        <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto leading-relaxed">
          Get strategic competitive intelligence and actionable recommendations for <span className="font-medium text-primary">{metricName}</span>
        </p>
        <Button 
          onClick={() => generateInsightMutation.mutate()}
          disabled={generateInsightMutation.isPending}
          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/25 font-medium px-6 py-2.5"
          size="sm"
        >
          {generateInsightMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Insights...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate AI Insights
            </>
          )}
        </Button>
        
        {generateInsightMutation.isPending && (
          <p className="text-xs text-slate-500 mt-3 animate-pulse">
            Analyzing competitive data and market trends...
          </p>
        )}
      </div>
    </div>
  );
}