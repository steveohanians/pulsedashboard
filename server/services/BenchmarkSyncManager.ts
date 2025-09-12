/**
 * BenchmarkSyncManager - Core service for managing sync state tracking
 * 
 * Handles persistent sync state tracking, progress updates, SSE broadcasting,
 * and recovery across server restarts for benchmark company SEMrush integration.
 */

import { eq, and, inArray, isNull, or } from 'drizzle-orm';
import { storage } from '../storage';
import { sseEventEmitter } from './sse/sseEventEmitter';
import logger from '../utils/logging/logger';
import type { IStorage } from '../storage';
import type {
  BenchmarkSyncJob,
  InsertBenchmarkSyncJob,
  UpdateBenchmarkSyncJob,
  BenchmarkCompany,
  UpdateBenchmarkCompany
} from '@shared/schema';

export interface SyncProgress {
  totalCompanies: number;
  processedCompanies: number;
  failedCompanies: number;
  currentCompanyId?: string;
  currentCompanyName?: string;
  overallPercent: number;
  estimatedCompletionAt?: Date;
  startedAt: Date;
}

export interface SyncJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'cancelled';
  totalCompanies: number;
  processedCompanies: number;
  failedCompanies: number;
  errors: string[];
  duration: number;
}

export interface BenchmarkSyncProgressData {
  jobId: string;
  jobType: 'individual' | 'bulk' | 'incremental';
  overallPercent: number;
  totalCompanies: number;
  processedCompanies: number;
  failedCompanies: number;
  currentCompanyId?: string;
  currentCompanyName?: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
  currentPhase: 'initializing' | 'syncing' | 'completing' | 'completed';
  message: string;
  timestamp: string;
}

export class BenchmarkSyncManager {
  private activeJobs = new Map<string, BenchmarkSyncJob>();
  private jobStartTimes = new Map<string, Date>();
  
  constructor(private storage: IStorage) {}

  /**
   * Initialize the sync manager and recover any interrupted jobs
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing BenchmarkSyncManager');
    
    try {
      // Find any jobs that were interrupted during server restart
      const interruptedJobs = await this.storage.getBenchmarkSyncJobs({
        status: ['processing', 'queued']
      });

      if (interruptedJobs.length > 0) {
        logger.info(`Found ${interruptedJobs.length} interrupted sync jobs, marking as failed`, {
          jobs: interruptedJobs.map(job => ({ id: job.id, type: job.jobType, status: job.status }))
        });

        // Mark interrupted jobs as failed and update company statuses
        for (const job of interruptedJobs) {
          await this.failSyncJob(job.id, 'Server restart interrupted sync job');
        }
      }

      // Reset any companies stuck in "processing" state
      await this.resetProcessingCompanies();
      
      logger.info('BenchmarkSyncManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize BenchmarkSyncManager', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Create a new sync job
   */
  public async createSyncJob(params: {
    jobType: 'individual' | 'bulk' | 'incremental';
    companyIds?: string[];
    incrementalSync?: boolean;
    initiatedByUserId?: string;
  }): Promise<string> {
    try {
      const { jobType, companyIds, incrementalSync = false, initiatedByUserId } = params;

      // Determine companies to sync
      let targetCompanies: BenchmarkCompany[] = [];
      if (companyIds && companyIds.length > 0) {
        targetCompanies = await this.storage.getBenchmarkCompaniesByIds(companyIds);
      } else if (jobType === 'bulk') {
        targetCompanies = await this.storage.getBenchmarkCompanies();
        // Only sync active companies
        targetCompanies = targetCompanies.filter(c => c.active);
      }

      if (targetCompanies.length === 0) {
        throw new Error('No companies found to sync');
      }

      // Create the sync job
      const jobData: InsertBenchmarkSyncJob = {
        jobType,
        status: 'pending',
        totalCompanies: targetCompanies.length,
        processedCompanies: 0,
        failedCompanies: 0,
        companyIds: targetCompanies.map(c => c.id),
        incrementalSync,
        initiatedByUserId,
        progressLog: [],
        errorMessages: [],
        successfulResults: []
      };

      const jobId = await this.storage.createBenchmarkSyncJob(jobData);
      
      logger.info('Created benchmark sync job', {
        jobId,
        jobType,
        totalCompanies: targetCompanies.length,
        incrementalSync,
        companyNames: targetCompanies.map(c => c.name)
      });

      return jobId;
    } catch (error) {
      logger.error('Failed to create sync job', {
        error: (error as Error).message,
        params
      });
      throw error;
    }
  }

  /**
   * Start a sync job
   */
  public async startSyncJob(jobId: string): Promise<void> {
    try {
      const job = await this.storage.getBenchmarkSyncJobById(jobId);
      if (!job) {
        throw new Error(`Sync job ${jobId} not found`);
      }

      if (job.status !== 'pending') {
        throw new Error(`Cannot start job ${jobId} with status ${job.status}`);
      }

      // Update job status to processing
      await this.storage.updateBenchmarkSyncJob(jobId, {
        status: 'processing',
        startedAt: new Date()
      });

      // Store in active jobs
      this.activeJobs.set(jobId, { ...job, status: 'processing', startedAt: new Date() });
      this.jobStartTimes.set(jobId, new Date());

      // Update company statuses to processing
      if (job.companyIds) {
        await this.updateCompanyStatuses(job.companyIds, 'processing');
      }

      logger.info('Started sync job', { jobId, jobType: job.jobType, totalCompanies: job.totalCompanies });

      // Broadcast initial progress
      await this.broadcastProgress(jobId, {
        currentPhase: 'initializing',
        message: `Starting ${job.jobType} sync for ${job.totalCompanies} companies`
      });

    } catch (error) {
      logger.error('Failed to start sync job', {
        jobId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update sync job progress
   */
  public async updateSyncProgress(jobId: string, updates: {
    processedCompanies?: number;
    failedCompanies?: number;
    currentCompanyId?: string;
    currentCompanyName?: string;
    message?: string;
    phase?: 'initializing' | 'syncing' | 'completing' | 'completed';
  }): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) {
        logger.warn(`Cannot update progress for inactive job ${jobId}`);
        return;
      }

      // Calculate progress
      const processedCompanies = updates.processedCompanies ?? job.processedCompanies;
      const failedCompanies = updates.failedCompanies ?? job.failedCompanies;
      const overallPercent = Math.round((processedCompanies / job.totalCompanies) * 100);

      // Update database
      const updateData: UpdateBenchmarkSyncJob = {
        processedCompanies,
        failedCompanies,
        currentCompanyId: updates.currentCompanyId,
        currentCompanyName: updates.currentCompanyName,
        updatedAt: new Date()
      };

      // Calculate estimated completion
      if (processedCompanies > 0) {
        const startTime = this.jobStartTimes.get(jobId);
        if (startTime) {
          const elapsed = Date.now() - startTime.getTime();
          const avgTimePerCompany = elapsed / processedCompanies;
          const remainingCompanies = job.totalCompanies - processedCompanies;
          const estimatedRemainingMs = avgTimePerCompany * remainingCompanies;
          updateData.estimatedCompletionAt = new Date(Date.now() + estimatedRemainingMs);
        }
      }

      await this.storage.updateBenchmarkSyncJob(jobId, updateData);

      // Update active job
      Object.assign(job, updateData);

      // Broadcast progress
      await this.broadcastProgress(jobId, {
        currentPhase: updates.phase || 'syncing',
        message: updates.message || `Processing company ${processedCompanies + 1} of ${job.totalCompanies}`
      });

      logger.debug('Updated sync job progress', {
        jobId,
        processedCompanies,
        totalCompanies: job.totalCompanies,
        overallPercent,
        currentCompanyName: updates.currentCompanyName
      });

    } catch (error) {
      logger.error('Failed to update sync progress', {
        jobId,
        error: (error as Error).message,
        updates
      });
    }
  }

  /**
   * Record successful company sync
   */
  public async recordCompanySuccess(jobId: string, companyId: string, result: any): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) return;

      // Update company status
      await this.storage.updateBenchmarkCompany(companyId, {
        syncStatus: 'completed',
        lastSyncCompleted: new Date()
      });

      // Add to successful results
      const successfulResults = Array.isArray(job.successfulResults) ? job.successfulResults : [];
      successfulResults.push({
        companyId,
        timestamp: new Date().toISOString(),
        metricsStored: result.metricsStored || 0,
        periodsProcessed: result.periodsProcessed || 0
      });

      await this.storage.updateBenchmarkSyncJob(jobId, {
        processedCompanies: job.processedCompanies + 1,
        successfulResults
      });

      // Update active job
      job.processedCompanies += 1;
      job.successfulResults = successfulResults;

      logger.info('Recorded company sync success', {
        jobId,
        companyId,
        processedCompanies: job.processedCompanies,
        totalCompanies: job.totalCompanies
      });

    } catch (error) {
      logger.error('Failed to record company success', {
        jobId,
        companyId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Record failed company sync
   */
  public async recordCompanyFailure(jobId: string, companyId: string, error: string): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) return;

      // Update company status
      await this.storage.updateBenchmarkCompany(companyId, {
        syncStatus: 'failed',
        lastSyncAttempt: new Date()
      });

      // Add to error messages
      const errorMessages = Array.isArray(job.errorMessages) ? job.errorMessages : [];
      errorMessages.push({
        companyId,
        timestamp: new Date().toISOString(),
        error
      });

      await this.storage.updateBenchmarkSyncJob(jobId, {
        processedCompanies: job.processedCompanies + 1,
        failedCompanies: job.failedCompanies + 1,
        errorMessages
      });

      // Update active job
      job.processedCompanies += 1;
      job.failedCompanies += 1;
      job.errorMessages = errorMessages;

      logger.warn('Recorded company sync failure', {
        jobId,
        companyId,
        error,
        failedCompanies: job.failedCompanies
      });

    } catch (error) {
      logger.error('Failed to record company failure', {
        jobId,
        companyId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Complete a sync job
   */
  public async completeSyncJob(jobId: string): Promise<SyncJobResult> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) {
        throw new Error(`Cannot complete inactive job ${jobId}`);
      }

      const startTime = this.jobStartTimes.get(jobId);
      const duration = startTime ? Date.now() - startTime.getTime() : 0;

      // Update job status
      await this.storage.updateBenchmarkSyncJob(jobId, {
        status: 'completed',
        completedAt: new Date()
      });

      // Broadcast completion
      await this.broadcastProgress(jobId, {
        currentPhase: 'completed',
        message: `Sync completed: ${job.processedCompanies - job.failedCompanies}/${job.totalCompanies} companies successful`
      });

      // Clean up
      this.activeJobs.delete(jobId);
      this.jobStartTimes.delete(jobId);

      const result: SyncJobResult = {
        jobId,
        status: 'completed',
        totalCompanies: job.totalCompanies,
        processedCompanies: job.processedCompanies,
        failedCompanies: job.failedCompanies,
        errors: Array.isArray(job.errorMessages) ? job.errorMessages.map((e: any) => e.error) : [],
        duration
      };

      logger.info('Completed sync job', {
        jobId,
        ...result,
        durationMinutes: Math.round(duration / 60000)
      });

      return result;

    } catch (error) {
      logger.error('Failed to complete sync job', {
        jobId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Fail a sync job
   */
  public async failSyncJob(jobId: string, reason: string): Promise<void> {
    try {
      // Update job status
      await this.storage.updateBenchmarkSyncJob(jobId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessages: [{ timestamp: new Date().toISOString(), error: reason }]
      });

      // Reset any companies that were being processed
      const job = await this.storage.getBenchmarkSyncJobById(jobId);
      if (job?.companyIds) {
        await this.updateCompanyStatuses(job.companyIds, 'pending');
      }

      // Broadcast failure
      await this.broadcastJobError(jobId, reason);

      // Clean up
      this.activeJobs.delete(jobId);
      this.jobStartTimes.delete(jobId);

      logger.error('Failed sync job', { jobId, reason });

    } catch (error) {
      logger.error('Failed to fail sync job', {
        jobId,
        reason,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get current sync status
   */
  public async getSyncStatus(): Promise<{
    activeJobs: BenchmarkSyncJob[];
    recentJobs: BenchmarkSyncJob[];
    companySyncStatus: Array<{
      companyId: string;
      companyName: string;
      syncStatus: string;
      lastSyncAttempt?: Date | null;
      lastSyncCompleted?: Date | null;
    }>;
  }> {
    try {
      // Get active jobs
      const activeJobs = await this.storage.getBenchmarkSyncJobs({
        status: ['processing', 'queued']
      });

      // Get recent jobs (last 10)
      const recentJobs = await this.storage.getBenchmarkSyncJobs({
        limit: 10,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      });

      // Get company sync status
      const companies = await this.storage.getBenchmarkCompanies();
      const companySyncStatus = companies.map(company => ({
        companyId: company.id,
        companyName: company.name,
        syncStatus: company.syncStatus,
        lastSyncAttempt: company.lastSyncAttempt,
        lastSyncCompleted: company.lastSyncCompleted
      }));

      return {
        activeJobs,
        recentJobs,
        companySyncStatus
      };

    } catch (error) {
      logger.error('Failed to get sync status', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Broadcast progress update via SSE
   */
  private async broadcastProgress(jobId: string, updates: {
    currentPhase?: 'initializing' | 'syncing' | 'completing' | 'completed';
    message?: string;
  }): Promise<void> {
    try {
      const job = this.activeJobs.get(jobId);
      if (!job) return;

      const startTime = this.jobStartTimes.get(jobId);
      const timeElapsed = startTime ? Date.now() - startTime.getTime() : 0;
      const overallPercent = Math.round((job.processedCompanies / job.totalCompanies) * 100);

      // Calculate estimated time remaining
      let estimatedTimeRemaining: number | undefined;
      if (job.processedCompanies > 0 && startTime) {
        const avgTimePerCompany = timeElapsed / job.processedCompanies;
        const remainingCompanies = job.totalCompanies - job.processedCompanies;
        estimatedTimeRemaining = Math.round(avgTimePerCompany * remainingCompanies);
      }

      const progressData: BenchmarkSyncProgressData = {
        jobId,
        jobType: job.jobType as 'individual' | 'bulk' | 'incremental',
        overallPercent,
        totalCompanies: job.totalCompanies,
        processedCompanies: job.processedCompanies,
        failedCompanies: job.failedCompanies,
        currentCompanyId: job.currentCompanyId,
        currentCompanyName: job.currentCompanyName,
        timeElapsed,
        estimatedTimeRemaining,
        currentPhase: updates.currentPhase || 'syncing',
        message: updates.message || `Processing ${job.processedCompanies + 1} of ${job.totalCompanies} companies`,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all connected clients (using 'admin' as clientId for admin operations)
      sseEventEmitter.emit('benchmark-progress', progressData);

      logger.debug('Broadcast sync progress', {
        jobId,
        overallPercent,
        currentPhase: progressData.currentPhase
      });

    } catch (error) {
      logger.error('Failed to broadcast progress', {
        jobId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Broadcast job error via SSE
   */
  private async broadcastJobError(jobId: string, error: string): Promise<void> {
    try {
      sseEventEmitter.emit('benchmark-error', {
        jobId,
        error,
        timestamp: new Date().toISOString()
      });

      logger.debug('Broadcast sync error', { jobId, error });
    } catch (err) {
      logger.error('Failed to broadcast error', {
        jobId,
        error,
        broadcastError: (err as Error).message
      });
    }
  }

  /**
   * Update multiple companies' sync status
   */
  private async updateCompanyStatuses(companyIds: string[], status: 'pending' | 'processing' | 'completed' | 'failed'): Promise<void> {
    try {
      const updates: UpdateBenchmarkCompany = {
        syncStatus: status,
        lastSyncAttempt: ['processing', 'failed'].includes(status) ? new Date() : undefined
      };

      await this.storage.updateBenchmarkCompanies(companyIds, updates);

      logger.debug('Updated company statuses', {
        companyCount: companyIds.length,
        status
      });

    } catch (error) {
      logger.error('Failed to update company statuses', {
        companyIds,
        status,
        error: (error as Error).message
      });
    }
  }

  /**
   * Reset companies stuck in processing state
   */
  private async resetProcessingCompanies(): Promise<void> {
    try {
      const processingCompanies = await this.storage.getBenchmarkCompanies({
        syncStatus: 'processing'
      });

      if (processingCompanies.length > 0) {
        logger.info(`Resetting ${processingCompanies.length} companies stuck in processing state`);
        
        const companyIds = processingCompanies.map(c => c.id);
        await this.updateCompanyStatuses(companyIds, 'pending');
      }
    } catch (error) {
      logger.error('Failed to reset processing companies', {
        error: (error as Error).message
      });
    }
  }
}

// Singleton instance
export const benchmarkSyncManager = new BenchmarkSyncManager(storage);