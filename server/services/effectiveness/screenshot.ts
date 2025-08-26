/**
 * Website Screenshot Service
 * 
 * Captures above-fold screenshots using Playwright for effectiveness scoring
 */

import { chromium, Browser, Page } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import logger from '../../utils/logging/logger';

interface ScreenshotOptions {
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
  outputDir?: string;
  filename?: string;
}

interface ScreenshotResult {
  screenshotPath: string;
  screenshotUrl: string;
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
   * Capture screenshot using external API service
   */
  private async captureWithAPI(url: string, outputDir: string, filename?: string): Promise<ScreenshotResult> {
    try {
      logger.info('Using screenshot API fallback', { url });
      
      // Use screenshotone.com free tier or another service
      // For now, create a placeholder indicating API method would be used
      const screenshotFilename = filename || 
        `screenshot_api_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}.png`;
      
      const screenshotPath = path.join(outputDir, screenshotFilename);
      const screenshotUrl = `/screenshots/${screenshotFilename}`;

      // Create a placeholder file to indicate screenshot was attempted
      await fs.mkdir(outputDir, { recursive: true });
      
      // For production, you would use a real screenshot API here
      // Example: const apiUrl = `https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&viewport_width=1440&viewport_height=900`;
      
      logger.info('Screenshot API placeholder created', {
        url,
        screenshotPath,
        method: 'api'
      });

      return {
        screenshotPath,
        screenshotUrl,
        fallbackUsed: true,
        screenshotMethod: 'api',
        error: 'Screenshot API not configured - placeholder only'
      };
    } catch (error) {
      logger.error('Screenshot API fallback failed', {
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
   * Capture website screenshot and measure web vitals
   */
  public async captureWebsiteScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
    const {
      url,
      viewport = { width: 1440, height: 900 },
      outputDir = 'uploads/screenshots',
      filename
    } = options;

    // Check if browser is available
    const browser = await this.ensureBrowser();
    if (!browser) {
      logger.warn('Playwright not available, using API fallback for screenshot', { url });
      return this.captureWithAPI(url, outputDir, filename);
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
      
      logger.error('Playwright screenshot failed, trying API fallback', {
        url,
        error: errorMessage
      });

      // Try API fallback
      if (page) {
        await page.close().catch(() => {});
      }
      
      return this.captureWithAPI(url, outputDir, filename);

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
    
    // Test Playwright
    const playwrightAvailable = await this.checkBrowserAvailability();
    if (!playwrightAvailable) {
      errors.push('Playwright browser not available - missing system dependencies');
    }
    
    // Test API (placeholder for now)
    const apiAvailable = false; // Would test actual API here
    if (!apiAvailable) {
      errors.push('Screenshot API not configured');
    }
    
    const recommendedMethod = playwrightAvailable ? 'playwright' : apiAvailable ? 'api' : 'none';
    
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