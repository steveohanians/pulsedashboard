/**
 * Simple Effectiveness Evidence Hook
 * 
 * Uses embedded evidence data from the main effectiveness response.
 * No separate API calls needed - evidence is already included in criterion scores.
 */

// Evidence is embedded in the main effectiveness data, so this hook just
// processes that data for the evidence drawer

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

interface UseEffectivenessEvidenceOptions {
  /** Enable processing */
  enabled?: boolean;
}

export function useEffectivenessEvidence(
  criterionScores: CriterionScore[] | null = null,
  selectedCriterion?: string,
  options: UseEffectivenessEvidenceOptions = {}
) {
  const { enabled = true } = options;

  if (!enabled || !criterionScores) {
    return {
      evidence: [],
      isLoading: false,
      isError: false,
      error: null,
      isRefetching: false,
      refetch: () => {},
      query: null,
    };
  }

  // Convert criterion scores to evidence format that drawer expects
  const evidence = criterionScores
    .filter(score => !selectedCriterion || score.criterion === selectedCriterion)
    .map(score => ({
      id: score.id,
      criterion: score.criterion,
      type: 'analysis',
      content: score.evidence.description,
      details: score.evidence.details,
      reasoning: score.evidence.reasoning,
      passes: score.passes,
    }));

  return {
    // Data
    evidence,
    
    // Loading states (always false since data is embedded)
    isLoading: false,
    isError: false,
    error: null,
    isRefetching: false,
    
    // Actions
    refetch: () => {},
    
    // Raw query for advanced usage
    query: null,
  };
}

export type UseEffectivenessEvidenceReturn = ReturnType<typeof useEffectivenessEvidence>;