#!/usr/bin/env npx tsx
/**
 * Comprehensive Effectiveness Run Testing File
 * 
 * Tests the entire effectiveness scoring flow from start to finish with:
 * - Detailed step tracking
 * - Tier grouping
 * - Resource monitoring
 * - Error classification
 * - Progress percentage tracking
 * 
 * Usage: npx tsx test_effectiveness_complete.ts [clientId]
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

// Test state
class EffectivenessTestRunner {
  private results: TestResult[] = [];
  private resourceMetrics: ResourceMetrics[] = [];
  private startTime: number = 0;
  private currentProgress: number = 0;
  private scorer: EnhancedWebsiteEffectivenessScorer;
  private configManager: EffectivenessConfigManager;
  private openai: OpenAI;

  constructor() {
    this.scorer = new EnhancedWebsiteEffectivenessScorer();
    this.configManager = EffectivenessConfigManager.getInstance();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Main test execution
   */
  async runTest(clientId: string): Promise<void> {
    console.log(chalk.bold.cyan('\n========================================'));
    console.log(chalk.bold.cyan('  EFFECTIVENESS RUN - COMPREHENSIVE TEST'));
    console.log(chalk.bold.cyan('========================================\n'));

    this.startTime = performance.now();

    try {
      // Step 1: Get client and competitors
      await this.step1_GetClientAndCompetitors(clientId);

      // Step 2: Process client
      await this.step2_ProcessClient(clientId);

      // Step 3: Process competitors
      await this.step3_ProcessCompetitors(clientId);

      // Step 4: Generate insights
      await this.step4_GenerateInsights(clientId);

      // Step 5: Final summary
      await this.step5_FinalSummary();

    } catch (error) {
      console.error(chalk.red('\n❌ Test failed with critical error:'), error);
      this.recordResult('CRITICAL_ERROR', false, 0, { error: error instanceof Error ? error.message : String(error) });
    } finally {
      // Cleanup
      await this.cleanup();
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
   * Step 2: Process Client
   */
  private async step2_ProcessClient(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n🏢 STEP 2: CLIENT PROCESSING'));
    console.log(chalk.gray('─'.repeat(50)));

    const client = (this as any).client;
    const runId = `test-run-${Date.now()}`;
    
    // Create effectiveness run
    const run = await storage.createEffectivenessRun({
      clientId,
      status: 'pending',
      overallScore: null
    });

    console.log(chalk.cyan(`Created run: ${run.id}`));

    try {
      // 2.1: Screenshot & HTML Retrieval
      await this.step2_1_DataCollection(client.websiteUrl, 'CLIENT');

      // 2.2: Tier 1 - Fast HTML Analysis
      await this.step2_2_Tier1Analysis(run.id, 'CLIENT');

      // 2.3: Tier 2 - AI-Powered Analysis
      await this.step2_3_Tier2Analysis(run.id, 'CLIENT');

      // 2.4: Tier 3 - External API Analysis
      await this.step2_4_Tier3Analysis(run.id, 'CLIENT');

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
   * Step 2.1: Data Collection (Screenshots & HTML)
   */
  private async step2_1_DataCollection(url: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  📸 2.1: Data Collection - ${entity}`));
    
    const config = await this.configManager.getConfig();
    const collectionStart = performance.now();

    try {
      // Collect all data in parallel
      const dataResult = await parallelDataCollector.collectAllData(url, config);
      
      // Above-the-fold screenshot
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

      // Full-page screenshot
      this.recordResult(`${entity}: Full-page Screenshot`,
        !!dataResult.fullPageScreenshotUrl && !dataResult.fullPageScreenshotError,
        performance.now() - collectionStart,
        {
          url: dataResult.fullPageScreenshotUrl,
          error: dataResult.fullPageScreenshotError
        },
        dataResult.fullPageScreenshotError ? this.classifyError(new Error(dataResult.fullPageScreenshotError)) : undefined
      );

      // Rendered HTML
      this.recordResult(`${entity}: Rendered HTML`,
        !!dataResult.renderedHtml,
        performance.now() - collectionStart,
        {
          length: dataResult.renderedHtml?.length || 0,
          error: dataResult.renderedHtmlError
        },
        dataResult.renderedHtmlError ? this.classifyError(new Error(dataResult.renderedHtmlError)) : undefined
      );

      // Raw HTML
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
      throw error;
    }
  }

  /**
   * Step 2.2: Tier 1 - Fast HTML Analysis
   */
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
        
        // Handle specific capitalizations for scorer functions
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
        
        // Save to database with screenshot URLs
        const dbSaveStart = performance.now();
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
          {
            score: result.score,
            dbWriteTime: performance.now() - dbSaveStart
          }
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

  /**
   * Step 2.3: Tier 2 - AI-Powered Analysis
   */
  private async step2_3_Tier2Analysis(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  🤖 2.3: Tier 2 AI Analysis - ${entity}`));
    
    const tier2Criteria = ['positioning', 'brand_story', 'ctas'];
    const dataResult = (this as any)[`${entity.toLowerCase()}Data`];
    const config = await this.configManager.getConfig();

    for (const criterion of tier2Criteria) {
      const criterionStart = performance.now();
      
      try {
        // Import and execute criterion scorer
        const fileName = criterion === 'brand_story' ? 'brandStory' : criterion;
        const scorerModule = await import(`./server/services/effectiveness/criteria/${fileName}.js`);
        
        // Handle specific capitalizations for scorer functions
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

        const aiRequestStart = performance.now();
        const result = await scorer(context, config, this.openai);
        const aiRequestTime = performance.now() - aiRequestStart;

        // Save to database with screenshot URLs
        const dbSaveStart = performance.now();
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
          {
            score: result.score,
            aiRequestTime,
            dbWriteTime: performance.now() - dbSaveStart,
            includedScreenshot: !!context.screenshot
          }
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

  /**
   * Step 2.4: Tier 3 - External API Analysis
   */
  private async step2_4_Tier3Analysis(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  🌐 2.4: Tier 3 External API Analysis - ${entity}`));
    
    const dataResult = (this as any)[`${entity.toLowerCase()}Data`];
    const config = await this.configManager.getConfig();
    const criterionStart = performance.now();

    try {
      // Import and execute speed scorer
      const scorerModule = await import('./server/services/effectiveness/criteria/speed.js');
      const scorer = scorerModule.scoreSpeed;
      
      const context = {
        websiteUrl: (this as any).client.websiteUrl,
        html: dataResult.renderedHtml || dataResult.initialHtml || '',
        screenshot: dataResult.screenshotUrl,
        fullPageScreenshot: dataResult.fullPageScreenshotUrl,
        webVitals: dataResult.webVitals
      };

      const apiRequestStart = performance.now();
      const result = await scorer(context, config, this.openai);
      const apiRequestTime = performance.now() - apiRequestStart;

      // Save to database with screenshot URLs
      const dbSaveStart = performance.now();
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
        {
          score: result.score,
          apiRequestTime,
          dbWriteTime: performance.now() - dbSaveStart,
          webVitals: dataResult.webVitals
        }
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

  /**
   * Step 2.5: Final Scoring
   */
  private async step2_5_FinalScoring(runId: string, entity: string): Promise<void> {
    console.log(chalk.bold.blue(`\n  📊 2.5: Final ${entity} Scoring`));
    
    const scoringStart = performance.now();

    try {
      // Get all criterion scores
      const scores = await storage.getCriterionScores(runId);
      
      // Calculate overall score
      const overallScore = scores.reduce((sum, s) => sum + parseFloat(s.score), 0) / scores.length;
      
      // Update run with final score
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
   * Step 3: Process Competitors
   */
  private async step3_ProcessCompetitors(clientId: string): Promise<void> {
    console.log(chalk.bold.yellow('\n🏆 STEP 3: COMPETITOR PROCESSING'));
    console.log(chalk.gray('─'.repeat(50)));

    const competitors = (this as any).competitors || [];
    const maxCompetitors = Math.min(3, competitors.length);

    for (let i = 0; i < maxCompetitors; i++) {
      const competitor = competitors[i];
      console.log(chalk.cyan(`\nProcessing competitor ${i + 1}/${maxCompetitors}: ${competitor.label || competitor.domain}`));

      // Create competitor run
      const run = await storage.createEffectivenessRun({
        clientId,
        competitorId: competitor.id,
        status: 'pending',
        overallScore: null
      });

      try {
        // Process competitor through all tiers (ensure URL has protocol)
        const competitorUrl = this.ensureProtocol(competitor.domain);
        await this.step2_1_DataCollection(competitorUrl, `COMPETITOR_${i + 1}`);
        await this.step2_2_Tier1Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_3_Tier2Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_4_Tier3Analysis(run.id, `COMPETITOR_${i + 1}`);
        await this.step2_5_FinalScoring(run.id, `COMPETITOR_${i + 1}`);

        // Record resource metrics after each competitor
        await this.recordResourceMetrics(`After Competitor ${i + 1}`);

        // Clean up browser after every 2 competitors
        if ((i + 1) % 2 === 0) {
          await this.recycleBrowser();
        }

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
      // Import insights service
      const { createInsightsService } = await import('./server/services/effectiveness/index.js');
      const insightsService = createInsightsService(storage);

      const aiRequestStart = performance.now();
      const insights = await insightsService.generateInsights(
        clientId,
        clientRunId,
        undefined,
        'Admin'
      );
      const aiRequestTime = performance.now() - aiRequestStart;

      // Update run with insights
      await storage.updateEffectivenessRun(clientRunId, {
        aiInsights: insights.insights,
        insightsGeneratedAt: new Date()
      });

      this.recordResult('AI Insights Generation',
        true,
        performance.now() - insightsStart,
        {
          aiRequestTime,
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
   * Step 5: Final Summary
   */
  private async step5_FinalSummary(): Promise<void> {
    console.log(chalk.bold.yellow('\n📈 STEP 5: FINAL SUMMARY'));
    console.log(chalk.gray('─'.repeat(50)));

    const totalDuration = (performance.now() - this.startTime) / 1000;
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.filter(r => !r.success).length;

    console.log('\n' + chalk.bold('Test Results:'));
    console.log(chalk.green(`  ✓ Successful steps: ${successCount}`));
    console.log(chalk.red(`  ✗ Failed steps: ${failureCount}`));
    console.log(chalk.blue(`  ⏱ Total duration: ${totalDuration.toFixed(2)}s`));
    console.log(chalk.yellow(`  📊 Final progress: ${this.currentProgress}%`));

    // Error classification summary
    const errorTypes = this.results
      .filter(r => !r.success && r.errorType)
      .reduce((acc, r) => {
        acc[r.errorType!] = (acc[r.errorType!] || 0) + 1;
        return acc;
      }, {} as Record<ErrorType, number>);

    if (Object.keys(errorTypes).length > 0) {
      console.log('\n' + chalk.bold('Error Classification:'));
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`  ${this.getErrorIcon(type as ErrorType)} ${type}: ${count}`);
      });
    }

    // Resource metrics summary
    if (this.resourceMetrics.length > 0) {
      console.log('\n' + chalk.bold('Resource Usage:'));
      const maxMemory = Math.max(...this.resourceMetrics.map(m => m.memoryUsageMB));
      const recycleCount = this.resourceMetrics.filter(m => m.browserRecycled).length;
      console.log(`  💾 Peak memory: ${maxMemory.toFixed(2)} MB`);
      console.log(`  ♻️  Browser recycled: ${recycleCount} times`);
    }

    // Detailed results table
    console.log('\n' + chalk.bold('Detailed Results:'));
    console.table(this.results.map(r => ({
      Step: r.step.substring(0, 40),
      Success: r.success ? '✓' : '✗',
      Duration: `${(r.duration / 1000).toFixed(2)}s`,
      Progress: r.progress ? `${r.progress}%` : '-',
      Error: r.errorType || '-'
    })));
  }

  /**
   * Helper: Record test result
   */
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

    // Print immediate feedback
    const icon = success ? chalk.green('✓') : chalk.red('✗');
    const timeStr = chalk.gray(`(${(duration / 1000).toFixed(2)}s)`);
    console.log(`  ${icon} ${step} ${timeStr}`);
    
    if (!success && details?.error) {
      console.log(chalk.red(`    → ${details.error}`));
    }
  }

  /**
   * Helper: Ensure URL has protocol
   */
  private ensureProtocol(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Helper: Update progress
   */
  private updateProgress(increment: number): void {
    this.currentProgress = Math.min(100, this.currentProgress + increment);
    console.log(chalk.dim(`    Progress: ${this.currentProgress}%`));
  }

  /**
   * Helper: Classify error type
   */
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

  /**
   * Helper: Get error icon
   */
  private getErrorIcon(type: ErrorType): string {
    const icons: Record<ErrorType, string> = {
      'network_timeout': '⏱️',
      'ai_api_error': '🤖',
      'browser_crash': '💥',
      'database_error': '🗄️',
      'parsing_error': '📝',
      'unknown': '❓'
    };
    return icons[type];
  }

  /**
   * Helper: Record resource metrics
   */
  private async recordResourceMetrics(checkpoint: string): Promise<void> {
    const memUsage = process.memoryUsage();
    const metrics: ResourceMetrics = {
      memoryUsageMB: memUsage.heapUsed / 1024 / 1024,
      browserPageCount: 0, // Will be set if browser is active
      browserRecycled: false,
      timestamp: new Date()
    };

    // Get browser metrics if available
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

  /**
   * Helper: Recycle browser
   */
  private async recycleBrowser(): Promise<void> {
    try {
      await screenshotService.cleanup();
      
      // Mark in metrics
      if (this.resourceMetrics.length > 0) {
        this.resourceMetrics[this.resourceMetrics.length - 1].browserRecycled = true;
      }
      
      console.log(chalk.cyan('    ♻️  Browser recycled'));
    } catch (error) {
      console.log(chalk.yellow('    ⚠️  Browser recycle failed'));
    }
  }

  /**
   * Cleanup
   */
  private async cleanup(): Promise<void> {
    try {
      await screenshotService.cleanup();
      console.log(chalk.dim('\n🧹 Cleanup completed'));
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Cleanup failed'));
    }
  }
}

// Main execution
async function main() {
  const clientId = process.argv[2];
  
  if (!clientId) {
    console.error(chalk.red('Error: Please provide a client ID'));
    console.log('Usage: npx tsx test_effectiveness_complete.ts [clientId]');
    process.exit(1);
  }

  const runner = new EffectivenessTestRunner();
  
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