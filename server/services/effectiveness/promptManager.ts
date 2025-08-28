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
    logger.info(`Fetching prompt template for criterion: ${criterion}`);
    // Try to fetch from database
    const dbTemplate = await storage.getEffectivenessPromptTemplate(criterion);
    logger.info(`Database template result for ${criterion}:`, { 
      exists: !!dbTemplate, 
      hasPrompt: !!dbTemplate?.promptTemplate,
      promptLength: dbTemplate?.promptTemplate?.length || 0
    });
    
    if (dbTemplate && dbTemplate.promptTemplate) {
      logger.info(`✓ Using database prompt template for ${criterion}`, {
        promptLength: dbTemplate.promptTemplate.length,
        hasSystemPrompt: !!dbTemplate.systemPrompt
      });
      return {
        promptTemplate: dbTemplate.promptTemplate,
        systemPrompt: dbTemplate.systemPrompt,
        schema: typeof dbTemplate.schema === 'string' 
          ? JSON.parse(dbTemplate.schema) 
          : dbTemplate.schema
      };
    } else {
      logger.warn(`Database template exists but missing promptTemplate for ${criterion}`);
    }
  } catch (error) {
    logger.warn(`Failed to fetch prompt template from database for ${criterion}`, {
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Fallback to hardcoded defaults
  logger.warn(`⚠️ Using fallback hardcoded prompt template for ${criterion} - database template not available`);
  
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
      logger.error(`No prompt template available for criterion: ${criterion}`);
      return null;
  }
  
  if (!classifier || !classifier.prompt) {
    logger.error(`Classifier or prompt missing for ${criterion}`);
    return null;
  }
  
  logger.info(`✓ Using fallback prompt for ${criterion}`, {
    promptLength: classifier.prompt.length
  });
  
  return {
    promptTemplate: classifier.prompt,
    systemPrompt,
    schema: classifier.schema
  };
}