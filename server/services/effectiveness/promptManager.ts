/**
 * Prompt Manager for Effectiveness Scoring
 * 
 * Manages fetching prompts from database with fallback to defaults
 */

import { storage } from '../../storage';
import { OPENAI_CLASSIFIERS } from './types';
import logger from '../../utils/logging/logger';

export interface EffectivenessPrompt {
  promptTemplate: string;
  systemPrompt: string;
  schema: Record<string, any>;
}

/**
 * Get effectiveness prompt from database with fallback to hardcoded defaults
 */
export async function getEffectivenessPrompt(criterion: string): Promise<EffectivenessPrompt | null> {
  try {
    // Try to fetch from database
    const dbTemplate = await storage.getEffectivenessPromptTemplate(criterion);
    
    if (dbTemplate) {
      logger.info(`Using database prompt template for ${criterion}`);
      return {
        promptTemplate: dbTemplate.promptTemplate,
        systemPrompt: dbTemplate.systemPrompt,
        schema: typeof dbTemplate.schema === 'string' 
          ? JSON.parse(dbTemplate.schema) 
          : dbTemplate.schema
      };
    }
  } catch (error) {
    logger.warn(`Failed to fetch prompt template from database for ${criterion}`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Fallback to hardcoded defaults
  logger.info(`Using default prompt template for ${criterion}`);
  
  let classifier;
  let systemPrompt;
  
  switch (criterion) {
    case 'positioning':
      classifier = OPENAI_CLASSIFIERS.HERO;
      systemPrompt = 'You are an expert copywriter analyzing website positioning. Return only valid JSON.';
      break;
    case 'brand_story':
      classifier = OPENAI_CLASSIFIERS.STORY;
      systemPrompt = 'You are an expert brand strategist analyzing website storytelling. Return only valid JSON.';
      break;
    case 'ctas':
      classifier = OPENAI_CLASSIFIERS.CTA_MATCH;
      systemPrompt = 'You are an expert UX analyst evaluating CTA effectiveness. Return only valid JSON.';
      break;
    default:
      return null;
  }
  
  return {
    promptTemplate: classifier.prompt,
    systemPrompt,
    schema: classifier.schema
  };
}