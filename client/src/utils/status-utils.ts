/**
 * Status Utilities for Effectiveness Analysis
 * 
 * Provides centralized logic for determining the effective status of analysis runs,
 * handling cases where backend status may be "failed" but client results exist.
 */

export type EffectiveStatus = 'completed' | 'partial' | 'failed' | 'running';

export interface EffectivenessRun {
  status: string;
  criterionScores?: Array<{ id: string; criterion: string; score: number }>;
  overallScore?: number;
}

// Backend status constants
const IN_PROGRESS_STATUSES = [
  'pending',
  'initializing',
  'scraping',
  'analyzing',
  'tier1_analyzing',
  'tier1_complete',
  'tier2_analyzing',
  'tier2_complete',
  'tier3_analyzing',
  'generating_insights'
] as const;

const COMPLETED_STATUSES = ['completed'] as const;
const FAILED_STATUSES = ['failed'] as const;

/**
 * Derives the effective status of an effectiveness analysis run
 * 
 * @param run - The effectiveness run data
 * @returns EffectiveStatus - The derived status for UI display
 * 
 * Logic:
 * - completed: Backend status is 'completed' 
 * - partial: Backend status is 'failed' but client results exist (competitor timeouts/failures)
 * - failed: Backend status is 'failed' and no client results exist (true failure)
 * - running: Any in-progress status
 */
export function deriveEffectiveStatus(run?: EffectivenessRun | null): EffectiveStatus {
  if (!run || !run.status) {
    return 'failed';
  }

  // Check if we have client results (criterion scores)
  const hasClientResults = run.criterionScores && run.criterionScores.length > 0;

  // Explicitly completed runs
  if (COMPLETED_STATUSES.includes(run.status as any)) {
    return 'completed';
  }

  // In-progress runs
  if (IN_PROGRESS_STATUSES.includes(run.status as any)) {
    return 'running';
  }

  // Failed runs - distinguish between partial success and true failure
  if (FAILED_STATUSES.includes(run.status as any)) {
    return hasClientResults ? 'partial' : 'failed';
  }

  // Unknown status - treat as failed
  return 'failed';
}

/**
 * Determines if polling should continue for the given effective status
 * 
 * @param effectiveStatus - The derived effective status
 * @returns boolean - Whether to continue polling
 */
export function shouldContinuePolling(effectiveStatus: EffectiveStatus): boolean {
  switch (effectiveStatus) {
    case 'completed':
    case 'partial':
      return false; // Stop polling - we have final results
    case 'running':
    case 'failed':
      return true; // Keep polling - might recover or complete
    default:
      return false;
  }
}

/**
 * Gets user-friendly status messaging for the UI
 * 
 * @param effectiveStatus - The derived effective status
 * @returns Object with title and description for UI display
 */
export function getStatusMessaging(effectiveStatus: EffectiveStatus) {
  switch (effectiveStatus) {
    case 'completed':
      return {
        title: 'Analysis Complete',
        description: 'Your website effectiveness analysis is ready',
        variant: 'success' as const
      };
    case 'partial':
      return {
        title: 'Analysis Completed with Some Limitations',
        description: 'Your website analysis completed successfully. Some competitor data may be unavailable due to network issues.',
        variant: 'warning' as const
      };
    case 'failed':
      return {
        title: 'Analysis Failed',
        description: 'The analysis could not be completed. Please try again.',
        variant: 'error' as const
      };
    case 'running':
      return {
        title: 'Analysis in Progress',
        description: 'Analyzing your website effectiveness...',
        variant: 'info' as const
      };
    default:
      return {
        title: 'Unknown Status',
        description: 'Please refresh the page',
        variant: 'error' as const
      };
  }
}

/**
 * Type guard to check if status indicates results are available
 * 
 * @param effectiveStatus - The derived effective status
 * @returns boolean - Whether results can be displayed
 */
export function hasViewableResults(effectiveStatus: EffectiveStatus): boolean {
  return effectiveStatus === 'completed' || effectiveStatus === 'partial';
}