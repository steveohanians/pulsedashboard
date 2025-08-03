import logger from './logger';

// Background processing queue for heavy operations
interface ProcessingJob {
  id: string;
  type: 'AI_INSIGHT' | 'METRIC_AGGREGATION' | 'SCORING';
  data: any;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: number;
}

class BackgroundProcessor {
  private queue: ProcessingJob[] = [];
  private processing = false;
  private readonly MAX_CONCURRENT = 3;
  private activeJobs = 0;

  // Add job to background processing queue
  enqueue(type: ProcessingJob['type'], data: any, priority = 1): string {
    const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ProcessingJob = {
      id: jobId,
      type,
      data,
      priority,
      retries: 0,
      maxRetries: 3,
      createdAt: Date.now()
    };

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    logger.info(`Background job enqueued: ${jobId} (${type})`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
    
    return jobId;
  }

  private async startProcessing(): Promise<void> {
    if (this.processing || this.activeJobs >= this.MAX_CONCURRENT) return;
    
    this.processing = true;
    
    while (this.queue.length > 0 && this.activeJobs < this.MAX_CONCURRENT) {
      const job = this.queue.shift();
      if (!job) break;
      
      this.activeJobs++;
      this.processJob(job).finally(() => {
        this.activeJobs--;
        if (this.queue.length === 0 && this.activeJobs === 0) {
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
        case 'METRIC_AGGREGATION':
          await this.processMetricAggregation(job.data);
          break;
        case 'SCORING':
          await this.processScoring(job.data);
          break;
      }
      
      logger.info(`Completed background job: ${job.id}`);
    } catch (error) {
      logger.error(`Background job failed: ${job.id}`, { error, job });
      
      if (job.retries < job.maxRetries) {
        job.retries++;
        job.priority = Math.max(1, job.priority - 1); // Lower priority on retry
        this.queue.unshift(job); // Add back to front for retry
        logger.info(`Retrying background job: ${job.id} (attempt ${job.retries})`);
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
      activeJobs: this.activeJobs,
      processing: this.processing,
      jobs: this.queue.map(job => ({
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
    logger.info('Background processing queue cleared');
  }
}

export const backgroundProcessor = new BackgroundProcessor();