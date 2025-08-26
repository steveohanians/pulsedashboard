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
}

export class ScreenshotService {
  private static instance: ScreenshotService;
  private browser: Browser | null = null;

  public static getInstance(): ScreenshotService {
    if (!ScreenshotService.instance) {
      ScreenshotService.instance = new ScreenshotService();
    }
    return ScreenshotService.instance;
  }

  /**
   * Initialize browser instance
   */
  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
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
    }
    return this.browser;
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

    let page: Page | null = null;

    try {
      const browser = await this.ensureBrowser();
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

      logger.info('Screenshot captured successfully', {
        url,
        screenshotPath,
        fileSize: (await fs.stat(screenshotPath)).size,
        webVitals
      });

      return {
        screenshotPath,
        screenshotUrl,
        webVitals
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Failed to capture screenshot', {
        url,
        error: errorMessage
      });

      return {
        screenshotPath: '',
        screenshotUrl: '',
        error: errorMessage
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
   * Cleanup and close browser
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      logger.info('Closing Playwright browser');
      await this.browser.close();
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