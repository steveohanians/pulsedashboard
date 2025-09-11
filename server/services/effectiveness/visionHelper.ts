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
 * Supports both S3 URLs and local file paths for backward compatibility
 */
export async function convertScreenshotToBase64(screenshotPath: string): Promise<string> {
  try {
    // Check if this is an S3 URL (starts with https://)
    if (screenshotPath.startsWith('https://')) {
      logger.info('Converting S3 screenshot to base64', {
        s3Url: screenshotPath
      });
      
      // Fetch image from S3 URL with timeout and retry logic
      const maxRetries = 2;
      let lastError: Error | null = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
          
          const response = await fetch(screenshotPath, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'PulseDashboard/1.0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          logger.info('Successfully fetched S3 screenshot', {
            s3Url: screenshotPath,
            imageSize: Math.round(buffer.length / 1024) + 'KB',
            attempt: attempt + 1
          });
          
          return buffer.toString('base64');
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const isNetworkError = lastError.name === 'AbortError' || 
                                 lastError.message.includes('fetch') ||
                                 lastError.message.includes('network') ||
                                 lastError.message.includes('timeout');
          
          if (attempt < maxRetries - 1 && isNetworkError) {
            logger.warn('S3 fetch failed, retrying', {
              attempt: attempt + 1,
              maxRetries,
              error: lastError.message,
              s3Url: screenshotPath
            });
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw lastError;
        }
      }
      
      throw lastError || new Error('S3 fetch failed after retries');
    }
    
    // Handle local file paths (existing logic for backward compatibility)
    let fullPath: string;
    
    if (screenshotPath.startsWith('/screenshots/')) {
      // Handle URL paths like "/screenshots/filename.png" - most common case  
      const filename = screenshotPath.replace('/screenshots/', '');
      fullPath = path.join(process.cwd(), 'uploads', 'screenshots', filename);
    } else if (path.isAbsolute(screenshotPath) && !screenshotPath.startsWith('/screenshots/')) {
      // Already absolute filesystem path
      fullPath = screenshotPath;
    } else if (screenshotPath.startsWith('screenshots/')) {
      // Handle relative paths like "screenshots/filename.png"
      fullPath = path.join(process.cwd(), 'uploads', screenshotPath);
    } else if (screenshotPath.startsWith('uploads/')) {
      // Handle paths like "uploads/screenshots/filename.png"
      fullPath = path.join(process.cwd(), screenshotPath);
    } else {
      // Handle bare filenames like "fullpage_xxx.png"
      fullPath = path.join(process.cwd(), 'uploads', 'screenshots', screenshotPath);
    }
    
    logger.info('Converting local screenshot to base64', {
      originalPath: screenshotPath,
      resolvedPath: fullPath
    });
    
    // Additional check: ensure the resolved path exists
    await fs.access(fullPath);
    
    const imageBuffer = await fs.readFile(fullPath);
    return imageBuffer.toString('base64');
    
  } catch (error) {
    logger.error('Failed to convert screenshot to base64', {
      screenshotPath,
      error: error instanceof Error ? error.message : String(error),
      isS3Url: screenshotPath.startsWith('https://')
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
  // Retry logic for timeout errors
  const maxRetries = 1;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Convert screenshot to base64
      const base64Image = await convertScreenshotToBase64(screenshotPath);
      
      // Replace content placeholder in prompt
      const finalPrompt = promptTemplate.replace('{content}', textContent);
      
      logger.info('Making OpenAI vision request', {
        textContentLength: textContent.length,
        promptLength: finalPrompt.length,
        imageSize: Math.round(base64Image.length / 1024) + 'KB',
        maxTokens,
        attempt: attempt + 1,
        maxRetries: maxRetries + 1
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
        tokensUsed: response.usage?.total_tokens || 'unknown',
        attempt: attempt + 1
      });

      return analysisText;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTimeout = lastError.message.includes('timeout') || 
                       lastError.message.includes('timed out') ||
                       lastError.message.includes('ETIMEDOUT') ||
                       lastError.message.includes('ECONNRESET');
      
      if (attempt < maxRetries && isTimeout) {
        logger.warn('OpenAI vision request timed out, retrying', {
          attempt: attempt + 1,
          error: lastError.message,
          screenshotPath
        });
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      logger.error('OpenAI vision call failed', {
        error: lastError.message,
        screenshotPath,
        attempt: attempt + 1,
        wasTimeout: isTimeout
      });
      throw lastError;
    }
  }
  
  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('OpenAI vision call failed after retries');
}