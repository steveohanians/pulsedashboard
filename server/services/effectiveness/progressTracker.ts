/**
 * Time-Aware Progress Tracking System
 * 
 * Single source of truth for all effectiveness scoring progress tracking.
 * Provides accurate time estimates, smooth progress updates, and user-friendly messages.
 */

import logger from '../../utils/logging/logger';
import { sseEventEmitter } from '../sse/sseEventEmitter';

export interface ProgressState {
  // Overall progress
  overallPercent: number;
  timeElapsed: number;
  timeRemaining: number;
  
  // Current state
  currentPhase: 'initializing' | 'client' | 'competitors' | 'insights' | 'completed';
  currentEntity: string;
  currentOperation: string;
  
  // Completion tracking
  clientComplete: boolean;
  competitorsComplete: number;
  competitorsTotal: number;
  criteriaComplete: number;
  criteriaTotal: number;
  
  // User-friendly message
  message: string;
  pace: 'faster' | 'normal' | 'slower';
}

export class ProgressTracker {
  private startTime: number;
  private state: ProgressState;
  private totalSteps: number = 0;
  private completedSteps: number = 0;
  private steps: Map<string, boolean> = new Map();
  private clientId: string = '';
  private clientName: string = ''; // Store client name for display
  private competitorDomains: Map<number, string> = new Map(); // Map competitor indices to domains
  
  // Historical timing data for time estimates
  private historicalAverages = {
    screenshot: 16000,      // 16s for screenshots
    tier1Total: 1600,       // 1.6s per Tier 1 criterion (HTML analysis)
    tier2Total: 3000,       // 3s per Tier 2 criterion (AI analysis)
    pageSpeed: 70000,       // 70s for PageSpeed API
    insights: 8000,         // 8s for insights generation
    competitorTotal: 90000  // 90s per competitor (full analysis)
  };
  
  // Step types for clearer tracking
  private readonly DATA_COLLECTION_STEPS = ['initial_html', 'screenshot', 'fullpage_screenshot', 'rendered_html', 'web_vitals'];
  private readonly CRITERIA_STEPS = 8; // Total criteria per entity

  constructor(clientId?: string) {
    this.startTime = Date.now();
    this.clientId = clientId || '';
    this.state = {
      overallPercent: 0,
      timeElapsed: 0,
      timeRemaining: 120000, // 2 min initial estimate
      currentPhase: 'initializing',
      currentEntity: '',
      currentOperation: 'Starting analysis',
      clientComplete: false,
      competitorsComplete: 0,
      competitorsTotal: 0,
      criteriaComplete: 0,
      criteriaTotal: 8,
      message: 'Starting analysis (typically 2-3 minutes)',
      pace: 'normal'
    };
  }

  setTotalSteps(clientCount: number = 1, competitorCount: number = 0): void {
    // Each entity has: 5 data collection steps + 8 criteria = 13 steps
    const stepsPerEntity = this.DATA_COLLECTION_STEPS.length + this.CRITERIA_STEPS;
    this.totalSteps = (clientCount + competitorCount) * stepsPerEntity + 1; // +1 for insights
    
    this.state.competitorsTotal = competitorCount;
    
    logger.info('Progress tracker: total steps calculated', {
      clientCount,
      competitorCount, 
      stepsPerEntity,
      totalSteps: this.totalSteps
    });
    
    this.recalculate();
  }

  /**
   * Register competitor domain for display purposes
   */
  setCompetitorDomain(index: number, domain: string): void {
    this.competitorDomains.set(index, domain);
    logger.debug('Progress tracker: competitor domain registered', {
      index,
      domain
    });
  }

  markStepComplete(stepId: string): void {
    if (!this.steps.has(stepId)) {
      this.steps.set(stepId, true);
      this.completedSteps++;
      this.state.overallPercent = Math.round((this.completedSteps / this.totalSteps) * 100);
      
      logger.info('Progress step completed', {
        stepId,
        completed: this.completedSteps,
        total: this.totalSteps,
        percent: this.state.overallPercent
      });
      
      this.updateCurrentOperation(stepId);
      this.recalculate();
    }
  }

  /**
   * Capitalize criterion names properly for display
   */
  private capitalizeCriterion(criterion: string): string {
    const criterionMap: { [key: string]: string } = {
      'seo': 'SEO',
      'ctas': 'CTA', 
      'ux': 'UX',
      'trust': 'Trust',
      'speed': 'Speed',
      'accessibility': 'Accessibility',
      'positioning': 'Positioning',
      'brand_story': 'Brand Story'
    };
    
    return criterionMap[criterion] || criterion;
  }

  /**
   * Get display-friendly entity name (convert competitor IDs to domains)
   */
  private getEntityDisplayName(entityId: string): string {
    if (entityId === 'client') {
      return this.clientName || 'client';
    }
    
    // Handle competitor_N format by extracting index and looking up domain
    if (entityId.startsWith('competitor_')) {
      const indexStr = entityId.replace('competitor_', '');
      const index = parseInt(indexStr, 10);
      
      if (!isNaN(index) && this.competitorDomains.has(index)) {
        return this.competitorDomains.get(index)!;
      }
      
      // Fallback to generic competitor name
      return `competitor ${index + 1}`;
    }
    
    return entityId;
  }

  private updateCurrentOperation(stepId: string): void {
    // Handle competitor step IDs like "competitor_0_seo" correctly
    let entityId: string;
    let step: string;
    
    if (stepId.startsWith('competitor_')) {
      // For competitor steps, find the last underscore to split correctly
      const lastUnderscoreIndex = stepId.lastIndexOf('_');
      if (lastUnderscoreIndex > 'competitor_'.length - 1) {
        entityId = stepId.substring(0, lastUnderscoreIndex);
        step = stepId.substring(lastUnderscoreIndex + 1);
      } else {
        // Fallback to original logic
        [entityId, step] = stepId.split('_', 2);
      }
    } else {
      // For client or other steps, use original logic
      [entityId, step] = stepId.split('_', 2);
    }
    
    const displayEntity = this.getEntityDisplayName(entityId);
    
    if (step === 'insights') {
      this.state.currentOperation = 'Generating insights';
      this.state.currentPhase = 'insights';
    } else if (this.DATA_COLLECTION_STEPS.includes(step)) {
      this.state.currentOperation = `Collecting data from ${displayEntity}`;
      this.state.currentPhase = entityId === 'client' ? 'client' : 'competitors';
      this.state.currentEntity = entityId;
    } else {
      // It's a criterion - capitalize it properly
      const displayCriterion = this.capitalizeCriterion(step);
      this.state.currentOperation = `Analyzing ${displayCriterion} for ${displayEntity}`;
      this.state.currentPhase = entityId === 'client' ? 'client' : 'competitors';  
      this.state.currentEntity = entityId;
    }
  }

  // Legacy methods for backward compatibility - now delegate to step-based system
  
  setCompetitorCount(count: number): void {
    // Delegate to the new setTotalSteps method
    this.setTotalSteps(1, count);
  }

  startClient(clientName: string): void {
    // Store client name for display
    this.clientName = clientName;
    // Step-based system handles this through markStepComplete
    this.state.currentPhase = 'client';
    this.state.currentEntity = clientName;
    logger.info('Progress tracker: client analysis started', { clientName });
  }

  completeCriterion(criterion: string, isClient: boolean): void {
    // Convert to step-based tracking
    const entityId = isClient ? 'client' : `competitor_${this.state.competitorsComplete}`;
    this.markStepComplete(`${entityId}_${criterion}`);
    
    // Update legacy state for compatibility
    if (isClient) {
      this.state.criteriaComplete++;
      if (this.state.criteriaComplete >= 8) {
        this.state.clientComplete = true;
      }
    }
  }

  startCompetitor(competitorName: string, index: number): void {
    // Step-based system handles this through markStepComplete
    this.state.currentPhase = 'competitors';
    this.state.currentEntity = competitorName;
    logger.info('Progress tracker: competitor analysis started', { competitorName, index });
  }

  completeCompetitor(): void {
    this.state.competitorsComplete++;
    logger.info('Progress tracker: competitor completed', { 
      completed: this.state.competitorsComplete,
      total: this.state.competitorsTotal 
    });
  }

  startInsights(): void {
    this.state.currentPhase = 'insights';
    this.state.currentOperation = 'Generating AI insights and recommendations';
    this.state.message = 'Analyzing patterns and generating insights...';
    // Use step-based tracking
    this.markStepComplete('insights_generation');
  }

  complete(): void {
    // Ensure we're at 100% and mark as completed
    this.state.currentPhase = 'completed';
    this.state.overallPercent = 100;
    this.state.timeRemaining = 0;
    this.state.message = 'Analysis complete';
    logger.info('Progress tracker: analysis completed', { 
      totalTime: Date.now() - this.startTime,
      completedSteps: this.completedSteps,
      totalSteps: this.totalSteps
    });

    // Broadcast completion via SSE if we have a clientId
    if (this.clientId) {
      try {
        sseEventEmitter.broadcastCompletion(this.clientId, {
          overallPercent: 100,
          message: 'Analysis complete',
          totalTime: Date.now() - this.startTime
        });
      } catch (error) {
        logger.warn('Failed to broadcast completion via SSE', {
          clientId: this.clientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  // Get current state for database/frontend
  getState(): ProgressState {
    this.state.timeElapsed = Date.now() - this.startTime;
    return { ...this.state };
  }

  // Get simple progress string for database
  getProgressString(): string {
    return this.state.message;
  }

  private recalculate(): void {
    // Use the actual step-based percentage if we have steps
    if (this.totalSteps > 0) {
      this.state.overallPercent = Math.round((this.completedSteps / this.totalSteps) * 100);
    } else {
      // Fallback to old logic during initialization
      this.state.overallPercent = 0;
    }

    // Calculate time remaining
    const elapsed = Date.now() - this.startTime;
    const estimatedTotal = this.estimateTotal();
    this.state.timeRemaining = Math.max(0, estimatedTotal - elapsed);

    // Determine pace
    const expectedTime = this.getExpectedTimeAtProgress(this.state.overallPercent);
    if (elapsed < expectedTime * 0.8) {
      this.state.pace = 'faster';
    } else if (elapsed > expectedTime * 1.2) {
      this.state.pace = 'slower';
    } else {
      this.state.pace = 'normal';
    }

    // Generate user-friendly message
    this.state.message = this.generateMessage();

    logger.debug('Progress tracker recalculated', {
      percent: this.state.overallPercent,
      timeElapsed: elapsed,
      timeRemaining: this.state.timeRemaining,
      pace: this.state.pace,
      phase: this.state.currentPhase
    });

    // Broadcast progress via SSE if we have a clientId
    if (this.clientId) {
      try {
        sseEventEmitter.broadcastProgress(this.clientId, {
          ...this.state
        });
      } catch (error) {
        logger.warn('Failed to broadcast progress via SSE', {
          clientId: this.clientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private estimateTotal(): number {
    let total = 0;
    
    // Client time
    total += this.historicalAverages.screenshot;
    total += this.historicalAverages.tier1Total * 4; // 4 Tier 1 criteria
    total += this.historicalAverages.tier2Total * 3; // 3 Tier 2 criteria
    total += this.historicalAverages.pageSpeed;      // 1 Tier 3 criterion
    
    // Competitor time
    total += this.state.competitorsTotal * this.historicalAverages.competitorTotal;
    
    // Insights time
    total += this.historicalAverages.insights;
    
    return total;
  }

  private getExpectedTimeAtProgress(percent: number): number {
    const total = this.estimateTotal();
    return (percent / 100) * total;
  }

  private generateMessage(): string {
    if (this.state.currentPhase === 'initializing') {
      return 'Starting analysis';
    }
    
    if (this.state.currentPhase === 'completed') {
      return 'Analysis complete';
    }
    
    // Simply return the current operation without time info
    // The frontend already shows time remaining separately
    return this.state.currentOperation;
  }
}

// Singleton instance management
let progressTracker: ProgressTracker | null = null;

export function createProgressTracker(clientId?: string): ProgressTracker {
  progressTracker = new ProgressTracker(clientId);
  logger.info('Progress tracker created', { clientId });
  return progressTracker;
}

export function getProgressTracker(): ProgressTracker | null {
  return progressTracker;
}

export function clearProgressTracker(): void {
  if (progressTracker) {
    logger.info('Progress tracker cleared');
  }
  progressTracker = null;
}