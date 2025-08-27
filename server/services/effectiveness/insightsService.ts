/**
 * EffectivenessInsightsService
 * 
 * Centralized service for generating AI-powered effectiveness insights.
 * Separates business logic from route handlers and provides comprehensive
 * error handling, validation, and caching capabilities.
 */

import { OpenAI } from 'openai';
import logger from '../../utils/logging/logger';
import { errorHandler, createStructuredError, ERROR_CODES } from '../../utils/errorHandling';
import { AIClient } from './aiClient';
import { ValidationService } from './validationService';
import { ErrorFactory, ErrorClassifier, type EffectivenessError } from './errors';
import type { ScoringContext, CriterionResult } from './types';

export interface EffectivenessData {
  clientId: string;
  runId: string;
  overallScore: string;
  createdAt: string;
  status: string;
}

export interface ClientData {
  id: string;
  name: string;
  websiteUrl: string;
}

export interface InsightsResult {
  success: boolean;
  insights: {
    insight: string;
    recommendations: string[];
    confidence: number;
    key_pattern: string;
    fallback?: boolean;
  };
  clientName: string;
  overallScore: string;
  runId: string;
}

export interface InsightsServiceDependencies {
  storage: any;
  openaiClient: OpenAI;
  validationService?: ValidationService;
  aiClientConfig?: any;
}


/**
 * Main service class for effectiveness insights generation
 */
export class EffectivenessInsightsService {
  private storage: any;
  private aiClient: AIClient;
  private validationService: ValidationService;

  constructor(dependencies: InsightsServiceDependencies) {
    this.storage = dependencies.storage;
    this.aiClient = new AIClient(dependencies.openaiClient, dependencies.aiClientConfig);
    this.validationService = dependencies.validationService || new ValidationService();
  }

  /**
   * Main entry point for generating insights
   */
  async generateInsights(
    clientId: string,
    runId: string,
    userId: string | undefined,
    userRole: string | undefined
  ): Promise<InsightsResult> {
    try {
      logger.info('Starting insights generation', { clientId, runId, userId, userRole });

      // Validate access
      await this.validateAccess(clientId, userId, userRole);
      
      // Fetch all required data in parallel
      const data = await this.fetchRequiredData(clientId, runId);
      
      // Generate insights with AI
      const insights = await this.analyzeWithAI(data);
      
      logger.info('Insights generation completed successfully', { 
        clientId, 
        runId, 
        keyPattern: insights.key_pattern,
        recommendationCount: insights.recommendations.length
      });

      return {
        success: true,
        insights,
        clientName: data.client.name,
        overallScore: data.effectivenessData.overallScore,
        runId
      };

    } catch (error) {
      logger.error('Insights generation failed', {
        clientId,
        runId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validates user access to the client data
   */
  private async validateAccess(
    clientId: string,
    userId: string | undefined,
    userRole: string | undefined
  ): Promise<void> {
    if (userRole !== 'Admin' && userId !== clientId) {
      throw ErrorFactory.accessDenied(userId, `client:${clientId}`, { clientId, userRole });
    }
  }

  /**
   * Fetches all required data for insights generation in parallel
   */
  private async fetchRequiredData(clientId: string, runId: string) {
    const [effectivenessData, client, criterionScores] = await Promise.all([
      this.storage.getEffectivenessRun(runId),
      this.storage.getClient(clientId),
      this.storage.getCriterionScores(runId)
    ]);

    // Validate data existence and relationships
    if (!effectivenessData || effectivenessData.clientId !== clientId) {
      throw ErrorFactory.notFound('Effectiveness run', runId, { clientId });
    }

    if (!client) {
      throw ErrorFactory.notFound('Client', clientId);
    }

    if (!criterionScores?.length) {
      throw ErrorFactory.notFound('Criterion scores', `runId:${runId}`, { runId, clientId });
    }

    return { effectivenessData, client, criterionScores };
  }

  /**
   * Generates insights using AI with retry logic and fallbacks
   */
  private async analyzeWithAI(data: {
    effectivenessData: EffectivenessData;
    client: ClientData;
    criterionScores: CriterionResult[];
  }) {
    const overallScore = parseFloat(data.effectivenessData.overallScore) || 0;
    
    // Prepare data for AI client
    const promptData = {
      websiteUrl: data.client.websiteUrl,
      overallScore,
      criterionScores: data.criterionScores,
      clientName: data.client.name
    };

    try {
      // Generate insights using AI client
      const aiResponse = await this.aiClient.generateInsights(promptData);
      
      // Validate the response
      const validationResult = this.validationService.validateInsightsResponse(aiResponse);
      
      if (!validationResult.isValid) {
        logger.warn('AI response validation failed', {
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
        
        // If validation fails, throw validation error
        throw ErrorFactory.validation(
          validationResult.errors.map(e => e.message),
          { clientId: data.client.id, runId: data.effectivenessData.runId }
        );
      }

      if (validationResult.warnings.length > 0) {
        logger.info('AI response has warnings', {
          warnings: validationResult.warnings,
          clientId: data.client.id
        });
      }

      return validationResult.sanitized || aiResponse;
      
    } catch (error) {
      logger.error('AI insights generation failed', {
        error: error instanceof Error ? error.message : String(error),
        clientId: data.client.id,
        runId: data.effectivenessData.runId
      });

      // Re-throw effectiveness errors as-is
      if (error instanceof Error && error.constructor.name.endsWith('Error')) {
        throw error;
      }

      // Convert other errors to AI service errors
      throw ErrorFactory.aiService(error, {
        clientId: data.client.id,
        runId: data.effectivenessData.runId
      });
    }
  }

  /**
   * Gets the AI client for external access (useful for testing)
   */
  getAIClient(): AIClient {
    return this.aiClient;
  }

  /**
   * Gets the validation service for external access
   */
  getValidationService(): ValidationService {
    return this.validationService;
  }

  /**
   * Performs health check on the service dependencies
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const aiHealth = await this.aiClient.healthCheck();
      
      return {
        status: aiHealth.status === 'healthy' ? 'healthy' : 'degraded',
        details: {
          ai: aiHealth,
          validation: { status: 'healthy' },
          storage: { status: 'healthy' } // Assume storage is healthy if no errors
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}