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
async function fetchTemplateWithRetry(criterion: string, maxRetries = 2): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const template = await Promise.race([
        storage.getEffectivenessPromptTemplate(criterion),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000))
      ]);
      return template;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
    }
  }
}

export async function getEffectivenessPrompt(criterion: string): Promise<EffectivenessPrompt | null> {
  try {
    const dbTemplate = await fetchTemplateWithRetry(criterion);
    
    if (dbTemplate && dbTemplate.promptTemplate) {
      return {
        promptTemplate: dbTemplate.promptTemplate,
        systemPrompt: dbTemplate.systemPrompt,
        schema: typeof dbTemplate.schema === 'string' 
          ? JSON.parse(dbTemplate.schema) 
          : dbTemplate.schema
      };
    }
  } catch (error) {
    // Silent fallback for production reliability
  }

  // Fallback to hardcoded defaults
  
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
  
  if (!classifier || !classifier.prompt) {
    return null;
  }
  
  return {
    promptTemplate: classifier.prompt,
    systemPrompt,
    schema: classifier.schema
  };
}