/**
 * Vision Helper for OpenAI GPT-4o Integration
 * 
 * Provides utilities for converting screenshots to base64 and making vision-enabled OpenAI calls
 */

import { promises as fs } from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import logger from '../../utils/logging/logger';

/**
 * Convert screenshot file to base64 for OpenAI vision API
 */
export async function convertScreenshotToBase64(screenshotPath: string): Promise<string> {
  try {
    // Handle both absolute and relative paths
    const fullPath = path.isAbsolute(screenshotPath) 
      ? screenshotPath 
      : path.join(process.cwd(), screenshotPath);
    
    const imageBuffer = await fs.readFile(fullPath);
    return imageBuffer.toString('base64');
  } catch (error) {
    logger.error('Failed to convert screenshot to base64', {
      screenshotPath,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error(`Screenshot conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Make OpenAI call with both text content and vision analysis
 */
export async function callOpenAIWithVision(
  textContent: string,
  screenshotPath: string,
  promptTemplate: string,
  systemPrompt: string,
  openai: OpenAI,
  maxTokens: number = 500
): Promise<string> {
  try {
    // Convert screenshot to base64
    const base64Image = await convertScreenshotToBase64(screenshotPath);
    
    // Replace content placeholder in prompt
    const finalPrompt = promptTemplate.replace('{content}', textContent);
    
    logger.info('Making OpenAI vision request', {
      textContentLength: textContent.length,
      promptLength: finalPrompt.length,
      imageSize: Math.round(base64Image.length / 1024) + 'KB',
      maxTokens
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: finalPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ]
    });

    const analysisText = response.choices[0]?.message?.content?.trim();
    if (!analysisText) {
      throw new Error('No response from OpenAI vision analysis');
    }

    logger.info('OpenAI vision analysis completed', {
      responseLength: analysisText.length,
      tokensUsed: response.usage?.total_tokens || 'unknown'
    });

    return analysisText;

  } catch (error) {
    logger.error('OpenAI vision call failed', {
      error: error instanceof Error ? error.message : String(error),
      screenshotPath
    });
    throw error;
  }
}