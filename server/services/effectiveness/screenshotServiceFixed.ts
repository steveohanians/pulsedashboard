/**
 * Fixed Website Screenshot Service - Proper Browser Lifecycle Management
 * 
 * Implements external API best practices:
 * - Context isolation instead of browser recycling
 * - Proper operation tracking to prevent race conditions  
 * - Health checks before browser operations
 * - Controlled parallel processing with semaphores
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import logger from '../../utils/logging/logger';

interface ScreenshotOptions {
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
  outputDir?: string;
  filename?: string;
  captureFullPage?: boolean;
}

export interface ScreenshotResult {
  screenshotPath: string;
  screenshotUrl: string;
  fullPageScreenshotPath?: string;
  fullPageScreenshotUrl?: string;
  fullPageError?: string;
  webVitals?: {
    lcp: number;
    cls: number;
    fid: number;
  };
  error?: string;
  fallbackUsed?: boolean;
  screenshotMethod?: 'playwright' | 'api' | 'placeholder' | 'none';
  screenshotQuality?: 'full' | 'degraded' | 'placeholder';
  placeholder?: boolean;
  renderedHtml?: string;
}

interface ActiveOperation {
  id: string;
  type: 'screenshot' | 'html_capture' | 'web_vitals';
  url: string;
  startTime: number;
  context?: BrowserContext;
  page?: Page;
}

export class ScreenshotServiceFixed {
  private static instance: ScreenshotServiceFixed;
  private browser: Browser | null = null;
  private browserAvailable: boolean | null = null;
  private browserLock: Promise<void> = Promise.resolve();
  
  // ✅ NEW: Operation tracking to prevent race conditions  
  private activeOperations = new Map<string, ActiveOperation>();
  private operationSemaphore = new Set<string>(); // Max 5 concurrent operations
  private maxConcurrentOperations = 5;
  
  // ✅ NEW: Browser health tracking
  private browserStartTime: number = 0;
  private maxBrowserLifetime = 10 * 60 * 1000; // 10 minutes
  private lastHealthCheck: number = 0;
  private healthCheckInterval = 30 * 1000; // 30 seconds
  
  // Retry configuration
  private readonly maxRetryAttempts = 3;
  private readonly baseRetryDelay = 1000;

  public static getInstance(): ScreenshotServiceFixed {
    if (!ScreenshotServiceFixed.instance) {
      ScreenshotServiceFixed.instance = new ScreenshotServiceFixed();
    }
    return ScreenshotServiceFixed.instance;
  }

  /**
   * ✅ NEW: Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * ✅ NEW: Check if we can start a new operation (semaphore control)
   */
  private async acquireOperationSlot(operationId: string): Promise<boolean> {
    // Wait for available slot
    let attempts = 0;
    while (this.operationSemaphore.size >= this.maxConcurrentOperations && attempts < 30) {
      logger.info('Waiting for available operation slot', {
        currentOperations: this.operationSemaphore.size,
        maxOperations: this.maxConcurrentOperations,
        operationId,
        attempt: attempts + 1
      });
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }
    
    if (this.operationSemaphore.size >= this.maxConcurrentOperations) {
      logger.warn('Could not acquire operation slot - system overloaded', {
        operationId,
        activeOperations: this.operationSemaphore.size
      });
      return false;
    }
    
    this.operationSemaphore.add(operationId);
    logger.info('Acquired operation slot', {
      operationId,
      activeOperations: this.operationSemaphore.size
    });
    return true;
  }

  /**
   * ✅ NEW: Release operation slot
   */
  private releaseOperationSlot(operationId: string): void {
    this.operationSemaphore.delete(operationId);
    this.activeOperations.delete(operationId);
    logger.info('Released operation slot', {
      operationId,
      remainingOperations: this.operationSemaphore.size
    });
  }

  /**
   * ✅ ENHANCED: Browser health check with proper lifecycle management
   */
  private async checkBrowserHealth(): Promise<boolean> {
    if (!this.browser) return false;
    
    const now = Date.now();
    
    // Skip health check if done recently (performance optimization)
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return true;
    }
    
    try {
      // Check if browser is still connected
      const contexts = this.browser.contexts();
      const isConnected = this.browser.isConnected();
      
      // Check browser age
      const browserAge = now - this.browserStartTime;
      const isExpired = browserAge > this.maxBrowserLifetime;
      
      logger.info('[BROWSER] Health check results', {
        isConnected,
        contextCount: contexts.length,
        browserAge: Math.round(browserAge / 1000) + 's',
        isExpired,
        activeOperations: this.activeOperations.size
      });
      
      this.lastHealthCheck = now;
      
      // Browser is healthy if connected and not expired
      return isConnected && !isExpired;
      
    } catch (error) {
      logger.warn('[BROWSER] Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Check if Playwright browser can be launched
   */
  private async checkBrowserAvailability(): Promise<boolean> {
    if (this.browserAvailable !== null) {
      return this.browserAvailable;
    }

    try {
      logger.info('Testing Playwright browser availability');
      
      const nixBrowserPath = '/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome';
      
      let testBrowser;
      try {
        testBrowser = await chromium.launch({
          headless: true,
          executablePath: nixBrowserPath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ]
        });
        logger.info('Using Nix browser for Playwright');
      } catch (nixError) {
        testBrowser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ]
        });
        logger.info('Using default Playwright browser installation');
      }
      
      await testBrowser.close();
      this.browserAvailable = true;
      logger.info('Playwright browser is available');
      return true;
    } catch (error) {
      this.browserAvailable = false;
      logger.warn('Playwright browser not available, will use API fallback', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * ✅ FIXED: Proper browser initialization with lifecycle tracking
   */
  private async ensureBrowser(): Promise<Browser | null> {
    if (!await this.checkBrowserAvailability()) {
      return null;
    }

    return new Promise((resolve) => {
      this.browserLock = this.browserLock.then(async () => {
        // Check browser health before reusing
        const isHealthy = await this.checkBrowserHealth();
        
        // Only create new browser if needed
        if (!this.browser || !isHealthy) {
          // ✅ SAFE: Only cleanup if no active operations
          if (this.browser && this.activeOperations.size === 0) {
            logger.info('[BROWSER] Replacing unhealthy browser', {
              isHealthy,
              activeOperations: this.activeOperations.size
            });
            try {
              await this.browser.close();
            } catch (e) {
              logger.warn('[BROWSER] Error closing old browser', { error: e });
            }
            this.browser = null;
          } else if (this.browser && this.activeOperations.size > 0) {
            logger.warn('[BROWSER] Cannot replace browser - active operations detected', {
              activeOperations: this.activeOperations.size,
              operationIds: Array.from(this.activeOperations.keys())
            });
            resolve(this.browser);
            return;
          }

          if (!this.browser) {
            try {
              logger.info('Launching new Playwright browser');
              
              const nixBrowserPath = '/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome';
              
              try {
                this.browser = await chromium.launch({
                  headless: true,
                  executablePath: nixBrowserPath,
                  args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                  ]
                });
                logger.info('Launched Nix browser for Playwright');
              } catch (nixError) {
                this.browser = await chromium.launch({
                  headless: true,
                  args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                  ]
                });
                logger.info('Launched default Playwright browser');
              }
              
              this.browserStartTime = Date.now();
              this.lastHealthCheck = Date.now();
              logger.info('[BROWSER] Browser launched successfully');
              
            } catch (error) {
              logger.error('Failed to launch Playwright browser', {
                error: error instanceof Error ? error.message : String(error)
              });
              this.browserAvailable = false;
              return null;
            }
          }
        }
        
        resolve(this.browser);
      });
    });
  }

  /**
   * ✅ FIXED: Context isolation with proper resource tracking
   */
  public async captureRenderedHTMLOnly(url: string, retryCount = 0): Promise<string | undefined> {
    if (this.browserAvailable === false) {
      return undefined;
    }

    const operationId = this.generateOperationId();
    
    // ✅ NEW: Check operation slot availability
    if (!await this.acquireOperationSlot(operationId)) {
      logger.warn('HTML capture skipped - no operation slots available', { url });
      return undefined;
    }

    const browser = await this.ensureBrowser();
    if (!browser) {
      this.releaseOperationSlot(operationId);
      return undefined;
    }

    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      // ✅ NEW: Create isolated context instead of reusing browser pages
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      page = await context.newPage();
      
      // ✅ NEW: Track operation
      const operation: ActiveOperation = {
        id: operationId,
        type: 'html_capture',
        url,
        startTime: Date.now(),
        context,
        page
      };
      this.activeOperations.set(operationId, operation);

      logger.info('[HTML CAPTURE] Starting with context isolation', { 
        url,
        operationId,
        activeOperations: this.activeOperations.size
      });
      
      // Timeout with proper cleanup
      const htmlResult = await Promise.race([
        this.performHTMLCaptureFixed(page, url, operationId),
        new Promise<string | undefined>((_, reject) => 
          setTimeout(() => reject(new Error('HTML capture timeout after 25s')), 25000)
        )
      ]);

      return htmlResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // ✅ IMPROVED: Better retry logic
      if (this.shouldRetryHTMLCapture(errorMessage) && retryCount < 2) {
        const retryDelay = this.calculateRetryDelay(retryCount + 1);
        
        logger.warn('HTML capture failed, retrying with new context', {
          url,
          operationId,
          attempt: retryCount + 1,
          maxRetries: 2,
          delay: retryDelay,
          error: errorMessage
        });

        await new Promise(r => setTimeout(r, retryDelay));
        return this.captureRenderedHTMLOnly(url, retryCount + 1);
      }

      logger.warn('Failed to capture rendered HTML after retries', {
        url,
        operationId,
        attempts: retryCount + 1,
        error: errorMessage
      });
      return undefined;
    } finally {
      // ✅ CRITICAL: Always cleanup context and page
      try {
        if (page) {
          await page.close();
        }
        if (context) {
          await context.close();
        }
        logger.info('[HTML CAPTURE] Context cleaned up successfully', {
          operationId,
          url
        });
      } catch (cleanupError) {
        logger.warn('[HTML CAPTURE] Error during context cleanup', {
          operationId,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        });
      } finally {
        // ✅ CRITICAL: Always release operation slot
        this.releaseOperationSlot(operationId);
      }
    }
  }

  /**
   * ✅ NEW: Fixed HTML capture implementation
   */
  private async performHTMLCaptureFixed(page: Page, url: string, operationId: string): Promise<string | undefined> {
    try {
      logger.info('[HTML CAPTURE] Navigating to URL', { url, operationId });
      
      // Navigate and wait for network idle
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 20000
      });
      
      // Wait for JavaScript frameworks to render
      await page.waitForTimeout(2500);
      
      // Additional wait for dynamic content
      try {
        await page.waitForSelector('button, .btn, [class*="button"], [class*="cta"], a[href*="contact"], a[href*="learn"]', { 
          timeout: 1500 
        }).catch(() => {
          logger.info('No specific CTA selectors found, proceeding with capture', { url, operationId });
        });
      } catch (e) {
        // Ignore timeout - proceed anyway
      }
      
      // Extract the rendered HTML
      const renderedHtml = await page.content();
      
      // Check for specific CTA-related content
      const ctaKeywords = ['GET TO KNOW US', 'View more work', 'Contact Us', 'Learn More', 'Get Started', 'Book Now', 'Sign Up'];
      const foundCTAKeywords = ctaKeywords.filter(keyword => renderedHtml.toLowerCase().includes(keyword.toLowerCase()));
      
      logger.info('[HTML CAPTURE] Successfully captured rendered HTML', {
        url,
        operationId,
        htmlLength: renderedHtml.length,
        hasInteractiveElements: renderedHtml.includes('button') || renderedHtml.includes('btn'),
        hasJavaScriptContent: renderedHtml.includes('</script>') || renderedHtml.includes('onclick'),
        foundCTAKeywords: foundCTAKeywords.length > 0 ? foundCTAKeywords : 'none',
        buttonCount: (renderedHtml.match(/<button/gi) || []).length,
        linkCount: (renderedHtml.match(/<a\s+[^>]*href/gi) || []).length
      });
      
      return renderedHtml;
      
    } catch (error) {
      logger.warn('[HTML CAPTURE] Failed to capture HTML', {
        url,
        operationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * ✅ ENHANCED: Safe cleanup that respects active operations
   */
  public async cleanup(): Promise<void> {
    return new Promise((resolve) => {
      this.browserLock = this.browserLock.then(async () => {
        logger.info('[BROWSER] Starting safe cleanup', {
          activeOperations: this.activeOperations.size,
          operationIds: Array.from(this.activeOperations.keys())
        });
        
        // ✅ CRITICAL FIX: Wait for ALL active operations to complete
        let waitAttempts = 0;
        const maxWaitAttempts = 60; // 30 seconds max wait (500ms * 60)
        
        while (this.activeOperations.size > 0 && waitAttempts < maxWaitAttempts) {
          logger.info('[BROWSER] Waiting for active operations to complete', {
            activeOperations: this.activeOperations.size,
            waitAttempts,
            maxWaitAttempts,
            remainingTime: `${Math.round((maxWaitAttempts - waitAttempts) * 0.5)}s`
          });
          
          // Log which operations are still active
          this.activeOperations.forEach((op, id) => {
            const duration = Date.now() - op.startTime;
            logger.info(`  - Operation ${id}: ${op.type} on ${op.url} (${Math.round(duration/1000)}s)`);
          });
          
          await new Promise(r => setTimeout(r, 500));
          waitAttempts++;
        }
        
        // ✅ SAFE: Only proceed if no active operations OR timeout reached
        if (this.activeOperations.size > 0) {
          logger.warn('[BROWSER] Proceeding with cleanup despite active operations', {
            activeOperations: this.activeOperations.size,
            reason: 'cleanup_timeout'
          });
          
          // Force close active contexts as last resort
          for (const [opId, operation] of this.activeOperations) {
            try {
              if (operation.page) await operation.page.close();
              if (operation.context) await operation.context.close();
              logger.info(`[BROWSER] Force closed operation ${opId}`);
            } catch (e) {
              logger.warn(`[BROWSER] Error force closing operation ${opId}`, { error: e });
            }
          }
          this.activeOperations.clear();
          this.operationSemaphore.clear();
        }
        
        // Close browser if present
        if (this.browser) {
          try {
            logger.info('[BROWSER] Closing browser after operations completed');
            await this.browser.close();
            logger.info('[BROWSER] Browser closed successfully');
          } catch (error) {
            logger.error('[BROWSER] Error closing browser', { 
              error: error instanceof Error ? error.message : String(error) 
            });
          } finally {
            this.browser = null;
            this.browserStartTime = 0;
            this.lastHealthCheck = 0;
            logger.info('[BROWSER] Browser state reset');
          }
        }
        
        resolve();
      });
    });
  }

  /**
   * ✅ NEW: Get browser info for monitoring
   */
  public async getBrowserInfo(): Promise<{
    isAvailable: boolean;
    isHealthy: boolean;
    activeOperations: number;
    browserAge: number;
    contexts: number;
  } | null> {
    try {
      const isHealthy = await this.checkBrowserHealth();
      return {
        isAvailable: !!this.browser,
        isHealthy,
        activeOperations: this.activeOperations.size,
        browserAge: this.browserStartTime ? Date.now() - this.browserStartTime : 0,
        contexts: this.browser ? this.browser.contexts().length : 0
      };
    } catch (error) {
      return null;
    }
  }

  // ✅ KEEP: All existing helper methods
  private shouldRetryHTMLCapture(errorMessage: string): boolean {
    const retryableErrors = [
      'browser has been closed',
      'context has been closed', 
      'page has been closed',
      'timeout',
      'navigation failed',
      'net::ERR_',
      'Protocol error'
    ];
    
    return retryableErrors.some(error => 
      errorMessage.toLowerCase().includes(error.toLowerCase())
    );
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * exponentialDelay * 0.3;
    return Math.min(exponentialDelay + jitter, 30000);
  }

  // TODO: Implement other existing methods with context isolation...
  // For now, focusing on the core HTML capture fix
}

// Fixed singleton export  
export const screenshotServiceFixed = ScreenshotServiceFixed.getInstance();