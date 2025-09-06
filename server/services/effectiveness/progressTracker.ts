/**
 * Time-Aware Progress Tracking System
 * 
 * Single source of truth for all effectiveness scoring progress tracking.
 * Provides accurate time estimates, smooth progress updates, and user-friendly messages.
 */

import logger from '../../utils/logging/logger';

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
  private historicalAverages = {
    screenshot: 8000,       // 8s for screenshots
    tier1Total: 800,        // 0.8s per Tier 1 criterion (HTML analysis)
    tier2Total: 1500,       // 1.5s per Tier 2 criterion (AI analysis)
    pageSpeed: 35000,       // 35s for PageSpeed API
    insights: 4000,         // 4s for insights generation
    competitorTotal: 45000  // 45s per competitor (full analysis)
  };

  constructor() {
    this.startTime = Date.now();
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

  // Called when competitors are discovered
  setCompetitorCount(count: number): void {
    this.state.competitorsTotal = count;
    logger.info('Progress tracker: competitor count set', { count });
    this.recalculate();
  }

  // Called when starting client analysis
  startClient(clientName: string): void {
    this.state.currentPhase = 'client';
    this.state.currentEntity = clientName;
    this.state.currentOperation = 'Analyzing your website';
    logger.info('Progress tracker: client analysis started', { clientName });
    this.recalculate();
  }

  // Called when a criterion completes
  completeCriterion(criterion: string, isClient: boolean): void {
    if (isClient) {
      this.state.criteriaComplete++;
      if (this.state.criteriaComplete >= 8) {
        this.state.clientComplete = true;
        logger.info('Progress tracker: client analysis completed');
      }
    }
    logger.info('Progress tracker: criterion completed', { 
      criterion, 
      isClient, 
      totalComplete: this.state.criteriaComplete 
    });
    this.recalculate();
  }

  // Called when starting a competitor
  startCompetitor(competitorName: string, index: number): void {
    this.state.currentPhase = 'competitors';
    this.state.currentEntity = competitorName;
    this.state.currentOperation = `Analyzing competitor ${index + 1} of ${this.state.competitorsTotal}`;
    logger.info('Progress tracker: competitor analysis started', { competitorName, index });
    this.recalculate();
  }

  // Called when a competitor completes
  completeCompetitor(): void {
    this.state.competitorsComplete++;
    logger.info('Progress tracker: competitor completed', { 
      completed: this.state.competitorsComplete,
      total: this.state.competitorsTotal 
    });
    this.recalculate();
  }

  // Called when starting insights
  startInsights(): void {
    this.state.currentPhase = 'insights';
    this.state.currentOperation = 'Generating personalized insights';
    logger.info('Progress tracker: insights generation started');
    this.recalculate();
  }

  // Called when everything is done
  complete(): void {
    this.state.currentPhase = 'completed';
    this.state.overallPercent = 100;
    this.state.timeRemaining = 0;
    this.state.message = 'Analysis complete';
    logger.info('Progress tracker: analysis completed', { 
      totalTime: Date.now() - this.startTime 
    });
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
    // Calculate overall percentage
    let progress = 0;
    const clientWeight = 40;
    const competitorWeight = 50;
    const insightsWeight = 10;

    // Client progress (0-40%)
    if (this.state.clientComplete) {
      progress += clientWeight;
    } else {
      progress += (this.state.criteriaComplete / 8) * clientWeight;
    }

    // Competitor progress (0-50%)
    if (this.state.competitorsTotal > 0) {
      progress += (this.state.competitorsComplete / this.state.competitorsTotal) * competitorWeight;
    } else {
      // No competitors, give the weight to client + insights
      progress += competitorWeight;
    }

    // Insights progress (0-10%)
    if (this.state.currentPhase === 'insights') {
      progress += insightsWeight / 2; // 5% when starting insights
    } else if (this.state.currentPhase === 'completed') {
      progress += insightsWeight;
    }

    this.state.overallPercent = Math.min(Math.round(progress), 100);

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
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.ceil(this.state.timeRemaining / 1000);
    
    if (this.state.currentPhase === 'initializing') {
      return 'Starting analysis (typically 2-3 minutes)';
    }
    
    if (this.state.currentPhase === 'completed') {
      return 'Analysis complete';
    }
    
    // After 30 seconds, show time remaining
    if (elapsed > 30000 && seconds > 0) {
      if (seconds < 60) {
        return `${this.state.currentOperation} (about ${seconds} seconds remaining)`;
      } else {
        const minutes = Math.ceil(seconds / 60);
        return `${this.state.currentOperation} (about ${minutes} minute${minutes > 1 ? 's' : ''} remaining)`;
      }
    }
    
    return this.state.currentOperation;
  }
}

// Singleton instance management
let progressTracker: ProgressTracker | null = null;

export function createProgressTracker(): ProgressTracker {
  progressTracker = new ProgressTracker();
  logger.info('Progress tracker created');
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