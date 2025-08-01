import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import AIInsights from "@/components/ai-insights";

// Persistent insights storage using localStorage with month-based expiration
const INSIGHTS_STORAGE_KEY = 'pulse_dashboard_insights';

interface StoredInsight {
  data: any;
  month: string; // Format: "2025-07"
  timestamp: number;
}

const insightsStorage = {
  getCurrentMonth: () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },
  
  getKey: (clientId: string, metricName: string) => `${clientId}-${metricName}`,
  
  save: (clientId: string, metricName: string, insight: any) => {
    try {
      const stored = localStorage.getItem(INSIGHTS_STORAGE_KEY);
      const allInsights = stored ? JSON.parse(stored) : {};
      const key = insightsStorage.getKey(clientId, metricName);
      
      allInsights[key] = {
        data: insight,
        month: insightsStorage.getCurrentMonth(),
        timestamp: Date.now()
      };
      
      localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(allInsights));
    } catch (error) {
      console.warn('Failed to save insight to localStorage:', error);
    }
  },
  
  load: (clientId: string, metricName: string) => {
    try {
      const stored = localStorage.getItem(INSIGHTS_STORAGE_KEY);
      if (!stored) return null;
      
      const allInsights = JSON.parse(stored);
      const key = insightsStorage.getKey(clientId, metricName);
      const insight = allInsights[key];
      
      if (!insight) return null;
      
      // Check if insight is from current month
      const currentMonth = insightsStorage.getCurrentMonth();
      if (insight.month !== currentMonth) {
        // Remove expired insight
        delete allInsights[key];
        localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(allInsights));
        return null;
      }
      
      return insight.data;
    } catch (error) {
      console.warn('Failed to load insight from localStorage:', error);
      return null;
    }
  },
  
  remove: (clientId: string, metricName: string) => {
    try {
      const stored = localStorage.getItem(INSIGHTS_STORAGE_KEY);
      if (!stored) return;
      
      const allInsights = JSON.parse(stored);
      const key = insightsStorage.getKey(clientId, metricName);
      delete allInsights[key];
      
      localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(allInsights));
    } catch (error) {
      console.warn('Failed to remove insight from localStorage:', error);
    }
  }
};

interface MetricInsightBoxProps {
  metricName: string;
  clientId: string;
  timePeriod: string;
  metricData: any;
  onStatusChange?: (status?: 'success' | 'needs_improvement' | 'warning') => void;
}

export default function MetricInsightBox({ metricName, clientId, timePeriod, metricData, onStatusChange }: MetricInsightBoxProps) {
  const [insight, setInsight] = useState<any>(null);
  const queryClient = useQueryClient();
  
  // Load insight from persistent storage on mount
  useEffect(() => {
    const storedInsight = insightsStorage.load(clientId, metricName);
    if (storedInsight) {
      // Disable typing effect for stored insights to prevent restart
      setInsight({ ...storedInsight, isTyping: false, isFromStorage: true });
      console.debug('✅ Status from storage:', storedInsight.status);
      onStatusChange?.(storedInsight.status);
    }
  }, [clientId, metricName, onStatusChange]);
  
  // Store insight in persistent storage when it changes (without typing state)
  useEffect(() => {
    if (insight && !insight.isFromStorage) {
      // Store without the typing state and storage flag to avoid restart issues
      const { isTyping, isFromStorage, ...insightToStore } = insight;
      insightsStorage.save(clientId, metricName, insightToStore);
    }
  }, [insight, clientId, metricName]);

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
      console.debug('🎭 Setting new insight with typing=true');
      setInsight({ ...data.insight, isTyping: true, isFromStorage: false });
      console.debug('✅ Status from API:', data.insight.status);
      onStatusChange?.(data.insight.status);
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
        status={insight.status}
        isTyping={insight.isTyping}
        onRegenerate={() => {
          // Clear current insight and storage to force fresh generation with typewriter effect
          setInsight(null);
          insightsStorage.remove(clientId, metricName);
          onStatusChange?.(undefined);
          // Small delay to ensure state is reset before generating new insight
          setTimeout(() => {
            generateInsightMutation.mutate();
          }, 100);
        }}
        onClear={() => {
          setInsight(null);
          insightsStorage.remove(clientId, metricName);
          onStatusChange?.(undefined);
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[140px] sm:min-h-[160px]">
      <div className="text-center">
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
              <Sparkles className="h-4 w-4 mr-2" />
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