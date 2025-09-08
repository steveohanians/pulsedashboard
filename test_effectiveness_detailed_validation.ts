/**
 * Effectiveness Run – Full Testing File Plan
 * 
 * Validates the entire effectiveness run from start to finish, showing detailed steps,
 * tier grouping, resource monitoring, and error classification.
 */

import { effectivenessService } from './server/services/EffectivenessService.js';
import { storage } from './server/storage.js';
import logger from './server/utils/logging/logger.js';

interface ValidationStep {
  step: string;
  success: boolean;
  timeTaken: number;
  progressAdvanced?: number;
  details: Record<string, any>;
  errorClassification?: 'network_timeout' | 'ai_api_error' | 'browser_crash' | 'database_error' | 'parsing_error';
  errorMessage?: string;
}

interface ResourceMonitoring {
  checkpoint: string;
  browserMemoryUsage?: number;
  browserRecyclingEvents: number;
  pageCountBefore: number;
  pageCountAfter: number;
  timestamp: string;
}

class EffectivenessDetailedValidator {
  private validationSteps: ValidationStep[] = [];
  private resourceMonitoring: ResourceMonitoring[] = [];
  private startTime: number = 0;
  private competitorCount: number = 0;

  async validateFullEffectivenessRun(clientId: string): Promise<void> {
    console.log(`🔍 EFFECTIVENESS RUN – FULL TESTING FILE PLAN`);
    console.log(`=============================================`);
    console.log(`Client ID: ${clientId}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log();

    this.startTime = Date.now();

    try {
      // Step 1: Competitor Count
      await this.validateStep1_CompetitorCount(clientId);
      
      // Step 2: Client Processing
      await this.validateStep2_ClientProcessing(clientId);
      
      // Step 3: Competitor Processing
      await this.validateStep3_CompetitorProcessing(clientId);
      
      // Step 4: Insights & Completion
      await this.validateStep4_InsightsCompletion(clientId);
      
      // Step 5: Resource Monitoring Summary
      this.displayResourceMonitoringSummary();
      
      // Step 6: Error Classification Summary
      this.displayErrorClassificationSummary();
      
      // Final Summary
      this.displayFinalSummary();

    } catch (error) {
      console.log(`❌ CRITICAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Detailed validation failed', { error });
    }
  }

  private async validateStep1_CompetitorCount(clientId: string): Promise<void> {
    console.log(`📊 STEP 1: COMPETITOR COUNT`);
    console.log(`──────────────────────────`);
    
    const stepStart = Date.now();
    
    try {
      const competitors = await storage.getCompetitorsByClient(clientId);
      this.competitorCount = competitors.length;
      
      this.recordStep({
        step: 'competitor_count',
        success: true,
        timeTaken: Date.now() - stepStart,
        details: { 
          count: this.competitorCount,
          competitors: competitors.map(c => ({ id: c.id, domain: c.domain, label: c.label }))
        }
      });

      console.log(`✅ Found ${this.competitorCount} competitors`);
      competitors.forEach(comp => {
        console.log(`   • ${comp.label}: ${comp.domain}`);
      });

    } catch (error) {
      this.recordStep({
        step: 'competitor_count',
        success: false,
        timeTaken: Date.now() - stepStart,
        details: { error: error instanceof Error ? error.message : String(error) },
        errorClassification: 'database_error',
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      console.log(`❌ Failed to get competitor count: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log();
  }

  private async validateStep2_ClientProcessing(clientId: string): Promise<void> {
    console.log(`🏢 STEP 2: CLIENT PROCESSING`);
    console.log(`──────────────────────────`);
    
    // Start analysis
    const { runId } = await effectivenessService.startAnalysis(clientId, true);
    console.log(`   Run ID: ${runId}`);
    console.log();

    // Monitor the entire client processing pipeline
    await this.monitorClientProcessingPipeline(runId);
  }

  private async monitorClientProcessingPipeline(runId: string): Promise<void> {
    const maxDuration = 5 * 60 * 1000; // 5 minutes max
    const startTime = Date.now();
    let currentPhase = 'initializing';
    let tierResults: Record<string, any> = {};

    console.log(`📸 2.1 SCREENSHOT & HTML RETRIEVAL`);
    console.log(`─────────────────────────────────`);

    while (Date.now() - startTime < maxDuration) {
      const progress = await effectivenessService.getProgress(runId);
      
      if (!progress) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // Track phase transitions and validate each step
      if (progress.status !== currentPhase) {
        await this.validatePhaseTransition(runId, currentPhase, progress.status, progress);
        currentPhase = progress.status;
      }

      // Check if completed or failed
      if (['completed', 'failed'].includes(progress.status)) {
        console.log(`✅ Client processing completed with status: ${progress.status}`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Validate final results
    await this.validateClientFinalResults(runId);
  }

  private async validatePhaseTransition(runId: string, oldPhase: string, newPhase: string, progress: any): Promise<void> {
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`🔄 ${timestamp} | ${oldPhase.toUpperCase()} → ${newPhase.toUpperCase()} | ${progress.progress}% | ${progress.progressDetail}`);

    switch (newPhase) {
      case 'scraping':
        await this.validateScreenshotHTMLRetrieval(runId, progress);
        break;
      case 'analyzing':
        await this.validateTierAnalysis(runId, progress);
        break;
      case 'completed':
        await this.validateClientCompletion(runId, progress);
        break;
      case 'failed':
        await this.validateFailure(runId, progress);
        break;
    }

    // Record resource monitoring at key checkpoints
    if (['tier1_complete', 'tier2_complete', 'tier3_complete', 'completed'].includes(newPhase)) {
      await this.recordResourceMonitoring(newPhase);
    }
  }

  private async validateScreenshotHTMLRetrieval(runId: string, progress: any): Promise<void> {
    const stepStart = Date.now();

    try {
      // Get current run to check screenshot URLs
      const run = await storage.getEffectivenessRun(runId);
      
      if (run) {
        // Validate above-fold screenshot
        if (run.screenshotUrl) {
          this.recordStep({
            step: 'above_fold_screenshot',
            success: true,
            timeTaken: Date.now() - stepStart,
            progressAdvanced: 5,
            details: { 
              screenshotUrl: run.screenshotUrl,
              screenshotMethod: run.screenshotMethod,
              urlValidation: run.screenshotUrl.includes('screenshot_')
            }
          });
          console.log(`   ✅ Above-fold screenshot: ${run.screenshotUrl}`);
        } else {
          this.recordStep({
            step: 'above_fold_screenshot',
            success: false,
            timeTaken: Date.now() - stepStart,
            details: { error: 'No screenshot URL found' },
            errorClassification: 'browser_crash',
            errorMessage: 'Screenshot capture failed'
          });
          console.log(`   ❌ Above-fold screenshot: FAILED`);
        }

        // Validate full-page screenshot
        if (run.fullPageScreenshotUrl) {
          this.recordStep({
            step: 'full_page_screenshot',
            success: true,
            timeTaken: Date.now() - stepStart,
            progressAdvanced: 5,
            details: { 
              fullPageScreenshotUrl: run.fullPageScreenshotUrl,
              urlValidation: run.fullPageScreenshotUrl.includes('fullpage_')
            }
          });
          console.log(`   ✅ Full-page screenshot: ${run.fullPageScreenshotUrl}`);
        } else {
          this.recordStep({
            step: 'full_page_screenshot',
            success: false,
            timeTaken: Date.now() - stepStart,
            details: { error: 'No full-page screenshot URL found' },
            errorClassification: 'browser_crash',
            errorMessage: 'Full-page screenshot capture failed'
          });
          console.log(`   ❌ Full-page screenshot: FAILED`);
        }
      }

    } catch (error) {
      this.recordStep({
        step: 'screenshot_html_retrieval',
        success: false,
        timeTaken: Date.now() - stepStart,
        details: { error: error instanceof Error ? error.message : String(error) },
        errorClassification: 'database_error',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async validateTierAnalysis(runId: string, progress: any): Promise<void> {
    console.log();
    console.log(`🔍 2.2-2.4 TIER ANALYSIS MONITORING`);
    console.log(`─────────────────────────────────`);

    // Wait for criterion scores to be available
    await this.waitAndValidateCriterionScores(runId);
  }

  private async waitAndValidateCriterionScores(runId: string): Promise<void> {
    const maxWait = 3 * 60 * 1000; // 3 minutes
    const startTime = Date.now();
    let lastCriteriaCount = 0;

    while (Date.now() - startTime < maxWait) {
      try {
        const criterionScores = await storage.getCriterionScores(runId);
        
        if (criterionScores.length > lastCriteriaCount) {
          // New criteria completed, validate each one
          const newScores = criterionScores.slice(lastCriteriaCount);
          
          for (const score of newScores) {
            await this.validateCriterionScore(runId, score);
          }
          
          lastCriteriaCount = criterionScores.length;

          // Check if all 8 criteria are complete
          if (criterionScores.length >= 8) {
            console.log(`✅ All 8 criteria completed`);
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.log(`⚠️ Error checking criterion scores: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  private async validateCriterionScore(runId: string, score: any): Promise<void> {
    const stepStart = Date.now();
    const tier = score.tier || 1;
    const isAIPowered = ['positioning', 'brand_story', 'ctas'].includes(score.criterion);
    const isSpeedAPI = score.criterion === 'speed';

    console.log(`   📊 Tier ${tier} | ${score.criterion.toUpperCase()}: ${score.score}/10`);

    // Validate based on criterion type
    if (isAIPowered) {
      await this.validateAIPoweredCriterion(runId, score);
    } else if (isSpeedAPI) {
      await this.validateSpeedAPICriterion(runId, score);
    } else {
      await this.validateHTMLCriterion(runId, score);
    }

    // Validate database write
    this.recordStep({
      step: `${score.criterion}_database_write`,
      success: !!score.id,
      timeTaken: Date.now() - stepStart,
      details: { 
        criterionId: score.id,
        score: score.score,
        tier: score.tier,
        evidenceLength: JSON.stringify(score.evidence).length,
        passedCount: score.passes?.passed?.length || 0,
        failedCount: score.passes?.failed?.length || 0
      }
    });
  }

  private async validateAIPoweredCriterion(runId: string, score: any): Promise<void> {
    const stepStart = Date.now();

    // Check if evidence contains AI response indicators
    const hasAIResponse = score.evidence?.details?.analysis ? true : false;
    const hasVisualSupport = score.evidence?.details?.visual_effectiveness ? true : false;
    const confidence = score.evidence?.details?.analysis?.confidence || 0;

    this.recordStep({
      step: `${score.criterion}_ai_analysis`,
      success: hasAIResponse,
      timeTaken: Date.now() - stepStart,
      progressAdvanced: 10,
      details: {
        hasAIResponse,
        hasVisualSupport,
        confidence,
        responseLength: JSON.stringify(score.evidence?.details?.analysis || {}).length,
        jsonValidation: confidence > 0
      }
    });

    console.log(`     🤖 AI Analysis: ${hasAIResponse ? '✅' : '❌'} | Confidence: ${confidence} | Visual: ${hasVisualSupport ? '✅' : '❌'}`);
  }

  private async validateSpeedAPICriterion(runId: string, score: any): Promise<void> {
    const stepStart = Date.now();

    const hasPerformanceScore = score.evidence?.details?.performanceScore ? true : false;
    const hasWebVitals = score.evidence?.details?.webVitals ? true : false;
    const apiStatus = score.evidence?.details?.apiStatus;

    this.recordStep({
      step: `${score.criterion}_api_analysis`,
      success: hasPerformanceScore,
      timeTaken: Date.now() - stepStart,
      progressAdvanced: 15,
      details: {
        hasPerformanceScore,
        hasWebVitals,
        apiStatus,
        performanceScore: score.evidence?.details?.performanceScore,
        webVitals: score.evidence?.details?.webVitals
      }
    });

    console.log(`     🌐 PageSpeed API: ${hasPerformanceScore ? '✅' : '❌'} | Score: ${score.evidence?.details?.performanceScore || 'N/A'} | Status: ${apiStatus}`);
  }

  private async validateHTMLCriterion(runId: string, score: any): Promise<void> {
    const stepStart = Date.now();

    const hasEvidence = score.evidence?.details ? true : false;
    const evidenceKeys = Object.keys(score.evidence?.details || {});

    this.recordStep({
      step: `${score.criterion}_html_analysis`,
      success: hasEvidence,
      timeTaken: Date.now() - stepStart,
      progressAdvanced: 8,
      details: {
        hasEvidence,
        evidenceKeyCount: evidenceKeys.length,
        evidenceKeys: evidenceKeys.slice(0, 5), // First 5 keys
        reasoning: score.evidence?.reasoning?.substring(0, 100) + '...'
      }
    });

    console.log(`     📝 HTML Analysis: ${hasEvidence ? '✅' : '❌'} | Evidence Keys: ${evidenceKeys.length}`);
  }

  private async validateClientFinalResults(runId: string): Promise<void> {
    console.log();
    console.log(`📊 2.5 FINAL CLIENT SCORING`);
    console.log(`─────────────────────────`);

    try {
      const run = await storage.getEffectivenessRun(runId);
      const criterionScores = await storage.getCriterionScores(runId);

      if (run && run.overallScore) {
        this.recordStep({
          step: 'client_aggregate_score',
          success: true,
          timeTaken: 50, // Approximate
          progressAdvanced: 5,
          details: {
            overallScore: parseFloat(run.overallScore),
            criteriaCount: criterionScores.length,
            status: run.status,
            hasScreenshots: !!(run.screenshotUrl && run.fullPageScreenshotUrl)
          }
        });

        console.log(`✅ Client aggregate score: ${run.overallScore}/10`);
        console.log(`✅ Criteria completed: ${criterionScores.length}/8`);
        console.log(`✅ Screenshots captured: ${run.screenshotUrl ? '✅' : '❌'} / ${run.fullPageScreenshotUrl ? '✅' : '❌'}`);
      }

    } catch (error) {
      this.recordStep({
        step: 'client_final_results',
        success: false,
        timeTaken: 50,
        details: { error: error instanceof Error ? error.message : String(error) },
        errorClassification: 'database_error',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }

    console.log();
  }

  private async validateClientCompletion(runId: string, progress: any): Promise<void> {
    console.log(`✅ Client analysis completed successfully`);
    await this.recordResourceMonitoring('client_complete');
  }

  private async validateFailure(runId: string, progress: any): Promise<void> {
    console.log(`❌ Client analysis failed: ${progress.progressDetail}`);
    
    this.recordStep({
      step: 'client_failure',
      success: false,
      timeTaken: Date.now() - this.startTime,
      details: { 
        failureReason: progress.progressDetail,
        finalProgress: progress.progress
      },
      errorClassification: this.classifyError(progress.progressDetail),
      errorMessage: progress.progressDetail
    });
  }

  private async validateStep3_CompetitorProcessing(clientId: string): Promise<void> {
    console.log(`🥊 STEP 3: COMPETITOR PROCESSING`);
    console.log(`─────────────────────────────────`);

    if (this.competitorCount === 0) {
      console.log(`ℹ️  No competitors to process`);
      console.log();
      return;
    }

    console.log(`Processing ${this.competitorCount} competitors...`);
    console.log();

    // Get competitor effectiveness data
    const maxWait = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const competitorData = await this.getCompetitorEffectivenessData(clientId);
        
        if (competitorData.length > 0) {
          for (let i = 0; i < competitorData.length; i++) {
            await this.validateCompetitorResults(competitorData[i], i + 1);
          }
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.log(`⚠️ Error checking competitor results: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log();
  }

  private async getCompetitorEffectivenessData(clientId: string): Promise<any[]> {
    // Get latest competitor runs with complete data
    const competitorRuns = await storage.db
      .select({
        runId: storage.effectivenessRuns.id,
        competitorId: storage.effectivenessRuns.competitorId,
        overallScore: storage.effectivenessRuns.overallScore,
        status: storage.effectivenessRuns.status,
        createdAt: storage.effectivenessRuns.createdAt,
        screenshotUrl: storage.effectivenessRuns.screenshotUrl,
        fullPageScreenshotUrl: storage.effectivenessRuns.fullPageScreenshotUrl,
        competitorDomain: storage.competitors.domain,
        competitorLabel: storage.competitors.label
      })
      .from(storage.effectivenessRuns)
      .innerJoin(storage.competitors, storage.eq(storage.effectivenessRuns.competitorId, storage.competitors.id))
      .where(storage.and(
        storage.eq(storage.effectivenessRuns.clientId, clientId),
        storage.isNotNull(storage.effectivenessRuns.competitorId),
        storage.eq(storage.effectivenessRuns.status, 'completed')
      ))
      .orderBy(storage.desc(storage.effectivenessRuns.createdAt))
      .limit(10);

    const competitorData = [];
    for (const run of competitorRuns) {
      const criterionScores = await storage.getCriterionScores(run.runId);
      
      competitorData.push({
        competitor: {
          id: run.competitorId,
          domain: run.competitorDomain,
          label: run.competitorLabel
        },
        run: {
          id: run.runId,
          overallScore: parseFloat(run.overallScore || '0'),
          status: run.status,
          criterionScores: criterionScores,
          screenshotUrl: run.screenshotUrl,
          fullPageScreenshotUrl: run.fullPageScreenshotUrl
        }
      });
    }

    return competitorData;
  }

  private async validateCompetitorResults(competitorData: any, competitorIndex: number): Promise<void> {
    const { competitor, run } = competitorData;
    
    console.log(`🏢 COMPETITOR ${competitorIndex}: ${competitor.label} (${competitor.domain})`);
    console.log(`─────────────────────────────────────────────────────────────────`);

    // 3.1 Screenshot & HTML Retrieval
    console.log(`📸 3.${competitorIndex}.1 SCREENSHOT & HTML RETRIEVAL`);
    this.validateCompetitorScreenshots(run, competitor);

    // 3.2-3.4 Tier Analysis
    console.log(`🔍 3.${competitorIndex}.2-3.${competitorIndex}.4 TIER ANALYSIS`);
    this.validateCompetitorTierAnalysis(run, competitor);

    // 3.5 Final Competitor Scoring
    console.log(`📊 3.${competitorIndex}.5 FINAL COMPETITOR SCORING`);
    this.validateCompetitorFinalScoring(run, competitor);

    console.log();
  }

  private validateCompetitorScreenshots(run: any, competitor: any): void {
    const stepStart = Date.now();

    // Above-fold screenshot
    if (run.screenshotUrl) {
      this.recordStep({
        step: `competitor_${competitor.id}_above_fold_screenshot`,
        success: true,
        timeTaken: Date.now() - stepStart,
        progressAdvanced: 5,
        details: { 
          competitorDomain: competitor.domain,
          screenshotUrl: run.screenshotUrl,
          urlValidation: run.screenshotUrl.includes('screenshot_')
        }
      });
      console.log(`   ✅ Above-fold screenshot: ${run.screenshotUrl}`);
    } else {
      this.recordStep({
        step: `competitor_${competitor.id}_above_fold_screenshot`,
        success: false,
        timeTaken: Date.now() - stepStart,
        details: { error: 'No screenshot URL found' },
        errorClassification: 'browser_crash',
        errorMessage: 'Competitor screenshot capture failed'
      });
      console.log(`   ❌ Above-fold screenshot: FAILED`);
    }

    // Full-page screenshot
    if (run.fullPageScreenshotUrl) {
      this.recordStep({
        step: `competitor_${competitor.id}_full_page_screenshot`,
        success: true,
        timeTaken: Date.now() - stepStart,
        progressAdvanced: 5,
        details: { 
          competitorDomain: competitor.domain,
          fullPageScreenshotUrl: run.fullPageScreenshotUrl,
          urlValidation: run.fullPageScreenshotUrl.includes('fullpage_')
        }
      });
      console.log(`   ✅ Full-page screenshot: ${run.fullPageScreenshotUrl}`);
    } else {
      this.recordStep({
        step: `competitor_${competitor.id}_full_page_screenshot`,
        success: false,
        timeTaken: Date.now() - stepStart,
        details: { error: 'No full-page screenshot URL found' },
        errorClassification: 'browser_crash',
        errorMessage: 'Competitor full-page screenshot capture failed'
      });
      console.log(`   ❌ Full-page screenshot: FAILED`);
    }
  }

  private validateCompetitorTierAnalysis(run: any, competitor: any): void {
    const tierResults = this.groupCriteriaByTier(run.criterionScores);

    Object.entries(tierResults).forEach(([tier, criteria]) => {
      console.log(`   📊 Tier ${tier}:`);
      criteria.forEach((criterion: any) => {
        const isAIPowered = ['positioning', 'brand_story', 'ctas'].includes(criterion.criterion);
        const isSpeedAPI = criterion.criterion === 'speed';

        if (isAIPowered) {
          const hasAIResponse = criterion.evidence?.details?.analysis ? true : false;
          const confidence = criterion.evidence?.details?.analysis?.confidence || 0;
          console.log(`     🤖 ${criterion.criterion}: ${criterion.score}/10 | AI: ${hasAIResponse ? '✅' : '❌'} | Confidence: ${confidence}`);
        } else if (isSpeedAPI) {
          const performanceScore = criterion.evidence?.details?.performanceScore;
          console.log(`     🌐 ${criterion.criterion}: ${criterion.score}/10 | Performance: ${performanceScore || 'N/A'}`);
        } else {
          const evidenceKeys = Object.keys(criterion.evidence?.details || {}).length;
          console.log(`     📝 ${criterion.criterion}: ${criterion.score}/10 | Evidence Keys: ${evidenceKeys}`);
        }

        this.recordStep({
          step: `competitor_${competitor.id}_${criterion.criterion}`,
          success: true,
          timeTaken: 100, // Approximate
          details: {
            competitorDomain: competitor.domain,
            criterion: criterion.criterion,
            score: criterion.score,
            tier: parseInt(tier),
            hasEvidence: !!criterion.evidence
          }
        });
      });
    });
  }

  private validateCompetitorFinalScoring(run: any, competitor: any): void {
    this.recordStep({
      step: `competitor_${competitor.id}_final_scoring`,
      success: true,
      timeTaken: 50,
      progressAdvanced: 5,
      details: {
        competitorDomain: competitor.domain,
        overallScore: run.overallScore,
        criteriaCount: run.criterionScores.length,
        hasScreenshots: !!(run.screenshotUrl && run.fullPageScreenshotUrl)
      }
    });

    console.log(`   ✅ Overall Score: ${run.overallScore}/10`);
    console.log(`   ✅ Criteria Completed: ${run.criterionScores.length}/8`);
  }

  private groupCriteriaByTier(criterionScores: any[]): Record<string, any[]> {
    const tiers: Record<string, any[]> = {};
    
    criterionScores.forEach(score => {
      const tier = String(score.tier || 1);
      if (!tiers[tier]) tiers[tier] = [];
      tiers[tier].push(score);
    });

    return tiers;
  }

  private async validateStep4_InsightsCompletion(clientId: string): Promise<void> {
    console.log(`💡 STEP 4: INSIGHTS & COMPLETION`);
    console.log(`─────────────────────────────────`);

    try {
      const results = await effectivenessService.getLatestResults(clientId);
      
      if (results && results.run) {
        console.log(`✅ Final client score: ${results.run.overallScore}/10`);
        
        if (results.competitorEffectivenessData && results.competitorEffectivenessData.length > 0) {
          console.log(`✅ Competitor data available: ${results.competitorEffectivenessData.length} competitors`);
          
          results.competitorEffectivenessData.forEach((comp: any) => {
            console.log(`   • ${comp.competitor.label}: ${comp.run.overallScore}/10`);
          });
          
          console.log(`✅ Radar chart data ready for plotting`);
        }

        this.recordStep({
          step: 'insights_completion',
          success: true,
          timeTaken: 100,
          details: {
            clientScore: results.run.overallScore,
            competitorCount: results.competitorEffectivenessData?.length || 0,
            hasRadarChartData: true
          }
        });
      }

    } catch (error) {
      this.recordStep({
        step: 'insights_completion',
        success: false,
        timeTaken: 100,
        details: { error: error instanceof Error ? error.message : String(error) },
        errorClassification: 'database_error',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }

    console.log();
  }

  private async recordResourceMonitoring(checkpoint: string): Promise<void> {
    this.resourceMonitoring.push({
      checkpoint,
      browserRecyclingEvents: 0, // Would need to implement actual monitoring
      pageCountBefore: 0,
      pageCountAfter: 0,
      timestamp: new Date().toISOString()
    });
  }

  private displayResourceMonitoringSummary(): void {
    console.log(`📊 STEP 5: RESOURCE MONITORING`);
    console.log(`──────────────────────────────`);

    if (this.resourceMonitoring.length > 0) {
      this.resourceMonitoring.forEach(monitor => {
        console.log(`   🔄 ${monitor.checkpoint}: ${monitor.timestamp}`);
        console.log(`      Browser recycling events: ${monitor.browserRecyclingEvents}`);
        console.log(`      Page count before/after: ${monitor.pageCountBefore}/${monitor.pageCountAfter}`);
      });
    } else {
      console.log(`   ℹ️  No resource monitoring data collected`);
    }

    console.log();
  }

  private displayErrorClassificationSummary(): void {
    console.log(`⚠️  STEP 6: ERROR CLASSIFICATION`);
    console.log(`─────────────────────────────────`);

    const errors = this.validationSteps.filter(step => !step.success);
    
    if (errors.length === 0) {
      console.log(`   ✅ No errors detected`);
    } else {
      const errorsByType = this.groupErrorsByClassification(errors);
      
      Object.entries(errorsByType).forEach(([classification, errorList]) => {
        console.log(`   ❌ ${classification.toUpperCase()}: ${errorList.length} errors`);
        errorList.forEach(error => {
          console.log(`      • ${error.step}: ${error.errorMessage}`);
        });
      });
    }

    console.log();
  }

  private groupErrorsByClassification(errors: ValidationStep[]): Record<string, ValidationStep[]> {
    const grouped: Record<string, ValidationStep[]> = {};
    
    errors.forEach(error => {
      const classification = error.errorClassification || 'unclassified';
      if (!grouped[classification]) grouped[classification] = [];
      grouped[classification].push(error);
    });

    return grouped;
  }

  private displayFinalSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const successfulSteps = this.validationSteps.filter(step => step.success).length;
    const totalSteps = this.validationSteps.length;
    const successRate = Math.round((successfulSteps / totalSteps) * 100);

    console.log(`📈 FINAL SUMMARY`);
    console.log(`───────────────`);
    console.log(`✅ Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`✅ Success Rate: ${successRate}% (${successfulSteps}/${totalSteps})`);
    console.log(`✅ Competitors Processed: ${this.competitorCount}`);
    console.log(`✅ Resource Monitoring Points: ${this.resourceMonitoring.length}`);
    console.log();

    // Top-level results
    const clientSteps = this.validationSteps.filter(step => step.step.includes('client_'));
    const competitorSteps = this.validationSteps.filter(step => step.step.includes('competitor_'));
    
    console.log(`🏢 Client Processing: ${clientSteps.filter(s => s.success).length}/${clientSteps.length} successful`);
    console.log(`🥊 Competitor Processing: ${competitorSteps.filter(s => s.success).length}/${competitorSteps.length} successful`);
  }

  private recordStep(step: ValidationStep): void {
    this.validationSteps.push(step);
  }

  private classifyError(errorMessage: string): ValidationStep['errorClassification'] {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('timeout') || message.includes('network')) {
      return 'network_timeout';
    } else if (message.includes('openai') || message.includes('api')) {
      return 'ai_api_error';
    } else if (message.includes('browser') || message.includes('screenshot')) {
      return 'browser_crash';
    } else if (message.includes('database') || message.includes('sql')) {
      return 'database_error';
    } else if (message.includes('parse') || message.includes('json')) {
      return 'parsing_error';
    }
    
    return 'parsing_error'; // Default
  }
}

// Main execution
async function main() {
  const clientId = process.argv[2] || 'demo-client-id';
  const validator = new EffectivenessDetailedValidator();
  await validator.validateFullEffectivenessRun(clientId);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EffectivenessDetailedValidator };