/**
 * Website Screenshot Service
 * 
 * Captures above-fold screenshots using Playwright for effectiveness scoring
 */

import { chromium, Browser, Page } from 'playwright';
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

export class ScreenshotService {
  private static instance: ScreenshotService;
  private browser: Browser | null = null;
  private browserAvailable: boolean | null = null;
  private pageCount: number = 0;
  private lastRecycleTime: number = Date.now();
  private maxPagesBeforeRecycle: number = 10;
  private activePagesCount: number = 0;
  private browserLock: Promise<void> = Promise.resolve();
  
  // Retry configuration
  private readonly maxRetryAttempts = 3;
  private readonly baseRetryDelay = 1000; // 1 second

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryScreenshotError(errorMessage: string): boolean {
    const retryableErrors = [
      'timeout',
      'aborted', 
      '500',
      '502',
      '503',
      '504',
      'ECONNRESET',
      'ETIMEDOUT',
      'network error'
    ];
    
    return retryableErrors.some(error => 
      errorMessage.toLowerCase().includes(error.toLowerCase())
    );
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.baseRetryDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * exponentialDelay * 0.3; // 30% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Classify error type for better logging
   */
  private getErrorType(errorMessage: string): string {
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('50')) return 'server_error';
    if (errorMessage.includes('aborted')) return 'connection_aborted';
    if (errorMessage.includes('network')) return 'network_error';
    return 'unknown_error';
  }

  /**
   * Determine if an HTML capture error should trigger a retry
   */
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

  /**
   * Check if Playwright browser can be launched
   */
  private async checkBrowserAvailability(): Promise<boolean> {
    if (this.browserAvailable !== null) {
      return this.browserAvailable;
    }

    try {
      logger.info('Testing Playwright browser availability');
      
      // Try with Nix browser path first (Replit environment)
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
        // Fallback to default Playwright installation
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
   * Check browser health and determine if recycling is needed
   */
  private async checkBrowserHealth(): Promise<boolean> {
    if (!this.browser) return false;
    try {
      const pages = this.browser.contexts().flatMap(c => c.pages());
      const memUsage = process.memoryUsage();
      
      // Log health status
      logger.info('[BROWSER] Health check', {
        openPages: pages.length,
        pageCount: this.pageCount,
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        timeSinceRecycle: Date.now() - this.lastRecycleTime
      });
      
      // Recycle if unhealthy
      if (pages.length > 5 || memUsage.heapUsed > 500 * 1024 * 1024) {
        logger.warn('[BROWSER] Unhealthy state detected, recycling');
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize browser instance with proper locking
   */
  private async ensureBrowser(): Promise<Browser | null> {
    if (!await this.checkBrowserAvailability()) {
      return null;
    }

    // Use lock to prevent concurrent browser operations
    return new Promise((resolve) => {
      this.browserLock = this.browserLock.then(async (): Promise<void> => {
        // Check if browser needs recycling due to health or usage
        if (this.browser) {
          const shouldRecycle = 
            this.pageCount >= this.maxPagesBeforeRecycle ||
            (Date.now() - this.lastRecycleTime) > 5 * 60 * 1000; // 5 minutes
          
          // Only recycle if no active pages to prevent race conditions
          if (shouldRecycle && this.activePagesCount === 0) {
            logger.info('[BROWSER] Recycling browser instance', {
              reason: this.pageCount >= this.maxPagesBeforeRecycle ? 'page-limit' : 'time-limit',
              pageCount: this.pageCount,
              uptime: Date.now() - this.lastRecycleTime,
              activePagesCount: this.activePagesCount
            });
            await this.cleanup();
          } else if (shouldRecycle && this.activePagesCount > 0) {
            logger.info('[BROWSER] Deferring browser recycle - active pages detected', {
              activePagesCount: this.activePagesCount,
              pageCount: this.pageCount
            });
          }
        }

        if (!this.browser) {
          try {
            logger.info('Launching Playwright browser for screenshots');
            
            // Try with Nix browser path first (Replit environment)
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
              // Fallback to default Playwright installation
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
            
            // Reset counters after successful browser creation
            this.pageCount = 0;
            this.activePagesCount = 0;
            this.lastRecycleTime = Date.now();
            logger.info('[BROWSER] Browser launched successfully, counters reset');
            
          } catch (error) {
            logger.error('Failed to launch Playwright browser', {
              error: error instanceof Error ? error.message : String(error)
            });
            this.browserAvailable = false;
          }
        }
        resolve(this.browser);
      });
    });
  }

  /**
   * Capture only rendered HTML using Playwright (lightweight, no screenshot)
   * Used to supplement API screenshot method with rendered HTML
   */
  public async captureRenderedHTMLOnly(url: string, retryCount = 0): Promise<string | undefined> {
    // Only proceed if Playwright is available
    if (this.browserAvailable === false) {
      return undefined;
    }

    const browser = await this.ensureBrowser();
    if (!browser) return undefined;

    try {
      // Wrap entire operation in 30s timeout with retry logic
      const htmlResult = await Promise.race([
        this.performHTMLCapture(url, browser),
        new Promise<string | undefined>((_, reject) => 
          setTimeout(() => reject(new Error('HTML capture timeout after 30s')), 30000)
        )
      ]);

      return htmlResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Retry logic for browser-related errors
      if (this.shouldRetryHTMLCapture(errorMessage) && retryCount < 2) {
        const retryDelay = this.calculateRetryDelay(retryCount + 1);
        
        logger.warn('HTML capture failed, retrying', {
          url,
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
        attempts: retryCount + 1,
        error: errorMessage
      });
      return undefined;
    }
  }

  /**
   * Perform HTML capture with proper resource tracking
   */
  private async performHTMLCapture(url: string, browser: Browser): Promise<string | undefined> {
    let page: Page | null = null;
    
    try {
      // Increment active pages counter before creating page
      this.activePagesCount++;
      page = await browser.newPage();
      
      // Increment page count when creating page
      this.pageCount++;
      logger.info('[BROWSER] Created new page', { 
        pageCount: this.pageCount,
        activePagesCount: this.activePagesCount,
        url 
      });
      
      // Use minimal viewport for faster loading
      await page.setViewportSize({ width: 1440, height: 900 });
      
      // Set user agent using context options instead of page method
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
      });
      
      logger.info('[HTML CAPTURE] Starting rendered HTML capture for API screenshot path', { 
        url,
        purpose: 'supplement-api-screenshot-with-rendered-html'
      });
      
      // Navigate and wait for network idle
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 25000
      });
      
      // Wait for JavaScript frameworks to render - increased for complex JS apps
      await page.waitForTimeout(3000);
      
      // Additional wait for dynamic content that might load after initial render
      try {
        // Wait for common CTA-related selectors to appear
        await page.waitForSelector('button, .btn, [class*="button"], [class*="cta"], a[href*="contact"], a[href*="learn"]', { 
          timeout: 2000 
        }).catch(() => {
          // If specific selectors don't appear, just continue
          logger.info('No specific CTA selectors found, proceeding with capture', { url });
        });
      } catch (e) {
        // Ignore timeout - proceed anyway
      }
      
      // Extract the rendered HTML
      const renderedHtml = await page.content();
      
      // Check for specific CTA-related content that might be JavaScript-generated
      const ctaKeywords = ['GET TO KNOW US', 'View more work', 'Contact Us', 'Learn More', 'Get Started', 'Book Now', 'Sign Up'];
      const foundCTAKeywords = ctaKeywords.filter(keyword => renderedHtml.toLowerCase().includes(keyword.toLowerCase()));
      
      logger.info('[HTML CAPTURE] Successfully captured rendered HTML for prompts', {
        url,
        htmlLength: renderedHtml.length,
        hasInteractiveElements: renderedHtml.includes('button') || renderedHtml.includes('btn'),
        hasJavaScriptContent: renderedHtml.includes('</script>') || renderedHtml.includes('onclick'),
        foundCTAKeywords: foundCTAKeywords.length > 0 ? foundCTAKeywords : 'none',
        buttonCount: (renderedHtml.match(/<button/gi) || []).length,
        linkCount: (renderedHtml.match(/<a\s+[^>]*href/gi) || []).length,
        purpose: 'ai-prompt-analysis'
      });
      
      return renderedHtml;
      
    } catch (error) {
      logger.warn('[BROWSER] HTML capture failed', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return undefined;
    } finally {
      // Ensure page is always closed to prevent memory leaks
      if (page) {
        try {
          await page.close();
          this.activePagesCount = Math.max(0, this.activePagesCount - 1);
          logger.info('[BROWSER] Page closed successfully', { 
            pageCount: this.pageCount,
            activePagesCount: this.activePagesCount,
            url 
          });
        } catch (closeError) {
          logger.warn('[BROWSER] Error closing page', { 
            error: closeError instanceof Error ? closeError.message : String(closeError)
          });
        }
      } else {
        // Decrement active pages even if page creation failed
        this.activePagesCount = Math.max(0, this.activePagesCount - 1);
      }
    }
  }

  /**
   * Ensure filename has .png extension for S3 compatibility
   */
  private ensurePngExtension(filename: string): string {
    return filename.endsWith('.png') ? filename : filename + '.png';
  }

  /**
   * Generate a placeholder screenshot when all methods fail
   */
  private generatePlaceholderScreenshot(): { 
    screenshotPath: string; 
    screenshotUrl: string; 
    placeholder: boolean;
  } {
    // Return a 1x1 transparent PNG as base64
    const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    return {
      screenshotPath: '',
      screenshotUrl: `data:image/png;base64,${transparentPng}`,
      placeholder: true
    };
  }

  /**
   * Capture screenshot using Screenshotone.com API
   */
  private async captureWithAPI(url: string, outputDir: string, filename?: string, retryCount: boolean = false): Promise<ScreenshotResult> {
    try {
      const apiKey = process.env.SCREENSHOTONE_API_KEY;
      const s3Bucket = process.env.AWS_S3_BUCKET;
      
      if (!apiKey) {
        logger.warn('SCREENSHOTONE_API_KEY not configured, screenshots will not be captured');
        return {
          screenshotPath: '',
          screenshotUrl: '',
          error: 'Screenshot API not configured - set SCREENSHOTONE_API_KEY environment variable',
          fallbackUsed: true,
          screenshotMethod: 'none'
        };
      }

      if (!s3Bucket) {
        logger.warn('AWS_S3_BUCKET not configured, cannot use S3 storage');
        return {
          screenshotPath: '',
          screenshotUrl: '',
          error: 'S3 storage not configured - set AWS_S3_BUCKET environment variable',
          fallbackUsed: true,
          screenshotMethod: 'none'
        };
      }

      // Generate filename for S3 storage with proper .png extension
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substr(2, 9);
      const screenshotFilename = filename 
        ? this.ensurePngExtension(filename) 
        : `screenshot_${timestamp}_${randomId}.png`;

      logger.info('Using Screenshotone.com API for screenshot with S3 storage', { 
        url, 
        s3Bucket, 
        screenshotFilename 
      });
      
      // Screenshotone.com API endpoint with optimized parameters for complex sites
      const apiUrl = new URL('https://api.screenshotone.com/take');
      apiUrl.searchParams.append('access_key', apiKey);
      apiUrl.searchParams.append('url', url);
      apiUrl.searchParams.append('viewport_width', '1440');
      apiUrl.searchParams.append('viewport_height', '900');
      apiUrl.searchParams.append('format', 'png');
      apiUrl.searchParams.append('image_quality', '85');
      apiUrl.searchParams.append('cache', 'true'); // Use cache for repeated requests
      apiUrl.searchParams.append('cache_ttl', '86400'); // 24 hour cache
      apiUrl.searchParams.append('block_ads', 'true');
      apiUrl.searchParams.append('block_cookie_banners', 'true');
      apiUrl.searchParams.append('block_trackers', 'true'); // Block trackers for faster loading
      apiUrl.searchParams.append('wait_until', 'networkidle2'); // Wait for network idle
      apiUrl.searchParams.append('delay', '3'); // 3 second delay for complex animations
      apiUrl.searchParams.append('timeout', '90'); // 90 second timeout (max allowed)
      apiUrl.searchParams.append('navigation_timeout', '30'); // 30 second navigation timeout (max allowed)
      
      // S3 storage configuration with full object key
      apiUrl.searchParams.append('store', 'true'); // Enable S3 storage
      apiUrl.searchParams.append('storage_bucket', s3Bucket); // S3 bucket name
      apiUrl.searchParams.append('storage_path', `screenshots/${screenshotFilename}`); // Full S3 object key
      apiUrl.searchParams.append('response_type', 'json'); // Return JSON with S3 URL
      
      // Fetch screenshot from API (expecting JSON response with S3 URL)
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(120000) // 120 seconds for API call (includes processing time)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      // Parse JSON response to get S3 URL with robust field checking
      const jsonResponse = await response.json();
      
      // Check multiple possible field names for the S3 URL
      const s3Url = jsonResponse.location || jsonResponse.url || jsonResponse.data?.location || jsonResponse.data?.url;
      
      if (!s3Url) {
        logger.error('S3 URL not found in API response', { 
          response: jsonResponse,
          availableFields: Object.keys(jsonResponse)
        });
        throw new Error('S3 URL not found in API response - check response format');
      }

      // Validate URL format
      if (typeof s3Url !== 'string' || !s3Url.startsWith('http')) {
        logger.error('Invalid S3 URL format', { s3Url, type: typeof s3Url });
        throw new Error('Invalid S3 URL format received from API');
      }

      logger.info('Screenshot captured successfully via API and stored in S3', {
        url,
        s3Url,
        screenshotFilename,
        method: 'screenshotone-s3'
      });

      return {
        screenshotPath: '', // No local path for S3 storage
        screenshotUrl: s3Url, // Direct S3 URL
        fallbackUsed: false,
        screenshotMethod: 'api',
        screenshotQuality: 'full'
        // NOTE: No renderedHtml here - API is for screenshots only
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Enhanced retry logic with exponential backoff
      if (this.shouldRetryScreenshotError(errorMessage) && !retryCount) {
        const retryDelay = this.calculateRetryDelay(1); // First retry
        logger.info('[SCREENSHOT] Retrying screenshot request with exponential backoff', { 
          url, 
          attempt: 2, 
          delay: retryDelay,
          errorType: this.getErrorType(errorMessage)
        });
        
        await new Promise(r => setTimeout(r, retryDelay));
        // Recursive call with retry flag
        return this.captureWithAPI(url, outputDir, filename, true);
      }
      
      logger.error('Screenshotone API failed', {
        url,
        error: errorMessage,
        retried: retryCount,
        errorType: this.getErrorType(errorMessage),
        fallbackAvailable: true
      });
      
      return {
        screenshotPath: '',
        screenshotUrl: '',
        error: `Screenshot API failed: ${errorMessage}`,
        fallbackUsed: true,
        screenshotMethod: 'none'
      };
    }
  }

  /**
   * Capture full-page screenshot using Screenshotone.com API with optimized parameters
   */
  public async captureFullPageWithAPI(url: string, outputDir: string, baseFilename?: string): Promise<{
    fullPageScreenshotPath: string;
    fullPageScreenshotUrl: string;
    fullPageError?: string;
  }> {
    try {
      const apiKey = process.env.SCREENSHOTONE_API_KEY;
      const s3Bucket = process.env.AWS_S3_BUCKET;
      
      if (!apiKey) {
        return {
          fullPageScreenshotPath: '',
          fullPageScreenshotUrl: '',
          fullPageError: 'Screenshot API not configured - set SCREENSHOTONE_API_KEY environment variable'
        };
      }

      if (!s3Bucket) {
        return {
          fullPageScreenshotPath: '',
          fullPageScreenshotUrl: '',
          fullPageError: 'S3 storage not configured - set AWS_S3_BUCKET environment variable'
        };
      }

      // Generate filename for full-page S3 storage with proper .png extension
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fullPageFilename = baseFilename 
        ? this.ensurePngExtension(`fullpage_${baseFilename}`) 
        : `fullpage_${timestamp}_${randomId}.png`;

      logger.info('Capturing full-page screenshot with Screenshotone API and S3 storage', { 
        url, 
        s3Bucket, 
        fullPageFilename 
      });
      
      // Optimized full-page parameters based on Screenshotone best practices
      const apiUrl = new URL('https://api.screenshotone.com/take');
      apiUrl.searchParams.append('access_key', apiKey);
      apiUrl.searchParams.append('url', url);
      
      // Full-page specific parameters optimized for reliability
      apiUrl.searchParams.append('full_page', 'true');
      apiUrl.searchParams.append('full_page_scroll', 'true');
      apiUrl.searchParams.append('full_page_algorithm', 'by_sections'); // Better for complex pages
      apiUrl.searchParams.append('full_page_scroll_delay', '800'); // Slower for lazy loading
      apiUrl.searchParams.append('full_page_scroll_by', '400'); // Smaller increments for accuracy
      apiUrl.searchParams.append('wait_until', 'networkidle2'); // More reliable than networkidle0
      apiUrl.searchParams.append('delay', '3'); // 3 second delay for animations
      apiUrl.searchParams.append('timeout', '90'); // 90 second timeout (max allowed)
      apiUrl.searchParams.append('navigation_timeout', '30'); // 30 second navigation timeout (max allowed)
      
      // Standard parameters optimized for performance
      apiUrl.searchParams.append('viewport_width', '1440');
      apiUrl.searchParams.append('viewport_height', '900');
      apiUrl.searchParams.append('format', 'png');
      apiUrl.searchParams.append('image_quality', '85'); // Reduced for faster processing
      apiUrl.searchParams.append('cache', 'true');
      apiUrl.searchParams.append('cache_ttl', '86400');
      apiUrl.searchParams.append('block_ads', 'true');
      apiUrl.searchParams.append('block_cookie_banners', 'true');
      apiUrl.searchParams.append('block_trackers', 'true'); // Additional blocking
      // Note: fail_if_request_failed parameter removed - was causing API validation error
      
      // S3 storage configuration for full-page screenshots with full object key
      apiUrl.searchParams.append('store', 'true'); // Enable S3 storage
      apiUrl.searchParams.append('storage_bucket', s3Bucket); // S3 bucket name
      apiUrl.searchParams.append('storage_path', `fullpage/${fullPageFilename}`); // Full S3 object key
      apiUrl.searchParams.append('response_type', 'json'); // Return JSON with S3 URL
      
      // Fetch full-page screenshot (may take 20-30 seconds)
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(120000) // 120 second timeout for full-page (matches above-fold)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Full-page API returned ${response.status}: ${errorText}`);
      }

      // Parse JSON response to get S3 URL with robust field checking
      const jsonResponse = await response.json();
      
      // Check multiple possible field names for the S3 URL
      const s3Url = jsonResponse.location || jsonResponse.url || jsonResponse.data?.location || jsonResponse.data?.url;
      
      if (!s3Url) {
        logger.error('S3 URL not found in full-page API response', { 
          response: jsonResponse,
          availableFields: Object.keys(jsonResponse)
        });
        throw new Error('S3 URL not found in full-page API response - check response format');
      }

      // Validate URL format
      if (typeof s3Url !== 'string' || !s3Url.startsWith('http')) {
        logger.error('Invalid S3 URL format in full-page response', { s3Url, type: typeof s3Url });
        throw new Error('Invalid S3 URL format received from full-page API');
      }

      logger.info('Full-page screenshot captured successfully and stored in S3', {
        url,
        s3Url,
        fullPageFilename,
        method: 'screenshotone-s3-fullpage'
      });

      return {
        fullPageScreenshotPath: '', // No local path for S3 storage
        fullPageScreenshotUrl: s3Url // Direct S3 URL
      };

    } catch (error) {
      logger.error('Full-page API failed, trying Playwright fallback', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Try Playwright fallback for full-page screenshots
      try {
        const browser = await this.ensureBrowser();
        if (!browser) {
          return {
            fullPageScreenshotPath: '',
            fullPageScreenshotUrl: '',
            fullPageError: `Full-page screenshot failed: API timeout and no browser available`
          };
        }

        let page = null;
        try {
          page = await browser.newPage();
          await page.setViewportSize({ width: 1440, height: 900 });
          
          logger.info('Using Playwright fallback for full-page screenshot', { url });
          
          await page.goto(url, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
          });
          await page.waitForTimeout(2000);

          // Generate filename for full-page screenshot
          const timestamp = new Date().getTime();
          const randomId = Math.random().toString(36).substr(2, 9);
          const fullPageFilename = baseFilename 
            ? `fullpage_${baseFilename}` 
            : `fullpage_${timestamp}_${randomId}.png`;
          
          const fullPageScreenshotPath = path.join(outputDir, fullPageFilename);
          const fullPageScreenshotUrl = `/screenshots/${fullPageFilename}`;

          // Ensure output directory exists
          await fs.mkdir(outputDir, { recursive: true });
          
          // Take full-page screenshot with Playwright
          await page.screenshot({ 
            path: fullPageScreenshotPath, 
            fullPage: true 
          });
          
          // Verify file was created
          const fileStats = await fs.stat(fullPageScreenshotPath).catch(() => null);
          
          if (!fileStats) {
            throw new Error('Playwright full-page screenshot file was not created');
          }

          logger.info('Full-page screenshot captured via Playwright fallback', {
            url,
            fullPageScreenshotPath,
            fileSize: Math.round(fileStats.size / 1024 / 1024 * 100) / 100 + ' MB'
          });

          return {
            fullPageScreenshotPath,
            fullPageScreenshotUrl
          };

        } finally {
          if (page) {
            await page.close().catch(() => {});
          }
        }
        
      } catch (fallbackError) {
        logger.error('Both API and Playwright failed for full-page screenshot', {
          url,
          apiError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        
        return {
          fullPageScreenshotPath: '',
          fullPageScreenshotUrl: '',
          fullPageError: `Full-page screenshot failed: API timeout, Playwright fallback also failed`
        };
      }
    }
  }

  /**
   * Capture website screenshot and measure web vitals
   */
  public async captureWebsiteScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const {
      url,
      viewport = { width: 1440, height: 900 },
      outputDir = 'uploads/screenshots',
      filename,
      captureFullPage = false
    } = options;

    // Try API first for screenshots (more reliable in cloud environments)
    const apiKey = process.env.SCREENSHOTONE_API_KEY;
    if (apiKey) {
      const apiResult = await this.captureWithAPI(url, outputDir, filename);
      if (!apiResult.error) {
        
        // ALWAYS capture rendered HTML via Playwright (regardless of screenshot method)
        const renderedHtml = await this.captureRenderedHTMLOnly(url);
        
        // If above-fold screenshot succeeded and full-page is requested, capture that too
        if (captureFullPage) {
          logger.info('Above-fold screenshot successful, now capturing full-page', { url });
          const fullPageResult = await this.captureFullPageWithAPI(url, outputDir, filename);
          
          // Merge results - full-page failure doesn't break above-fold success
          return {
            ...apiResult,
            renderedHtml,  // Add rendered HTML from Playwright
            fullPageScreenshotPath: fullPageResult.fullPageScreenshotPath,
            fullPageScreenshotUrl: fullPageResult.fullPageScreenshotUrl,
            fullPageError: fullPageResult.fullPageError
          };
        }
        
        return {
          ...apiResult,
          renderedHtml  // Add rendered HTML from Playwright
        };
      }
      logger.warn('API screenshot failed, trying Playwright fallback', { url });
    }

    // Fall back to Playwright if API fails or not configured
    const browser = await this.ensureBrowser();
    if (!browser) {
      logger.warn('Both API and Playwright unavailable, using placeholder', { url });
      const placeholder = this.generatePlaceholderScreenshot();
      return {
        ...placeholder,
        error: 'All screenshot methods unavailable - using placeholder',
        screenshotMethod: 'placeholder',
        screenshotQuality: 'placeholder'
      };
    }

    let page: Page | null = null;

    try {
      page = await browser.newPage();

      // Set viewport
      await page.setViewportSize(viewport);

      // Set user agent
      // Set user agent using context options instead of page method
      await page.route('**/*', (route) => {
        route.continue({
          headers: {
            ...route.request().headers(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
      });

      logger.info('Loading page for screenshot', { url, viewport });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000 // 30 seconds for Playwright
      });

      // Wait for page to be ready
      await page.waitForTimeout(2000);

      // Measure Web Vitals
      const webVitals = await this.measureWebVitals(page);

      // Extract fully-rendered HTML content after JavaScript execution
      const renderedHtml = await page.content();
      
      logger.info('Extracted rendered HTML content', {
        url,
        htmlLength: renderedHtml.length,
        hasBasicElements: renderedHtml.includes('<body>') && renderedHtml.includes('</body>')
      });

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Generate filename if not provided
      const screenshotFilename = filename || 
        `screenshot_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}.png`;
      
      const screenshotPath = path.join(outputDir, screenshotFilename);

      // Capture above-fold screenshot
      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        clip: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height
        }
      });

      // Generate public URL (adjust based on your static file serving)
      const screenshotUrl = `/screenshots/${screenshotFilename}`;

      // Verify file was created
      const fileStats = await fs.stat(screenshotPath).catch(() => null);
      
      if (!fileStats) {
        throw new Error('Screenshot file was not created');
      }

      logger.info('Screenshot captured successfully', {
        url,
        screenshotPath,
        fileSize: fileStats.size,
        webVitals,
        method: 'playwright'
      });

      return {
        screenshotPath,
        screenshotUrl,
        webVitals,
        screenshotMethod: 'playwright',
        screenshotQuality: 'full',
        renderedHtml
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Playwright screenshot failed', {
        url,
        error: errorMessage
      });

      if (page) {
        await page.close().catch(() => {});
      }
      
      // Use placeholder as final fallback since both API and Playwright failed
      logger.warn('[SCREENSHOT] Using placeholder - all methods failed', { url });
      const placeholder = this.generatePlaceholderScreenshot();
      return {
        ...placeholder,
        error: `All screenshot methods failed: ${errorMessage}`,
        screenshotMethod: 'placeholder',
        screenshotQuality: 'placeholder'
      };

    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Measure Web Vitals using Playwright
   */
  private async measureWebVitals(page: Page): Promise<{ lcp: number; cls: number; fid: number }> {
    try {
      // Inject web vitals measurement script
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {
            lcp: 0,
            cls: 0,
            fid: 0
          };

          // LCP (Largest Contentful Paint)
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime / 1000; // Convert to seconds
          }).observe({ entryTypes: ['largest-contentful-paint'] });

          // CLS (Cumulative Layout Shift)
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });

          // FID (First Input Delay) - simplified
          let fidValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              fidValue = entry.processingStart - entry.startTime;
            }
            vitals.fid = fidValue;
          }).observe({ entryTypes: ['first-input'] });

          // Return measurements after a short delay
          setTimeout(() => {
            resolve(vitals);
          }, 3000);
        });
      });

      return webVitals as { lcp: number; cls: number; fid: number };

    } catch (error) {
      logger.warn('Failed to measure web vitals', {
        error: error instanceof Error ? error.message : String(error)
      });

      return { lcp: 0, cls: 0, fid: 0 };
    }
  }

  /**
   * Test screenshot functionality
   */
  public async testScreenshotCapability(): Promise<{
    playwrightAvailable: boolean;
    apiAvailable: boolean;
    recommendedMethod: 'playwright' | 'api' | 'none';
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Test API availability
    const apiKey = process.env.SCREENSHOTONE_API_KEY;
    const apiAvailable = !!apiKey;
    if (!apiAvailable) {
      errors.push('SCREENSHOTONE_API_KEY environment variable not set');
    }
    
    // Test Playwright
    const playwrightAvailable = await this.checkBrowserAvailability();
    if (!playwrightAvailable) {
      errors.push('Playwright browser not available - missing system dependencies');
    }
    
    // Prefer API since it's more reliable in cloud environments
    const recommendedMethod = apiAvailable ? 'api' : playwrightAvailable ? 'playwright' : 'none';
    
    return {
      playwrightAvailable,
      apiAvailable,
      recommendedMethod,
      errors
    };
  }

  /**
   * Cleanup and close browser with proper locking
   */
  public async cleanup(): Promise<void> {
    // Use lock to ensure cleanup doesn't interfere with active operations
    return new Promise((resolve) => {
      this.browserLock = this.browserLock.then(async () => {
        if (this.browser) {
          // Wait for active pages to finish before cleanup
          let waitAttempts = 0;
          const maxWaitAttempts = 10; // 5 seconds max wait
          
          while (this.activePagesCount > 0 && waitAttempts < maxWaitAttempts) {
            logger.info('[BROWSER] Waiting for active pages to finish before cleanup', {
              activePagesCount: this.activePagesCount,
              waitAttempts
            });
            await new Promise(r => setTimeout(r, 500));
            waitAttempts++;
          }
          
          if (this.activePagesCount > 0) {
            logger.warn('[BROWSER] Force closing browser with active pages', {
              activePagesCount: this.activePagesCount
            });
          }
          
          try {
            logger.info('[BROWSER] Closing Playwright browser', {
              pageCount: this.pageCount,
              activePagesCount: this.activePagesCount,
              uptime: Date.now() - this.lastRecycleTime
            });
            
            await this.browser.close();
            logger.info('[BROWSER] Browser closed successfully');
          } catch (error) {
            logger.error('[BROWSER] Error closing browser', { 
              error: error instanceof Error ? error.message : String(error) 
            });
          } finally {
            // Always reset state even if close fails
            this.browser = null;
            this.pageCount = 0;
            this.activePagesCount = 0;
            this.lastRecycleTime = Date.now();
            logger.info('[BROWSER] Browser state reset');
          }
        }
        resolve();
      });
    });
  }

  /**
   * Get screenshot HTML with annotations for key elements
   */
  public async getAnnotatedScreenshot(url: string): Promise<{
    screenshot: string;
    annotations: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      type: 'cta' | 'heading' | 'navigation' | 'form';
    }>;
  }> {
    let page: Page | null = null;

    try {
      const browser = await this.ensureBrowser();
      if (!browser) {
        return {
          screenshot: this.generatePlaceholderScreenshot().screenshotUrl,
          annotations: []
        };
      }
      page = await browser.newPage();

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Find key elements and their positions
      const annotations = await page.evaluate(() => {
        const elements = [
          // CTAs
          ...Array.from(document.querySelectorAll('button, .btn, .button, a[class*="btn"]')),
          // Headings  
          ...Array.from(document.querySelectorAll('h1, h2')),
          // Navigation
          ...Array.from(document.querySelectorAll('nav, .nav, .navigation')),
          // Forms
          ...Array.from(document.querySelectorAll('form'))
        ];

        return elements.slice(0, 10).map((el: Element, index) => {
          const rect = el.getBoundingClientRect();
          const tagName = el.tagName.toLowerCase();
          
          let type: 'cta' | 'heading' | 'navigation' | 'form' = 'cta';
          let label = `Element ${index + 1}`;

          if (tagName.startsWith('h')) {
            type = 'heading';
            label = el.textContent?.substring(0, 30) || 'Heading';
          } else if (tagName === 'nav' || el.className.includes('nav')) {
            type = 'navigation';
            label = 'Navigation';
          } else if (tagName === 'form') {
            type = 'form';
            label = 'Form';
          } else if (tagName === 'button' || el.className.includes('btn')) {
            type = 'cta';
            label = el.textContent?.substring(0, 20) || 'CTA';
          }

          return {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            label,
            type
          };
        }).filter(annotation => 
          annotation.y < 900 && // Above fold
          annotation.width > 10 && 
          annotation.height > 10
        );
      });

      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width: 1440, height: 900 }
      });

      const screenshotBase64 = screenshotBuffer.toString('base64');

      return {
        screenshot: `data:image/png;base64,${screenshotBase64}`,
        annotations
      };

    } catch (error) {
      logger.error('Failed to get annotated screenshot', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        screenshot: '',
        annotations: []
      };

    } finally {
      if (page) {
        await page.close();
      }
    }
  }
}

// Singleton export
export const screenshotService = ScreenshotService.getInstance();