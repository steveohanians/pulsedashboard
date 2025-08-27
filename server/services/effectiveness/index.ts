/**
 * Effectiveness Services Index
 * 
 * Centralized exports for all effectiveness-related services and utilities.
 * Provides a clean interface for importing services throughout the application.
 */

// Core services
export { EffectivenessInsightsService } from './insightsService';
export { AIClient } from './aiClient';
export { EffectivenessPromptBuilder } from './promptBuilder';
export { ValidationService } from './validationService';

// Error handling
export * from './errors';

// Types
export * from './types';

// Re-export existing services for compatibility (commented out due to export issues)
// export { default as effectivenessScorer } from './scorer';
// export { configManager } from './config';

// Utility function to create a configured insights service
import { OpenAI } from 'openai';
import { EffectivenessInsightsService } from './insightsService';
import { ValidationService } from './validationService';

export function createInsightsService(
  storage: any,
  openaiApiKey?: string,
  config?: {
    maxRetries?: number;
    retryDelay?: number;
    enableFallback?: boolean;
  }
): EffectivenessInsightsService {
  const openai = new OpenAI({
    apiKey: openaiApiKey || process.env.OPENAI_API_KEY
  });

  const validationService = new ValidationService();

  return new EffectivenessInsightsService({
    storage,
    openaiClient: openai,
    validationService,
    aiClientConfig: config
  });
}

// Factory function for testing with mock dependencies
export function createMockInsightsService(
  mockStorage: any,
  mockOpenAI: any,
  mockValidation?: ValidationService
): EffectivenessInsightsService {
  return new EffectivenessInsightsService({
    storage: mockStorage,
    openaiClient: mockOpenAI,
    validationService: mockValidation || new ValidationService(),
    aiClientConfig: {
      maxRetries: 1,
      retryDelay: 100,
      enableFallback: true
    }
  });
}