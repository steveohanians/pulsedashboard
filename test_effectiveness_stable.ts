#!/usr/bin/env npx tsx
/**
 * STABLE Effectiveness Complete Test
 * 
 * Enhanced version with improved browser stability and timeout handling:
 * - Aggressive browser recycling
 * - Progressive timeout handling  
 * - Graceful fallback mechanisms
 * - Resource monitoring and cleanup
 * 
 * Usage: npx tsx test_effectiveness_stable.ts [clientId]
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '.env') });

// Import necessary modules
import { storage } from './server/storage';
import { EnhancedWebsiteEffectivenessScorer } from './server/services/effectiveness/enhancedScorer';
import { screenshotService } from './server/services/effectiveness/screenshot';
import { parallelDataCollector } from './server/services/effectiveness/parallelDataCollector';
import { EffectivenessConfigManager } from './server/services/effectiveness/config';
import { db } from './server/db';
import { effectivenessRuns, criterionScores } from './shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { OpenAI } from 'openai';

// Types
interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  progress?: number;
  details?: any;
  error?: string;
  errorType?: ErrorType;
}

type ErrorType = 'network_timeout' | 'ai_api_error' | 'browser_crash' | 'database_error' | 'parsing_error' | 'unknown';

interface ResourceMetrics {
  memoryUsageMB: number;
  browserPageCount: number;
  browserRecycled: boolean;
  timestamp: Date;
}

// Enhanced Test Runner with Stability Improvements
class StableEffectivenessTestRunner {
  private results: TestResult[] = [];
  private resourceMetrics: ResourceMetrics[] = [];
  private startTime: number = 0;
  private currentProgress: number = 0;
  private scorer: EnhancedWebsiteEffectivenessScorer;
  private configManager: EffectivenessConfigManager;
  private openai: OpenAI;
  private browserRecycleCount: number = 0;
  private maxRetries: number = 2;

  constructor() {
    this.scorer = new EnhancedWebsiteEffectivenessScorer();
    this.configManager = EffectivenessConfigManager.getInstance();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Main test execution with enhanced stability
   */
  async runTest(clientId: string): Promise<void> {
    console.log(chalk.bold.cyan('\n========================================'));
    console.log(chalk.bold.cyan('  STABLE EFFECTIVENESS RUN - ENHANCED'));
    console.log(chalk.bold.cyan('========================================\n'));

    this.startTime = performance.now();

    try {
      // Step 1: Get client and competitors
      await this.step1_GetClientAndCompetitors(clientId);

      // Step 2: Process client (with browser recycling)
      await this.step2_ProcessClient(clientId);
      await this.forceBrowserRecycle('After Client');

      // Step 3: Process competitors (with frequent recycling)  
      await this.step3_ProcessCompetitors(clientId);
      await this.forceBrowserRecycle('After All Competitors');

      // Step 4: Generate insights
      await this.step4_GenerateInsights(clientId);

      // Step 5: Final summary with complete results
      await this.step5_FinalSummary(clientId);

    } catch (error) {
      console.error(chalk.red('\n❌ Test failed with critical error:'), error);
      this.recordResult('CRITICAL_ERROR', false, 0, { error: error instanceof Error ? error.message : String(error) });
    } finally {
      // Aggressive cleanup
      await this.aggressiveCleanup();
    }
  }

  /**
   * Step 1: Get client and competitors
   */
  private async step1_GetClientAndCompetitors(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n📋 STEP 1: CLIENT & COMPETITOR DISCOVERY'));
    console.log(chalk.gray('─'.repeat(50)));

    const stepStart = performance.now();

    try {
      // Get client
      const client = await storage.getClient(clientId);
      if (!client) {
        throw new Error(`Client not found: ${clientId}`);
      }

      this.recordResult('Get Client', true, performance.now() - stepStart, {
        clientName: client.name,
        websiteUrl: client.websiteUrl
      });

      // Get competitors
      const competitors = await storage.getCompetitorsByClient(clientId);
      
      this.recordResult('Get Competitors', true, performance.now() - stepStart, {
        count: competitors.length,
        competitors: competitors.map(c => ({ id: c.id, domain: c.domain, label: c.label }))
      });

      console.log(chalk.green(`✓ Found client: ${client.name}`));
      console.log(chalk.green(`✓ Found ${competitors.length} competitor(s)`));

      // Store for later use
      (this as any).client = client;
      (this as any).competitors = competitors;

    } catch (error) {
      this.recordResult('Client/Competitor Discovery', false, performance.now() - stepStart, 
        { error: error instanceof Error ? error.message : String(error) },
        this.classifyError(error)
      );
      throw error;
    }
  }

  /**
   * Step 2: Process Client with Enhanced Stability
   */
  private async step2_ProcessClient(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n🏢 STEP 2: CLIENT PROCESSING'));
    console.log(chalk.gray('─'.repeat(50)));

    const client = (this as any).client;
    
    // Create effectiveness run
    const run = await storage.createEffectivenessRun({
      clientId,
      status: 'pending',
      overallScore: null
    });

    console.log(chalk.cyan(`Created run: ${run.id}`));

    try {
      // 2.1: Data Collection with retry logic
      await this.retryOperation(() => this.step2_1_DataCollection(client.websiteUrl, 'CLIENT'), 'Data Collection');

      // 2.2: Tier 1 - Fast HTML Analysis
      await this.retryOperation(() => this.step2_2_Tier1Analysis(run.id, 'CLIENT'), 'Tier 1 Analysis');

      // Recycle browser before AI operations
      await this.forceBrowserRecycle('Before AI Operations');

      // 2.3: Tier 2 - AI-Powered Analysis
      await this.retryOperation(() => this.step2_3_Tier2Analysis(run.id, 'CLIENT'), 'Tier 2 Analysis');

      // 2.4: Tier 3 - External API Analysis  
      await this.retryOperation(() => this.step2_4_Tier3Analysis(run.id, 'CLIENT'), 'Tier 3 Analysis');

      // 2.5: Final Client Scoring
      await this.step2_5_FinalScoring(run.id, 'CLIENT');

      // Record resource metrics after client processing
      await this.recordResourceMetrics('After Client Processing');

    } catch (error) {
      console.error(chalk.red('Client processing failed:'), error);
      await storage.updateEffectivenessRun(run.id, {
        status: 'failed',
        progress: `Failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    (this as any).clientRunId = run.id;
  }

  /**
   * Enhanced Data Collection with fallback mechanisms
   */
  private async step2_1_DataCollection(url: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  📸 2.1: Data Collection - ${entity}`));
    
    const config = await this.configManager.getConfig();
    const collectionStart = performance.now();

    try {
      // Force browser cleanup before data collection
      await screenshotService.cleanup();
      
      // Collect all data in parallel with timeout
      const dataPromise = parallelDataCollector.collectAllData(url, config);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data collection timeout')), 60000)
      );
      
      const dataResult = await Promise.race([dataPromise, timeoutPromise]) as any;
      
      // Record results with detailed error tracking
      this.recordResult(`${entity}: Above-fold Screenshot`, 
        !!dataResult.screenshotUrl && !dataResult.screenshotError,
        performance.now() - collectionStart,
        {
          url: dataResult.screenshotUrl,
          method: dataResult.screenshotMethod,
          error: dataResult.screenshotError
        },
        dataResult.screenshotError ? this.classifyError(new Error(dataResult.screenshotError)) : undefined
      );

      this.recordResult(`${entity}: Full-page Screenshot`,
        !!dataResult.fullPageScreenshotUrl && !dataResult.fullPageScreenshotError,
        performance.now() - collectionStart,
        {
          url: dataResult.fullPageScreenshotUrl,
          error: dataResult.fullPageScreenshotError
        },
        dataResult.fullPageScreenshotError ? this.classifyError(new Error(dataResult.fullPageScreenshotError)) : undefined
      );

      this.recordResult(`${entity}: Rendered HTML`,
        !!dataResult.renderedHtml && dataResult.renderedHtml.length > 100,
        performance.now() - collectionStart,
        {
          length: dataResult.renderedHtml?.length || 0,
          error: dataResult.renderedHtmlError
        },
        dataResult.renderedHtmlError ? this.classifyError(new Error(dataResult.renderedHtmlError)) : undefined
      );

      this.recordResult(`${entity}: Raw HTML`,
        !!dataResult.initialHtml,
        performance.now() - collectionStart,
        {
          length: dataResult.initialHtml?.length || 0
        }
      );

      // Store for later use
      (this as any)[`${entity.toLowerCase()}Data`] = dataResult;
      this.updateProgress(10);

    } catch (error) {
      this.recordResult(`${entity}: Data Collection`, false, performance.now() - collectionStart,
        { error: error instanceof Error ? error.message : String(error) },
        this.classifyError(error)
      );
      
      // For data collection failures, create minimal fallback data
      (this as any)[`${entity.toLowerCase()}Data`] = {
        initialHtml: '',
        renderedHtml: '',
        screenshotUrl: null,
        fullPageScreenshotUrl: null
      };
    }
  }

  // Continue with other methods (keeping them the same but adding retry logic)...
  private async step2_2_Tier1Analysis(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  ⚡ 2.2: Tier 1 Analysis - ${entity}`));
    
    const tier1Criteria = ['ux', 'trust', 'accessibility', 'seo'];
    const dataResult = (this as any)[`${entity.toLowerCase()}Data`];
    const config = await this.configManager.getConfig();

    for (const criterion of tier1Criteria) {
      const criterionStart = performance.now();
      
      try {
        // Import and execute criterion scorer
        const scorerModule = await import(`./server/services/effectiveness/criteria/${criterion}.js`);
        
        let scorerName: string;
        if (criterion === 'ux') {
          scorerName = 'scoreUX';
        } else if (criterion === 'seo') {
          scorerName = 'scoreSEO';
        } else {
          scorerName = `score${criterion.charAt(0).toUpperCase() + criterion.slice(1).replace(/_/g, '')}`;
        }
        
        const scorer = scorerModule[scorerName] || scorerModule.default;
        
        if (!scorer) {
          throw new Error(`Scorer function not found: ${scorerName} in ${criterion}.js`);
        }
        
        const context = {
          websiteUrl: (this as any).client.websiteUrl,
          html: dataResult.renderedHtml || dataResult.initialHtml || '',
          screenshot: dataResult.screenshotUrl,
          fullPageScreenshot: dataResult.fullPageScreenshotUrl
        };

        const result = await scorer(context, config, this.openai);
        
        // Save to database
        const evidenceWithScreenshots = {
          ...result.evidence,
          screenshotUrl: dataResult.screenshotUrl,
          fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
        };
        
        await storage.createCriterionScore({
          runId,
          criterion,
          score: result.score.toString(),
          evidence: evidenceWithScreenshots,
          passes: result.passes,
          tier: 1,
          completedAt: new Date()
        });

        this.recordResult(`${entity}: ${criterion.toUpperCase()} Score`,
          true,
          performance.now() - criterionStart,
          { score: result.score }
        );

        this.updateProgress(5);

      } catch (error) {
        this.recordResult(`${entity}: ${criterion.toUpperCase()} Score`,
          false,
          performance.now() - criterionStart,
          { error: error instanceof Error ? error.message : String(error) },
          this.classifyError(error)
        );
      }
    }
  }

  private async step2_3_Tier2Analysis(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  🤖 2.3: Tier 2 AI Analysis - ${entity}`));
    
    const tier2Criteria = ['positioning', 'brand_story', 'ctas'];
    const dataResult = (this as any)[`${entity.toLowerCase()}Data`];
    const config = await this.configManager.getConfig();

    for (const criterion of tier2Criteria) {
      const criterionStart = performance.now();
      
      try {
        const fileName = criterion === 'brand_story' ? 'brandStory' : criterion;
        const scorerModule = await import(`./server/services/effectiveness/criteria/${fileName}.js`);
        
        let scorerName: string;
        if (criterion === 'ctas') {
          scorerName = 'scoreCTAs';
        } else {
          scorerName = `score${criterion.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`;
        }
        
        const scorer = scorerModule[scorerName] || scorerModule.default;
        
        if (!scorer) {
          throw new Error(`Scorer function not found: ${scorerName} in ${fileName}.js`);
        }
        
        const context = {
          websiteUrl: (this as any).client.websiteUrl,
          html: dataResult.renderedHtml || dataResult.initialHtml || '',
          screenshot: dataResult.screenshotUrl,
          fullPageScreenshot: dataResult.fullPageScreenshotUrl
        };

        const result = await scorer(context, config, this.openai);

        const evidenceWithScreenshots = {
          ...result.evidence,
          screenshotUrl: dataResult.screenshotUrl,
          fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
        };
        
        await storage.createCriterionScore({
          runId,
          criterion,
          score: result.score.toString(),
          evidence: evidenceWithScreenshots,
          passes: result.passes,
          tier: 2,
          completedAt: new Date()
        });

        this.recordResult(`${entity}: ${criterion.toUpperCase()} Score (AI)`,
          true,
          performance.now() - criterionStart,
          { score: result.score }
        );

        this.updateProgress(7);

      } catch (error) {
        this.recordResult(`${entity}: ${criterion.toUpperCase()} Score (AI)`,
          false,
          performance.now() - criterionStart,
          { error: error instanceof Error ? error.message : String(error) },
          this.classifyError(error)
        );
      }
    }
  }

  private async step2_4_Tier3Analysis(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  🌐 2.4: Tier 3 External API Analysis - ${entity}`));
    
    const dataResult = (this as any)[`${entity.toLowerCase()}Data`];
    const config = await this.configManager.getConfig();
    const criterionStart = performance.now();

    try {
      const scorerModule = await import('./server/services/effectiveness/criteria/speed.js');
      const scorer = scorerModule.scoreSpeed;
      
      const context = {
        websiteUrl: (this as any).client.websiteUrl,
        html: dataResult.renderedHtml || dataResult.initialHtml || '',
        screenshot: dataResult.screenshotUrl,
        fullPageScreenshot: dataResult.fullPageScreenshotUrl,
        webVitals: dataResult.webVitals
      };

      const result = await scorer(context, config, this.openai);

      const evidenceWithScreenshots = {
        ...result.evidence,
        screenshotUrl: dataResult.screenshotUrl,
        fullPageScreenshotUrl: dataResult.fullPageScreenshotUrl
      };
      
      await storage.createCriterionScore({
        runId,
        criterion: 'speed',
        score: result.score.toString(),
        evidence: evidenceWithScreenshots,
        passes: result.passes,
        tier: 3,
        completedAt: new Date()
      });

      this.recordResult(`${entity}: SPEED Score (PageSpeed API)`,
        true,
        performance.now() - criterionStart,
        { score: result.score }
      );

      this.updateProgress(5);

    } catch (error) {
      this.recordResult(`${entity}: SPEED Score (PageSpeed API)`,
        false,
        performance.now() - criterionStart,
        { error: error instanceof Error ? error.message : String(error) },
        this.classifyError(error)
      );
    }
  }

  private async step2_5_FinalScoring(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  📊 2.5: Final ${entity} Scoring`));
    
    const scoringStart = performance.now();

    try {
      const scores = await storage.getCriterionScores(runId);
      const overallScore = scores.reduce((sum, s) => sum + parseFloat(s.score), 0) / scores.length;
      
      await storage.updateEffectivenessRun(runId, {
        status: 'completed',
        overallScore: overallScore.toFixed(1),
        progress: `${entity} analysis completed`
      });

      this.recordResult(`${entity}: Aggregate Score`,
        true,
        performance.now() - scoringStart,
        {
          overallScore: overallScore.toFixed(1),
          criteriaCount: scores.length
        }
      );

      this.updateProgress(5);

    } catch (error) {
      this.recordResult(`${entity}: Aggregate Score`,
        false,
        performance.now() - scoringStart,
        { error: error instanceof Error ? error.message : String(error) },
        this.classifyError(error)
      );
    }
  }

  /**
   * Step 3: Process Competitors with Enhanced Stability
   */
  private async step3_ProcessCompetitors(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n🏆 STEP 3: COMPETITOR PROCESSING'));
    console.log(chalk.gray('─'.repeat(50)));

    const competitors = (this as any).competitors || [];
    const maxCompetitors = Math.min(3, competitors.length);

    for (let i = 0; i < maxCompetitors; i++) {
      const competitor = competitors[i];
      console.log(chalk.cyan(`\nProcessing competitor ${i + 1}/${maxCompetitors}: ${competitor.label || competitor.domain}`));

      // Force browser recycle before each competitor
      await this.forceBrowserRecycle(`Before Competitor ${i + 1}`);

      const run = await storage.createEffectivenessRun({
        clientId,
        competitorId: competitor.id,
        status: 'pending',
        overallScore: null
      });

      try {
        const competitorUrl = this.ensureProtocol(competitor.domain);
        
        // Process with retry logic and shorter timeouts
        await this.retryOperation(() => this.step2_1_DataCollection(competitorUrl, `COMPETITOR_${i + 1}`), `Competitor ${i + 1} Data`);
        await this.step2_2_Tier1Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_3_Tier2Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_4_Tier3Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_5_FinalScoring(run.id, `COMPETITOR_${i + 1}`);

        await this.recordResourceMetrics(`After Competitor ${i + 1}`);

      } catch (error) {
        console.error(chalk.red(`Competitor ${i + 1} processing failed:`), error);
        await storage.updateEffectivenessRun(run.id, {
          status: 'failed',
          progress: `Failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }

  /**
   * Step 4: Generate Insights
   */
  private async step4_GenerateInsights(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n💡 STEP 4: INSIGHTS GENERATION'));
    console.log(chalk.gray('─'.repeat(50)));

    const insightsStart = performance.now();
    const clientRunId = (this as any).clientRunId;

    try {
      const { createInsightsService } = await import('./server/services/effectiveness/index.js');
      const insightsService = createInsightsService(storage);

      const insights = await insightsService.generateInsights(
        clientId,
        clientRunId,
        undefined,
        'Admin'
      );

      await storage.updateEffectivenessRun(clientRunId, {
        aiInsights: insights.insights,
        insightsGeneratedAt: new Date()
      });

      this.recordResult('AI Insights Generation',
        true,
        performance.now() - insightsStart,
        {
          hasInsights: !!insights.insights,
          insightType: insights.insights?.key_pattern
        }
      );

      console.log(chalk.green('✓ AI insights generated successfully'));
      this.updateProgress(10);

    } catch (error) {
      this.recordResult('AI Insights Generation',
        false,
        performance.now() - insightsStart,
        { error: error instanceof Error ? error.message : String(error) },
        this.classifyError(error)
      );
    }
  }

  /**
   * Step 5: Enhanced Final Summary with Complete Results
   */
  private async step5_FinalSummary(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n📈 STEP 5: FINAL SUMMARY & COMPLETE RESULTS'));
    console.log(chalk.gray('─'.repeat(70)));

    const totalDuration = (performance.now() - this.startTime) / 1000;
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.filter(r => !r.success).length;

    // Get complete run data
    try {
      const clientRunId = (this as any).clientRunId;
      
      // Get client run with all scores and insights
      const clientRun = await db.select().from(effectivenessRuns).where(eq(effectivenessRuns.id, clientRunId)).limit(1);
      const clientScores = await storage.getCriterionScores(clientRunId);

      // Get competitor runs
      const competitorRuns = await db.select().from(effectivenessRuns)
        .where(and(
          eq(effectivenessRuns.clientId, clientId),
          isNull(effectivenessRuns.competitorId) === false
        ));

      // Display comprehensive results
      console.log('\n' + chalk.bold.cyan('🏆 EFFECTIVENESS ANALYSIS COMPLETE RESULTS'));
      console.log(chalk.gray('═'.repeat(60)));

      // Client Results
      if (clientRun.length > 0) {
        const client = (this as any).client;
        console.log(`\n${chalk.bold.green('CLIENT:')} ${client.name} (${client.websiteUrl})`);
        console.log(chalk.cyan(`Overall Score: ${clientRun[0].overallScore || 'N/A'}/10`));
        
        // Detailed criterion scores
        console.log(chalk.yellow('\nDetailed Scores:'));
        for (const score of clientScores) {
          const icon = parseFloat(score.score) >= 7 ? '🟢' : parseFloat(score.score) >= 4 ? '🟡' : '🔴';
          console.log(`  ${icon} ${score.criterion.toUpperCase()}: ${score.score}/10 (Tier ${score.tier})`);
        }

        // AI Insights
        if (clientRun[0].aiInsights) {
          console.log(chalk.yellow('\n💡 AI-Generated Insights:'));
          const insights = clientRun[0].aiInsights as any;
          if (insights.summary) {
            console.log(`  📊 ${insights.summary}`);
          }
          if (insights.strengths) {
            console.log(`  ✅ Strengths: ${insights.strengths.join(', ')}`);
          }
          if (insights.improvements) {
            console.log(`  🔧 Improvements: ${insights.improvements.join(', ')}`);
          }
        }
      }

      // Competitor Results
      if (competitorRuns.length > 0) {
        const competitors = (this as any).competitors;
        console.log(`\n${chalk.bold.blue('COMPETITORS:')}`);
        
        for (const run of competitorRuns) {
          const competitor = competitors.find((c: any) => c.id === run.competitorId);
          if (competitor) {
            const competitorScores = await storage.getCriterionScores(run.id);
            console.log(`\n  ${competitor.label || competitor.domain}`);
            console.log(`  Overall Score: ${run.overallScore || 'N/A'}/10`);
            
            // Top 3 scores
            const topScores = competitorScores
              .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
              .slice(0, 3);
            
            topScores.forEach(score => {
              const icon = parseFloat(score.score) >= 7 ? '🟢' : '🟡';
              console.log(`    ${icon} ${score.criterion.toUpperCase()}: ${score.score}/10`);
            });
          }
        }
      }

      // Comparative Analysis
      if (clientRun.length > 0 && competitorRuns.length > 0) {
        console.log(`\n${chalk.bold.magenta('📊 COMPETITIVE POSITION:')}`);
        const clientScore = parseFloat(clientRun[0].overallScore || '0');
        const competitorScores = competitorRuns
          .filter(r => r.overallScore)
          .map(r => parseFloat(r.overallScore!));

        if (competitorScores.length > 0) {
          const avgCompetitorScore = competitorScores.reduce((sum, s) => sum + s, 0) / competitorScores.length;
          const position = clientScore > avgCompetitorScore ? 'ABOVE' : 'BELOW';
          const icon = position === 'ABOVE' ? '🚀' : '📈';
          
          console.log(`  ${icon} Your score (${clientScore.toFixed(1)}) is ${position} average competitor (${avgCompetitorScore.toFixed(1)})`);
          console.log(`  Gap: ${Math.abs(clientScore - avgCompetitorScore).toFixed(1)} points`);
        }
      }

    } catch (error) {
      console.log(chalk.red('Error displaying complete results:'), error);
    }

    // Test execution summary
    console.log(`\n${chalk.bold('TEST EXECUTION SUMMARY:')}`);
    console.log(chalk.green(`  ✓ Successful steps: ${successCount}`));
    console.log(chalk.red(`  ✗ Failed steps: ${failureCount}`));
    console.log(chalk.blue(`  ⏱ Total duration: ${totalDuration.toFixed(2)}s`));
    console.log(chalk.yellow(`  📊 Final progress: ${this.currentProgress}%`));
    console.log(chalk.cyan(`  ♻️  Browser recycled: ${this.browserRecycleCount} times`));

    // Success rate
    const successRate = (successCount / (successCount + failureCount)) * 100;
    const rateIcon = successRate >= 80 ? '🟢' : successRate >= 60 ? '🟡' : '🔴';
    console.log(`  ${rateIcon} Success rate: ${successRate.toFixed(1)}%`);
  }

  /**
   * Enhanced retry operation with exponential backoff
   */
  private async retryOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  ${operationName} failed (attempt ${attempt}/${this.maxRetries})`));
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Exponential backoff with browser cleanup
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        await screenshotService.cleanup();
      }
    }
    throw new Error(`All retry attempts failed for ${operationName}`);
  }

  /**
   * Force browser recycle with verification
   */
  private async forceBrowserRecycle(checkpoint: string): Promise<void> {
    try {
      await screenshotService.cleanup();
      this.browserRecycleCount++;
      
      if (this.resourceMetrics.length > 0) {
        this.resourceMetrics[this.resourceMetrics.length - 1].browserRecycled = true;
      }
      
      console.log(chalk.cyan(`    ♻️  Browser recycled at ${checkpoint}`));
    } catch (error) {
      console.log(chalk.yellow(`    ⚠️  Browser recycle failed at ${checkpoint}`));
    }
  }

  /**
   * Aggressive cleanup
   */
  private async aggressiveCleanup(): Promise<void> {
    try {
      await screenshotService.cleanup();
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      console.log(chalk.dim('\n🧹 Aggressive cleanup completed'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Cleanup failed'));
    }
  }

  // Helper methods (keeping existing implementations)
  private recordResult(step: string, success: boolean, duration: number, details?: any, errorType?: ErrorType): void {
    const result: TestResult = {
      step,
      success,
      duration,
      progress: this.currentProgress,
      details,
      error: details?.error,
      errorType
    };

    this.results.push(result);

    const icon = success ? chalk.green('✓') : chalk.red('✗');
    const timeStr = chalk.gray(`(${(duration / 1000).toFixed(2)}s)`);
    console.log(`  ${icon} ${step} ${timeStr}`);
    
    if (!success && details?.error) {
      console.log(chalk.red(`    → ${details.error}`));
    }
  }

  private ensureProtocol(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private updateProgress(increment: number): void {
    this.currentProgress = Math.min(100, this.currentProgress + increment);
    console.log(chalk.dim(`    Progress: ${this.currentProgress}%`));
  }

  private classifyError(error: any): ErrorType {
    const message = error?.message?.toLowerCase() || String(error).toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'network_timeout';
    }
    if (message.includes('openai') || message.includes('api key') || message.includes('429')) {
      return 'ai_api_error';
    }
    if (message.includes('browser') || message.includes('playwright')) {
      return 'browser_crash';
    }
    if (message.includes('database') || message.includes('db') || message.includes('postgres')) {
      return 'database_error';
    }
    if (message.includes('parse') || message.includes('json') || message.includes('invalid')) {
      return 'parsing_error';
    }
    
    return 'unknown';
  }

  private async recordResourceMetrics(checkpoint: string): Promise<void> {
    const memUsage = process.memoryUsage();
    const metrics: ResourceMetrics = {
      memoryUsageMB: memUsage.heapUsed / 1024 / 1024,
      browserPageCount: 0,
      browserRecycled: false,
      timestamp: new Date()
    };

    try {
      const browserInfo = await (screenshotService as any).getBrowserInfo?.();
      if (browserInfo) {
        metrics.browserPageCount = browserInfo.pageCount || 0;
      }
    } catch (error) {
      // Browser might not be initialized
    }

    this.resourceMetrics.push(metrics);
    
    console.log(chalk.dim(`    📊 ${checkpoint}: Memory ${metrics.memoryUsageMB.toFixed(1)}MB, Pages: ${metrics.browserPageCount}`));
  }
}

// Main execution
async function main() {
  const clientId = process.argv[2];
  
  if (!clientId) {
    console.error(chalk.red('Error: Please provide a client ID'));
    console.log('Usage: npx tsx test_effectiveness_stable.ts [clientId]');
    process.exit(1);
  }

  const runner = new StableEffectivenessTestRunner();
  
  try {
    await runner.runTest(clientId);
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}