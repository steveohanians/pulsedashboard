/**
 * Smart Timeout Management System
 * 
 * Prevents wasted effectiveness runs by:
 * 1. Progressive timeout warnings with early exit options
 * 2. Component-level timeout tracking with circuit breakers
 * 3. Run continuation from last successful checkpoint
 * 4. Intelligent timeout adjustment based on historical performance
 */

import logger from "../../utils/logging/logger";
import { storage } from "../../storage";

export interface TimeoutConfig {
  dataCollection: number;      // 120s max for parallel data collection (increased for S3 screenshots)
  tierOneAnalysis: number;     // 30s max for UX/Trust/Accessibility/SEO
  tierTwoAIAnalysis: number;   // 90s max for positioning/brand story/CTAs
  tierThreeExternalAPI: number; // 120s max for PageSpeed API
  insightGeneration: number;   // 60s max for AI insights
  totalRun: number;           // 600s (10 min) absolute maximum
}

export interface ComponentTimeout {
  componentName: string;
  startTime: number;
  timeoutMs: number;
  warningThreshold: number; // When to show warning (e.g., 80% of timeout)
  onWarning?: () => Promise<boolean>; // Return true to continue, false to abort
  onTimeout?: () => Promise<void>; // Cleanup function
}

export interface RunCheckpoint {
  runId: string;
  phase: 'data_collection' | 'tier_1' | 'tier_2' | 'tier_3' | 'insights' | 'complete';
  completedComponents: string[];
  partialResults?: any;
  timestamp: Date;
}

class SmartTimeoutManager {
  private static instance: SmartTimeoutManager;
  private activeTimeouts: Map<string, ComponentTimeout> = new Map();
  private runCheckpoints: Map<string, RunCheckpoint> = new Map();
  private defaultConfig: TimeoutConfig;
  private historicalPerformance: Map<string, number[]> = new Map();

  private constructor() {
    // ✅ UPDATED: Based on actual performance data from comprehensive testing
    this.defaultConfig = {
      dataCollection: 120000,     // 120s (increased for S3 screenshot processing: 95s screenshot + buffer)
      tierOneAnalysis: 5000,      // 5s (actual: 1-2s, very fast)
      tierTwoAIAnalysis: 40000,   // 40s (actual: 22-26s, OpenAI vision analysis)
      tierThreeExternalAPI: 45000, // 45s (actual: 29-33s, PageSpeed API)
      insightGeneration: 30000,   // 30s (AI insights generation)
      totalRun: 900000           // 15 minutes absolute max (was too low at 10min)
    };
  }

  public static getInstance(): SmartTimeoutManager {
    if (!SmartTimeoutManager.instance) {
      SmartTimeoutManager.instance = new SmartTimeoutManager();
    }
    return SmartTimeoutManager.instance;
  }

  /**
   * ✅ MAIN: Start a component with smart timeout management
   */
  public async startComponentTimeout(
    runId: string,
    componentName: string,
    phase: keyof TimeoutConfig,
    onWarning?: () => Promise<boolean>,
    onTimeout?: () => Promise<void>
  ): Promise<string> {
    
    const timeoutMs = this.getAdaptiveTimeout(componentName, phase);
    const warningThreshold = timeoutMs * 0.8; // 80% of timeout
    
    const timeoutId = `${runId}_${componentName}_${Date.now()}`;
    
    const componentTimeout: ComponentTimeout = {
      componentName,
      startTime: Date.now(),
      timeoutMs,
      warningThreshold,
      onWarning,
      onTimeout
    };
    
    this.activeTimeouts.set(timeoutId, componentTimeout);
    
    // Set warning timer
    setTimeout(async () => {
      await this.handleWarning(timeoutId, runId);
    }, warningThreshold);
    
    // Set timeout timer
    setTimeout(async () => {
      await this.handleTimeout(timeoutId, runId);
    }, timeoutMs);
    
    logger.info('Component timeout started', {
      runId,
      componentName,
      phase,
      timeoutMs,
      warningThreshold
    });
    
    return timeoutId;
  }

  /**
   * ✅ CHECKPOINT: Save progress checkpoint
   */
  public async saveCheckpoint(
    runId: string,
    phase: RunCheckpoint['phase'],
    completedComponents: string[],
    partialResults?: any
  ): Promise<void> {
    
    const checkpoint: RunCheckpoint = {
      runId,
      phase,
      completedComponents,
      partialResults,
      timestamp: new Date()
    };
    
    this.runCheckpoints.set(runId, checkpoint);
    
    // Persist checkpoint to database for recovery
    try {
      await storage.updateEffectivenessRun(runId, {
        progressDetail: JSON.stringify({
          checkpoint: {
            phase,
            completedComponents,
            timestamp: checkpoint.timestamp.toISOString(),
            partialResults: partialResults ? JSON.stringify(partialResults) : null
          }
        })
      });
      
      logger.info('Checkpoint saved', {
        runId,
        phase,
        completedComponents: completedComponents.length,
        hasPartialResults: !!partialResults
      });
      
    } catch (error) {
      logger.warn('Failed to persist checkpoint to database', {
        runId,
        phase,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ✅ RECOVERY: Check if run can continue from checkpoint
   */
  public async canContinueFromCheckpoint(runId: string): Promise<{
    canContinue: boolean;
    lastPhase?: RunCheckpoint['phase'];
    completedComponents?: string[];
    partialResults?: any;
  }> {
    
    try {
      const run = await storage.getEffectivenessRun(runId);
      
      if (!run || !run.progressDetail) {
        return { canContinue: false };
      }
      
      const progressDetail = JSON.parse(run.progressDetail);
      const checkpoint = progressDetail.checkpoint;
      
      if (!checkpoint) {
        return { canContinue: false };
      }
      
      // Check if checkpoint is recent (within 1 hour)
      const checkpointTime = new Date(checkpoint.timestamp);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (checkpointTime < hourAgo) {
        logger.info('Checkpoint too old, starting fresh', {
          runId,
          checkpointAge: Date.now() - checkpointTime.getTime()
        });
        return { canContinue: false };
      }
      
      return {
        canContinue: true,
        lastPhase: checkpoint.phase,
        completedComponents: checkpoint.completedComponents || [],
        partialResults: checkpoint.partialResults ? JSON.parse(checkpoint.partialResults) : undefined
      };
      
    } catch (error) {
      logger.warn('Failed to check checkpoint for continuation', {
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      return { canContinue: false };
    }
  }

  /**
   * ✅ COMPLETION: Mark component as completed
   */
  public async completeComponent(
    timeoutId: string,
    runId: string,
    duration: number,
    success: boolean = true
  ): Promise<void> {
    
    const componentTimeout = this.activeTimeouts.get(timeoutId);
    if (!componentTimeout) {
      return;
    }
    
    // Record performance for adaptive timeouts
    this.recordPerformance(componentTimeout.componentName, duration, success);
    
    this.activeTimeouts.delete(timeoutId);
    
    logger.info('Component completed', {
      runId,
      componentName: componentTimeout.componentName,
      duration,
      success,
      withinTimeout: duration < componentTimeout.timeoutMs
    });
  }

  /**
   * ✅ ADAPTIVE: Get timeout based on historical performance
   */
  private getAdaptiveTimeout(componentName: string, phase: keyof TimeoutConfig): number {
    const baseTimeout = this.defaultConfig[phase];
    const history = this.historicalPerformance.get(componentName);
    
    if (!history || history.length < 3) {
      return baseTimeout;
    }
    
    // Calculate 95th percentile of recent performance
    const sortedHistory = [...history].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedHistory.length * 0.95);
    const p95Duration = sortedHistory[p95Index];
    
    // Use 1.5x the 95th percentile, but cap at 2x base timeout
    const adaptiveTimeout = Math.min(p95Duration * 1.5, baseTimeout * 2);
    
    logger.debug('Adaptive timeout calculated', {
      componentName,
      phase,
      baseTimeout,
      p95Duration,
      adaptiveTimeout,
      historySamples: history.length
    });
    
    return adaptiveTimeout;
  }

  /**
   * ✅ WARNING: Handle timeout warning
   */
  private async handleWarning(timeoutId: string, runId: string): Promise<void> {
    const componentTimeout = this.activeTimeouts.get(timeoutId);
    if (!componentTimeout) {
      return;
    }
    
    const elapsed = Date.now() - componentTimeout.startTime;
    const remaining = componentTimeout.timeoutMs - elapsed;
    
    logger.warn('Component timeout warning', {
      runId,
      componentName: componentTimeout.componentName,
      elapsed,
      remaining,
      warningThreshold: componentTimeout.warningThreshold
    });
    
    // Call warning handler if provided
    if (componentTimeout.onWarning) {
      try {
        const shouldContinue = await componentTimeout.onWarning();
        if (!shouldContinue) {
          logger.info('Component aborted by warning handler', {
            runId,
            componentName: componentTimeout.componentName
          });
          await this.handleTimeout(timeoutId, runId);
        }
      } catch (error) {
        logger.error('Warning handler failed', {
          runId,
          componentName: componentTimeout.componentName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * ✅ TIMEOUT: Handle component timeout
   */
  private async handleTimeout(timeoutId: string, runId: string): Promise<void> {
    const componentTimeout = this.activeTimeouts.get(timeoutId);
    if (!componentTimeout) {
      return;
    }
    
    const elapsed = Date.now() - componentTimeout.startTime;
    
    logger.error('Component timeout exceeded', {
      runId,
      componentName: componentTimeout.componentName,
      elapsed,
      timeoutMs: componentTimeout.timeoutMs
    });
    
    // Call timeout handler if provided
    if (componentTimeout.onTimeout) {
      try {
        await componentTimeout.onTimeout();
      } catch (error) {
        logger.error('Timeout handler failed', {
          runId,
          componentName: componentTimeout.componentName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Record timeout for performance tracking
    this.recordPerformance(componentTimeout.componentName, elapsed, false);
    
    this.activeTimeouts.delete(timeoutId);
  }

  /**
   * ✅ PERFORMANCE: Record component performance for adaptive timeouts
   */
  private recordPerformance(componentName: string, duration: number, success: boolean): void {
    if (!this.historicalPerformance.has(componentName)) {
      this.historicalPerformance.set(componentName, []);
    }
    
    const history = this.historicalPerformance.get(componentName)!;
    
    // Only record successful completions for timeout calculation
    if (success) {
      history.push(duration);
      
      // Keep only last 20 samples
      if (history.length > 20) {
        history.shift();
      }
    }
  }

  /**
   * ✅ CLEANUP: Clean up all timeouts for a run
   */
  public cleanupRun(runId: string): void {
    const timeoutIds = Array.from(this.activeTimeouts.keys())
      .filter(id => id.startsWith(`${runId}_`));
    
    for (const timeoutId of timeoutIds) {
      this.activeTimeouts.delete(timeoutId);
    }
    
    this.runCheckpoints.delete(runId);
    
    logger.info('Cleaned up run timeouts', {
      runId,
      clearedTimeouts: timeoutIds.length
    });
  }

  /**
   * ✅ UTILITY: Create timeout promise wrapper
   */
  public createTimeoutPromise<T>(
    promise: Promise<T>,
    timeoutMs: number,
    componentName: string
  ): Promise<T> {
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${componentName} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * ✅ STATUS: Get current run status
   */
  public getRunStatus(runId: string): {
    activeComponents: string[];
    lastCheckpoint?: RunCheckpoint;
    totalElapsed: number;
  } {
    
    const activeComponents = Array.from(this.activeTimeouts.values())
      .filter(t => this.activeTimeouts.has(`${runId}_${t.componentName}_${t.startTime}`))
      .map(t => t.componentName);
    
    const lastCheckpoint = this.runCheckpoints.get(runId);
    const totalElapsed = lastCheckpoint 
      ? Date.now() - lastCheckpoint.timestamp.getTime()
      : 0;
    
    return {
      activeComponents,
      lastCheckpoint,
      totalElapsed
    };
  }
}

export const smartTimeoutManager = SmartTimeoutManager.getInstance();