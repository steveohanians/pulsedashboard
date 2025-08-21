/**
 * Utility functions for metric comparison calculations
 * Used to generate comparison chips showing performance vs industry and competitors
 */

interface CompetitorData {
  id: string;
  label: string;
  value: number;
}

/**
 * Calculate percentage difference between client value and benchmark
 * Formula: (client_value - benchmark_value) / benchmark_value * 100
 */
export function calculatePercentageDifference(clientValue: number, benchmarkValue: number): number {
  if (benchmarkValue === 0) return 0;
  return ((clientValue - benchmarkValue) / benchmarkValue) * 100;
}

/**
 * Determine if a metric is "lower is better" (like Bounce Rate)
 * vs "higher is better" (like Session Duration, Pages per Session, Sessions per User)
 */
export function isLowerBetter(metricName: string): boolean {
  return metricName === "Bounce Rate";
}

/**
 * Find the best performing competitor for a given metric
 * Returns the competitor with the best value (lowest for bounce rate, highest for others)
 */
export function findBestCompetitor(competitors: CompetitorData[], metricName: string): CompetitorData | null {
  if (!competitors || competitors.length === 0) return null;
  
  const validCompetitors = competitors.filter(comp => comp.value > 0);
  if (validCompetitors.length === 0) return null;
  
  const lowerIsBetter = isLowerBetter(metricName);
  
  return validCompetitors.reduce((best, current) => {
    if (lowerIsBetter) {
      return current.value < best.value ? current : best;
    } else {
      return current.value > best.value ? current : best;
    }
  });
}

/**
 * Generate comparison data for industry and best competitor
 */
export function generateComparisonData(
  clientValue: number,
  industryAvg: number,
  competitors: CompetitorData[],
  metricName: string
) {
  const comparisons: {
    industry?: { percentage: number; isOutperforming: boolean };
    bestCompetitor?: { percentage: number; isOutperforming: boolean; label: string };
  } = {};

  // Industry comparison with data normalization
  if (industryAvg && industryAvg > 0) {
    // Debug logging to see what data we're getting
    console.log(`[DEBUG] Comparison data for ${metricName}:`, {
      clientValue,
      rawIndustryAvg: industryAvg,
      isDecimal: industryAvg < 1 && industryAvg > 0
    });
    
    // Normalize Industry_Avg to match Client data format (both as percentages)
    // Convert decimal format (0.4934) to percentage format (49.34) if needed
    const normalizedIndustryAvg = industryAvg < 1 && industryAvg > 0
      ? industryAvg * 100
      : industryAvg;
      
    console.log(`[DEBUG] After normalization:`, {
      normalizedIndustryAvg,
      willCalculate: `${clientValue} vs ${normalizedIndustryAvg}`
    });
      
    const industryDiff = calculatePercentageDifference(clientValue, normalizedIndustryAvg);
    const isOutperforming = isLowerBetter(metricName) ? industryDiff < 0 : industryDiff > 0;
    
    console.log(`[DEBUG] Final calculation:`, {
      industryDiff,
      rounded: Math.round(industryDiff),
      isOutperforming
    });
    
    comparisons.industry = {
      percentage: Math.round(industryDiff),
      isOutperforming
    };
  }

  // Best competitor comparison
  const bestCompetitor = findBestCompetitor(competitors, metricName);
  if (bestCompetitor) {
    const competitorDiff = calculatePercentageDifference(clientValue, bestCompetitor.value);
    const isOutperforming = isLowerBetter(metricName) ? competitorDiff < 0 : competitorDiff > 0;
    comparisons.bestCompetitor = {
      percentage: Math.round(competitorDiff),
      isOutperforming,
      label: bestCompetitor.label
    };
  }

  return comparisons;
}