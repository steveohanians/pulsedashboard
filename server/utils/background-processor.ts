import logger from './logging/logger';

// Background processing queue for heavy operations
interface ProcessingJob {
  id: string;
  type: 'AI_INSIGHT' | 'AI_INSIGHT_VERSIONED' | 'METRIC_AGGREGATION' | 'SCORING' | 'COMPETITOR_INTEGRATION';
  data: any;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: number;
  processor?: (job: any) => Promise<void>; // Custom processor function
}

class BackgroundProcessor {
  private queue: ProcessingJob[] = [];
  private retryQueue: ProcessingJob[] = [];
  private processing = false;
  private readonly MAX_CONCURRENT = 3;
  private activeJobs = 0;
  private storage: any; // Storage instance

  constructor(storage?: any) {
    this.storage = storage;
  }

  // Add job to background processing queue
  enqueue(type: ProcessingJob['type'], data: any, priority?: number): string;
  enqueue(jobConfig: { id: string; type: ProcessingJob['type']; data: any; processor?: (job: any) => Promise<void>; priority?: number }): string;
  enqueue(typeOrConfig: ProcessingJob['type'] | { id: string; type: ProcessingJob['type']; data: any; processor?: (job: any) => Promise<void>; priority?: number }, data?: any, priority = 1): string {
    let job: ProcessingJob;
    
    if (typeof typeOrConfig === 'string') {
      // Legacy signature: enqueue(type, data, priority)
      const jobId = `${typeOrConfig}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      job = {
        id: jobId,
        type: typeOrConfig,
        data,
        priority,
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now()
      };
    } else {
      // New signature: enqueue({ id, type, data, processor })
      job = {
        id: typeOrConfig.id,
        type: typeOrConfig.type,
        data: typeOrConfig.data,
        priority: typeOrConfig.priority || 1,
        retries: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        processor: typeOrConfig.processor
      };
    }

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    logger.info(`Background job enqueued: ${job.id} (${job.type})`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
    
    return job.id;
  }

  private async startProcessing(): Promise<void> {
    if (this.processing || this.activeJobs >= this.MAX_CONCURRENT) return;
    
    this.processing = true;
    
    while ((this.retryQueue.length > 0 || this.queue.length > 0) && this.activeJobs < this.MAX_CONCURRENT) {
      // Process retries first, then regular queue
      const job = this.retryQueue.shift() || this.queue.shift();
      if (!job) break;
      
      this.activeJobs++;
      this.processJob(job).finally(() => {
        this.activeJobs--;
        if (this.queue.length === 0 && this.retryQueue.length === 0 && this.activeJobs === 0) {
          this.processing = false;
        }
      });
    }
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    try {
      logger.info(`Processing background job: ${job.id} (${job.type})`);
      
      switch (job.type) {
        case 'AI_INSIGHT':
          await this.processAIInsight(job.data);
          break;
        case 'AI_INSIGHT_VERSIONED':
          await this.processVersionedAIInsight(job.data);
          break;
        case 'METRIC_AGGREGATION':
          await this.processMetricAggregation(job.data);
          break;
        case 'SCORING':
          await this.processScoring(job.data);
          break;
        case 'COMPETITOR_INTEGRATION':
          if (job.processor) {
            await job.processor(job);
          } else {
            logger.error(`No processor function provided for COMPETITOR_INTEGRATION job: ${job.id}`);
          }
          break;
      }
      
      logger.info(`Completed background job: ${job.id}`);
    } catch (error) {
      logger.error(`Background job failed: ${job.id}`, { error, job });
      
      // Atomically increment retries and check if should retry
      const currentRetries = ++job.retries;
      
      if (currentRetries <= job.maxRetries) {
        job.priority = Math.max(1, job.priority - 1); // Lower priority on retry
        this.retryQueue.push(job); // Add to retry queue instead of main queue
        this.retryQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
        logger.info(`Retrying background job: ${job.id} (attempt ${currentRetries})`);
      } else {
        logger.error(`Background job failed permanently: ${job.id}`);
      }
    }
  }

  private async processAIInsight(data: any): Promise<void> {
    // Process AI insight generation in background
    const { clientId, metricName, metricData } = data;
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info(`AI insight processed for ${clientId}:${metricName}`);
  }

  private async processVersionedAIInsight(data: any): Promise<void> {
    // Process versioned AI insight generation
    const { clientId, timePeriod, version, forceRegenerate = false, reason = null } = data;
    
    try {
      logger.info(`Processing versioned AI insights for client ${clientId}, period ${timePeriod}, version ${version}`, {
        forceRegenerate,
        reason
      });

      // Import versioning service
      const { MetricVersionService } = await import('../services/metricVersioning.js');
      const versionService = new MetricVersionService(this.storage);

      // Check if insights already exist for this version (unless forcing regeneration)
      if (!forceRegenerate) {
        const existingInsights = await this.storage.getAIInsightsByVersion(clientId, timePeriod, version);
        if (existingInsights.length > 0) {
          logger.info(`Insights already exist for version ${version}, skipping generation`, {
            clientId,
            timePeriod,
            insightCount: existingInsights.length
          });
          return;
        }
      }

      // Get metrics for this client and time period
      const metrics = await this.storage.getMetricsByClient(clientId, timePeriod);
      
      if (metrics.length === 0) {
        logger.warn(`No metrics found for client ${clientId} and period ${timePeriod}`);
        return;
      }

      // For now, skip AI generation as the utility doesn't exist yet
      // TODO: Implement actual AI insight generation
      logger.info('Skipping AI generation until utility is implemented');
      
      // Generate insights for each unique metric
      const metricNames = metrics.map((m: any) => m.metricName);
      const uniqueMetrics = Array.from(new Set(metricNames));
      const generatedInsights = [];

      for (const metricName of uniqueMetrics) {
        try {
          // Get metric data for this specific metric
          const metricData = metrics.filter((m: any) => m.metricName === metricName);
          
          // TODO: Replace with actual AI insight generation
          const mockInsight = {
            context: `Analysis of ${metricName} data`,
            insight: `Generated insight for ${metricName}`,
            recommendation: `Recommendation for improving ${metricName}`
          };

          // Store the versioned insight
          const insight = await this.storage.createAIInsight({
            clientId,
            metricName,
            timePeriod,
            version, // Include version number
            contextText: mockInsight.context,
            insightText: mockInsight.insight,
            recommendationText: mockInsight.recommendation,
            status: 'success'
          });

          generatedInsights.push(insight);
          
          logger.debug(`Generated versioned insight for ${metricName}`, {
            clientId,
            timePeriod,
            version,
            insightId: insight.id
          });
        } catch (metricError) {
          logger.error(`Error generating versioned insight for ${metricName}`, {
            error: metricError instanceof Error ? metricError.message : String(metricError),
            clientId,
            timePeriod,
            version,
            metricName
          });
        }
      }

      // Clean up old versions (keep only latest 3)
      await versionService.cleanupOldVersions(clientId, timePeriod);

      logger.info(`Completed versioned AI insight generation`, {
        clientId,
        timePeriod,
        version,
        generatedCount: generatedInsights.length,
        totalMetrics: uniqueMetrics.length
      });

    } catch (error) {
      logger.error(`Error processing versioned AI insights`, {
        error: error instanceof Error ? error.message : String(error),
        clientId,
        timePeriod,
        version
      });
      throw error;
    }
  }

  private async processMetricAggregation(data: any): Promise<void> {
    // Process metric aggregation/scoring in background
    const { metrics, filters } = data;
    
    // Simulate heavy computation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    logger.info(`Metric aggregation processed for ${filters.businessSize}:${filters.industryVertical}`);
  }

  private async processScoring(data: any): Promise<void> {
    // Process scoring calculations in background
    const { clientMetrics, benchmarkMetrics } = data;
    
    // Simulate scoring computation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    logger.info('Scoring calculation completed');
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      retryQueueLength: this.retryQueue.length,
      activeJobs: this.activeJobs,
      processing: this.processing,
      jobs: this.queue.map(job => ({
        id: job.id,
        type: job.type,
        priority: job.priority,
        retries: job.retries,
        age: Date.now() - job.createdAt
      })),
      retryJobs: this.retryQueue.map(job => ({
        id: job.id,
        type: job.type,
        priority: job.priority,
        retries: job.retries,
        age: Date.now() - job.createdAt
      }))
    };
  }

  // Clear queue (for testing/debugging)
  clearQueue(): void {
    this.queue = [];
    this.retryQueue = [];
    logger.info('Background processing queue and retry queue cleared');
  }
}

// Export the class for initialization with storage
export { BackgroundProcessor };

// Create default instance for backward compatibility (without storage)
export const backgroundProcessor = new BackgroundProcessor();