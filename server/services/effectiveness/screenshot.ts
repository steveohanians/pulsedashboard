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
  screenshotMethod?: 'playwright' | 'api' | 'none';
}

export class ScreenshotService {
  private static instance: ScreenshotService;
  private browser: Browser | null = null;
  private browserAvailable: boolean | null = null;

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
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
      const testBrowser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      });
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
   * Initialize browser instance
   */
  private async ensureBrowser(): Promise<Browser | null> {
    if (!await this.checkBrowserAvailability()) {
      return null;
    }

    if (!this.browser) {
      try {
        logger.info('Launching Playwright browser for screenshots');
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ]
        });
      } catch (error) {
        logger.error('Failed to launch Playwright browser', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.browserAvailable = false;
        return null;
      }
    }
    return this.browser;
  }

  /**
   * Capture screenshot using Screenshotone.com API
   */
  private async captureWithAPI(url: string, outputDir: string, filename?: string): Promise<ScreenshotResult> {
    try {
      const apiKey = process.env.SCREENSHOTONE_API_KEY;
      
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

      logger.info('Using Screenshotone.com API for screenshot', { url });
      
      // Screenshotone.com API endpoint
      const apiUrl = new URL('https://api.screenshotone.com/take');
      apiUrl.searchParams.append('access_key', apiKey);
      apiUrl.searchParams.append('url', url);
      apiUrl.searchParams.append('viewport_width', '1440');
      apiUrl.searchParams.append('viewport_height', '900');
      apiUrl.searchParams.append('format', 'png');
      apiUrl.searchParams.append('image_quality', '90');
      apiUrl.searchParams.append('cache', 'true'); // Use cache for repeated requests
      apiUrl.searchParams.append('cache_ttl', '86400'); // 24 hour cache
      apiUrl.searchParams.append('block_ads', 'true');
      apiUrl.searchParams.append('block_cookie_banners', 'true');
      apiUrl.searchParams.append('wait_until', 'networkidle2'); // Wait for page to load (networkidle2 is valid)
      apiUrl.searchParams.append('delay', '2'); // 2 second delay for JS rendering
      
      // Fetch screenshot from API
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'image/png'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      // Save screenshot to disk
      const screenshotFilename = filename || 
        `screenshot_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}.png`;
      
      const screenshotPath = path.join(outputDir, screenshotFilename);
      const screenshotUrl = `/screenshots/${screenshotFilename}`;

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      // Get image buffer and save
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(screenshotPath, buffer);
      
      // Verify file was created
      const fileStats = await fs.stat(screenshotPath).catch(() => null);
      
      if (!fileStats) {
        throw new Error('Screenshot file was not created');
      }

      logger.info('Screenshot captured successfully via API', {
        url,
        screenshotPath,
        fileSize: fileStats.size,
        method: 'screenshotone'
      });

      return {
        screenshotPath,
        screenshotUrl,
        fallbackUsed: false,
        screenshotMethod: 'api'
      };
    } catch (error) {
      logger.error('Screenshotone API failed', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        screenshotPath: '',
        screenshotUrl: '',
        error: `Screenshot API failed: ${error instanceof Error ? error.message : String(error)}`,
        fallbackUsed: true,
        screenshotMethod: 'none'
      };
    }
  }

  /**
   * Capture full-page screenshot using Screenshotone.com API with optimized parameters
   */
  private async captureFullPageWithAPI(url: string, outputDir: string, baseFilename?: string): Promise<{
    fullPageScreenshotPath: string;
    fullPageScreenshotUrl: string;
    fullPageError?: string;
  }> {
    try {
      const apiKey = process.env.SCREENSHOTONE_API_KEY;
      
      if (!apiKey) {
        return {
          fullPageScreenshotPath: '',
          fullPageScreenshotUrl: '',
          fullPageError: 'Screenshot API not configured - set SCREENSHOTONE_API_KEY environment variable'
        };
      }

      logger.info('Capturing full-page screenshot with Screenshotone API', { url });
      
      // Use optimized full-page parameters from working test
      const apiUrl = new URL('https://api.screenshotone.com/take');
      apiUrl.searchParams.append('access_key', apiKey);
      apiUrl.searchParams.append('url', url);
      
      // Full-page specific parameters (from test_screenshot_openai.ts)
      apiUrl.searchParams.append('full_page', 'true');
      apiUrl.searchParams.append('full_page_scroll', 'true');
      apiUrl.searchParams.append('full_page_algorithm', 'by_sections');
      apiUrl.searchParams.append('full_page_scroll_delay', '1000');
      apiUrl.searchParams.append('full_page_scroll_by', '300');
      apiUrl.searchParams.append('wait_until', 'networkidle0');
      apiUrl.searchParams.append('delay', '5');
      apiUrl.searchParams.append('timeout', '60');
      
      // Standard parameters
      apiUrl.searchParams.append('viewport_width', '1440');
      apiUrl.searchParams.append('viewport_height', '900');
      apiUrl.searchParams.append('format', 'png');
      apiUrl.searchParams.append('image_quality', '90');
      apiUrl.searchParams.append('cache', 'true');
      apiUrl.searchParams.append('cache_ttl', '86400');
      apiUrl.searchParams.append('block_ads', 'true');
      apiUrl.searchParams.append('block_cookie_banners', 'true');
      
      // Fetch full-page screenshot (may take 20-30 seconds)
      const response = await fetch(apiUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'image/png' },
        signal: AbortSignal.timeout(70000) // 70 second timeout for full-page
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Full-page API returned ${response.status}: ${errorText}`);
      }

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
      
      // Get image buffer and save
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(fullPageScreenshotPath, buffer);
      
      // Verify file was created
      const fileStats = await fs.stat(fullPageScreenshotPath).catch(() => null);
      
      if (!fileStats) {
        throw new Error('Full-page screenshot file was not created');
      }

      logger.info('Full-page screenshot captured successfully', {
        url,
        fullPageScreenshotPath,
        fileSize: Math.round(fileStats.size / 1024 / 1024 * 100) / 100 + ' MB'
      });

      return {
        fullPageScreenshotPath,
        fullPageScreenshotUrl
      };

    } catch (error) {
      logger.error('Full-page screenshot capture failed', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        fullPageScreenshotPath: '',
        fullPageScreenshotUrl: '',
        fullPageError: `Full-page screenshot failed: ${error instanceof Error ? error.message : String(error)}`
      };
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

    // Try API first (more reliable in cloud environments)
    const apiKey = process.env.SCREENSHOTONE_API_KEY;
    if (apiKey) {
      const apiResult = await this.captureWithAPI(url, outputDir, filename);
      if (!apiResult.error) {
        // If above-fold screenshot succeeded and full-page is requested, capture that too
        if (captureFullPage) {
          logger.info('Above-fold screenshot successful, now capturing full-page', { url });
          const fullPageResult = await this.captureFullPageWithAPI(url, outputDir, filename);
          
          // Merge results - full-page failure doesn't break above-fold success
          return {
            ...apiResult,
            fullPageScreenshotPath: fullPageResult.fullPageScreenshotPath,
            fullPageScreenshotUrl: fullPageResult.fullPageScreenshotUrl,
            fullPageError: fullPageResult.fullPageError
          };
        }
        return apiResult;
      }
      logger.warn('API screenshot failed, trying Playwright fallback', { url });
    }

    // Fall back to Playwright if API fails or not configured
    const browser = await this.ensureBrowser();
    if (!browser) {
      logger.warn('Both API and Playwright unavailable for screenshots', { url });
      return {
        screenshotPath: '',
        screenshotUrl: '',
        error: 'No screenshot method available - configure SCREENSHOTONE_API_KEY or install Playwright dependencies',
        screenshotMethod: 'none'
      };
    }

    let page: Page | null = null;

    try {
      page = await browser.newPage();

      // Set viewport
      await page.setViewportSize(viewport);

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      logger.info('Loading page for screenshot', { url, viewport });

      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Wait for page to be ready
      await page.waitForTimeout(2000);

      // Measure Web Vitals
      const webVitals = await this.measureWebVitals(page);

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
        quality: 90,
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
        screenshotMethod: 'playwright'
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
      
      // Return error since API was already tried
      return {
        screenshotPath: '',
        screenshotUrl: '',
        error: errorMessage,
        screenshotMethod: 'none'
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
   * Cleanup and close browser
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      logger.info('Closing Playwright browser');
      await this.browser.close().catch(error => {
        logger.error('Error closing browser', { error: error instanceof Error ? error.message : String(error) });
      });
      this.browser = null;
    }
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