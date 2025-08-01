import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2 } from "lucide-react";
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
      const response = await apiRequest(`/api/generate-metric-insight/${clientId}`, {
        method: 'POST',
        body: JSON.stringify({
          metricName,
          timePeriod,
          metricData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response;
    },
    onSuccess: (data) => {
      setInsight(data.insight);
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
      />
    );
  }

  return (
    <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 min-h-[120px] sm:min-h-[140px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm text-slate-600 mb-4 max-w-xs">
          Generate AI-powered insights for {metricName}
        </p>
        <Button 
          onClick={() => generateInsightMutation.mutate()}
          disabled={generateInsightMutation.isPending}
          className="bg-primary hover:bg-primary/90 text-white"
          size="sm"
        >
          {generateInsightMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightbulb className="h-4 w-4 mr-2" />
              Generate Insights
            </>
          )}
        </Button>
      </div>
    </div>
  );
}