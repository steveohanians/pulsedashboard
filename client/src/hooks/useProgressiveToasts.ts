/**
 * Hook for progressive effectiveness scoring toast notifications
 * Shows milestone notifications as scoring tiers complete
 */

import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';

interface ProgressiveToastsConfig {
  status?: string;
  progress?: string;
  overallScore?: number;
  criterionScores?: Array<{criterion: string; score: number}>;
}

export function useProgressiveToasts(data: ProgressiveToastsConfig, clientName?: string) {
  const { toast } = useToast();
  const lastStatusRef = useRef<string>('');
  const notifiedStatusesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!data.status || data.status === lastStatusRef.current) {
      return;
    }

    const previousStatus = lastStatusRef.current;
    lastStatusRef.current = data.status;

    // Only show notifications for forward progress (not when refreshing/reloading)
    if (notifiedStatusesRef.current.has(data.status)) {
      return;
    }

    // Progressive milestone notifications
    switch (data.status) {
      case 'tier1_complete':
        notifiedStatusesRef.current.add(data.status);
        toast({
          title: "Quick Analysis Complete! 📊",
          description: `Initial results ready${data.overallScore ? ` - Score: ${data.overallScore}/10` : ''}. Enhanced analysis continuing...`,
          duration: 4000
        });
        break;

      case 'tier2_complete':
        notifiedStatusesRef.current.add(data.status);
        toast({
          title: "Enhanced Analysis Complete! 🤖", 
          description: `AI analysis finished${data.overallScore ? ` - Score: ${data.overallScore}/10` : ''}. Performance analysis in progress...`,
          duration: 4000
        });
        break;

      case 'completed':
        notifiedStatusesRef.current.add(data.status);
        const criteriaCount = data.criterionScores?.length || 8;
        toast({
          title: "Full Analysis Complete! ✨",
          description: `All ${criteriaCount} criteria analyzed${data.overallScore ? ` - Final Score: ${data.overallScore}/10` : ''}`,
          duration: 5000
        });
        break;

      case 'failed':
        // Don't track failed status to allow retry notifications
        toast({
          title: "Analysis Failed",
          description: "Sorry, we encountered an issue analyzing your website. Please try again.",
          variant: "destructive",
          duration: 6000
        });
        break;

      default:
        // No toast for other statuses
        break;
    }
  }, [data.status, data.overallScore, data.criterionScores, toast]);

  // Reset notifications when starting fresh analysis
  useEffect(() => {
    if (data.status === 'pending' || data.status === 'initializing') {
      notifiedStatusesRef.current.clear();
    }
  }, [data.status]);

  return null; // This hook only handles side effects
}