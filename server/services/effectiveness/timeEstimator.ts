/**
 * Effectiveness Run Time Estimator
 * 
 * Provides accurate time estimates based on actual performance data
 * from comprehensive testing and timeout management system data.
 */

import logger from "../../utils/logging/logger";

export interface TimeEstimate {
  estimated: number;        // Most likely duration (seconds)
  minimum: number;          // Best case scenario (seconds)  
  maximum: number;          // Worst case with retries (seconds)
  breakdown: {
    dataCollection: number;
    tierOneAnalysis: number;
    tierTwoAIAnalysis: number;
    tierThreeExternalAPI: number;
    insightGeneration: number;
    overhead: number;
  };
}

export interface RunConfiguration {
  clientCount: number;      // Always 1
  competitorCount: number;  // Usually 2, can vary
  includeInsights: boolean; // AI insights generation
  includeSpeed: boolean;    // PageSpeed API analysis
}

class EffectivenessTimeEstimator {
  private static instance: EffectivenessTimeEstimator;

  // ✅ ACTUAL PERFORMANCE DATA from comprehensive testing
  private readonly performanceBaselines = {
    // Per website timings (seconds)
    dataCollection: {
      typical: 9,     // 8-11s observed
      minimum: 6,     // Fast, simple sites
      maximum: 15,    // Slow, complex sites with retries
    },
    tierOneAnalysis: {
      typical: 2,     // 1-2s observed
      minimum: 1,
      maximum: 4,     // With processing delays
    },
    tierTwoAIAnalysis: {
      typical: 24,    // 22-26s observed
      minimum: 18,    // Quick OpenAI responses
      maximum: 35,    // With retries and rate limiting
    },
    tierThreeExternalAPI: {
      typical: 31,    // 29-33s observed
      minimum: 25,    // Fast PageSpeed API
      maximum: 45,    // With retries and slower sites
    },
    insightGeneration: {
      typical: 20,    // Estimated based on AI complexity
      minimum: 15,
      maximum: 30,
    },
    // System overhead per website
    overhead: {
      typical: 3,     // Scoring, database saves, cleanup
      minimum: 2,
      maximum: 5,
    }
  };

  private constructor() {}

  public static getInstance(): EffectivenessTimeEstimator {
    if (!EffectivenessTimeEstimator.instance) {
      EffectivenessTimeEstimator.instance = new EffectivenessTimeEstimator();
    }
    return EffectivenessTimeEstimator.instance;
  }

  /**
   * ✅ MAIN: Estimate total run time based on configuration
   */
  public estimateRunTime(config: RunConfiguration): TimeEstimate {
    const totalWebsites = config.clientCount + config.competitorCount;
    
    logger.debug('Estimating run time', {
      totalWebsites,
      config
    });

    // Calculate per-component estimates
    const dataCollection = this.estimateComponent('dataCollection', totalWebsites);
    const tierOne = this.estimateComponent('tierOneAnalysis', totalWebsites);
    const tierTwo = this.estimateComponent('tierTwoAIAnalysis', totalWebsites);
    const tierThree = config.includeSpeed ? 
      this.estimateComponent('tierThreeExternalAPI', totalWebsites) : 
      { typical: 0, minimum: 0, maximum: 0 };
    const insights = config.includeInsights ? 
      this.performanceBaselines.insightGeneration.typical : 0;
    const overhead = this.estimateComponent('overhead', totalWebsites);

    const breakdown = {
      dataCollection: dataCollection.typical,
      tierOneAnalysis: tierOne.typical,
      tierTwoAIAnalysis: tierTwo.typical,
      tierThreeExternalAPI: typeof tierThree === 'number' ? tierThree : tierThree.typical,
      insightGeneration: insights,
      overhead: overhead.typical
    };

    const estimated = Object.values(breakdown).reduce((sum, time) => sum + time, 0);
    const minimum = dataCollection.minimum + tierOne.minimum + tierTwo.minimum + 
                   (config.includeSpeed ? this.performanceBaselines.tierThreeExternalAPI.minimum * totalWebsites : 0) +
                   (config.includeInsights ? this.performanceBaselines.insightGeneration.minimum : 0) +
                   overhead.minimum;
    const maximum = dataCollection.maximum + tierOne.maximum + tierTwo.maximum + 
                   (config.includeSpeed ? this.performanceBaselines.tierThreeExternalAPI.maximum * totalWebsites : 0) +
                   (config.includeInsights ? this.performanceBaselines.insightGeneration.maximum : 0) +
                   overhead.maximum;

    const estimate: TimeEstimate = {
      estimated: Math.round(estimated),
      minimum: Math.round(minimum),
      maximum: Math.round(maximum),
      breakdown
    };

    logger.info('Run time estimated', {
      totalWebsites,
      estimated: `${estimate.estimated}s (${(estimate.estimated/60).toFixed(1)}min)`,
      range: `${estimate.minimum}-${estimate.maximum}s`,
      breakdown: Object.entries(breakdown).map(([key, value]) => 
        `${key}: ${value}s`).join(', ')
    });

    return estimate;
  }

  /**
   * ✅ HELPER: Estimate individual component across multiple websites
   */
  private estimateComponent(component: keyof typeof this.performanceBaselines, websiteCount: number) {
    const baseline = this.performanceBaselines[component];
    
    return {
      typical: baseline.typical * websiteCount,
      minimum: baseline.minimum * websiteCount,
      maximum: baseline.maximum * websiteCount
    };
  }

  /**
   * ✅ COMMON CONFIGURATIONS: Pre-calculated estimates for typical scenarios
   */
  public getStandardEstimates() {
    return {
      // Client + 2 competitors (most common)
      standard: this.estimateRunTime({
        clientCount: 1,
        competitorCount: 2,
        includeInsights: true,
        includeSpeed: true
      }),
      
      // Client + 3 competitors (extended analysis)
      extended: this.estimateRunTime({
        clientCount: 1,
        competitorCount: 3,
        includeInsights: true,
        includeSpeed: true
      }),
      
      // Client + 4 competitors (comprehensive)
      comprehensive: this.estimateRunTime({
        clientCount: 1,
        competitorCount: 4,
        includeInsights: true,
        includeSpeed: true
      }),
      
      // Client only (quick analysis)
      clientOnly: this.estimateRunTime({
        clientCount: 1,
        competitorCount: 0,
        includeInsights: false,
        includeSpeed: true
      })
    };
  }

  /**
   * ✅ PERFORMANCE: Calculate additional time per competitor
   */
  public getAdditionalCompetitorTime(): number {
    // Time for one additional competitor website
    const oneWebsite = 
      this.performanceBaselines.dataCollection.typical +
      this.performanceBaselines.tierOneAnalysis.typical +
      this.performanceBaselines.tierTwoAIAnalysis.typical +
      this.performanceBaselines.tierThreeExternalAPI.typical +
      this.performanceBaselines.overhead.typical;
    
    return Math.round(oneWebsite);
  }

  /**
   * ✅ VALIDATION: Compare estimate against actual run time
   */
  public validateEstimate(
    config: RunConfiguration, 
    actualDurationSeconds: number
  ): {
    accurate: boolean;
    variance: number;
    analysis: string;
  } {
    const estimate = this.estimateRunTime(config);
    const variance = ((actualDurationSeconds - estimate.estimated) / estimate.estimated) * 100;
    const accurate = actualDurationSeconds >= estimate.minimum && actualDurationSeconds <= estimate.maximum;
    
    let analysis = '';
    if (accurate) {
      analysis = `Estimate accurate (${variance > 0 ? '+' : ''}${variance.toFixed(1)}% variance)`;
    } else if (actualDurationSeconds < estimate.minimum) {
      analysis = `Faster than expected (${variance.toFixed(1)}% under estimate)`;
    } else {
      analysis = `Slower than expected (${variance.toFixed(1)}% over estimate)`;
    }
    
    logger.info('Estimate validation', {
      estimated: `${estimate.estimated}s`,
      actual: `${actualDurationSeconds}s`,
      accurate,
      variance: `${variance.toFixed(1)}%`,
      analysis
    });
    
    return {
      accurate,
      variance,
      analysis
    };
  }

  /**
   * ✅ UI HELPER: Format time estimate for display
   */
  public formatEstimate(estimate: TimeEstimate): {
    primary: string;
    detail: string;
    breakdown: string[];
  } {
    const formatTime = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    };

    return {
      primary: `~${formatTime(estimate.estimated)} (${formatTime(estimate.minimum)}-${formatTime(estimate.maximum)})`,
      detail: `Most likely: ${formatTime(estimate.estimated)} • Range: ${formatTime(estimate.minimum)}-${formatTime(estimate.maximum)}`,
      breakdown: [
        `Data Collection: ${formatTime(estimate.breakdown.dataCollection)}`,
        `Basic Analysis: ${formatTime(estimate.breakdown.tierOneAnalysis)}`,
        `AI Analysis: ${formatTime(estimate.breakdown.tierTwoAIAnalysis)}`,
        `Speed Analysis: ${formatTime(estimate.breakdown.tierThreeExternalAPI)}`,
        `Insights: ${formatTime(estimate.breakdown.insightGeneration)}`,
        `Processing: ${formatTime(estimate.breakdown.overhead)}`
      ].filter(item => !item.includes(': 0s'))
    };
  }
}

export const timeEstimator = EffectivenessTimeEstimator.getInstance();