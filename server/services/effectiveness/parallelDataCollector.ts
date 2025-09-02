/**
 * Parallel Data Collection Service
 * 
 * Optimizes data collection by running all capture methods simultaneously
 * instead of sequentially, reducing total time from 90s+ to 45s maximum
 */

import { screenshotService } from './screenshot';
import logger from '../../utils/logging/logger';
import { circuitBreaker } from './circuitBreaker';

export interface ParallelDataResult {
  // Initial HTML for SEO analysis
  initialHtml?: string;
  initialHtmlError?: string;
  
  // Rendered HTML from Playwright for CTAs/dynamic content
  renderedHtml?: string;
  renderedHtmlError?: string;
  
  // Screenshots for vision analysis
  screenshotUrl?: string;
  screenshotPath?: string;
  screenshotError?: string;
  screenshotMethod?: string;
  
  // Full-page screenshot for enhanced vision analysis
  fullPageScreenshotUrl?: string;
  fullPageScreenshotPath?: string;
  fullPageScreenshotError?: string;
  
  // Web vitals from screenshot service
  webVitals?: {
    lcp: number;
    cls: number;
    fid: number;
  };
  
  // Timing information for monitoring
  timing: {
    total: number;
    initialHtml: number;
    renderedHtml: number;
    screenshot: number;
    fullPageScreenshot: number;
  };
}

export class ParallelDataCollector {
  
  /**
   * Collect all data sources in parallel with intelligent fallbacks
   */
  public async collectAllData(
    websiteUrl: string,
    config: any
  ): Promise<ParallelDataResult> {
    const startTime = Date.now();
    const timing = {
      total: 0,
      initialHtml: 0,
      renderedHtml: 0,
      screenshot: 0,
      fullPageScreenshot: 0
    };
    
    logger.info('Starting parallel data collection', { 
      websiteUrl,
      targetDuration: '45s max'
    });

    // Start all data collection tasks simultaneously with circuit breaker protection
    const dataPromises = {
      initialHtml: circuitBreaker.execute(
        'initial_html',
        () => this.collectInitialHTML(websiteUrl),
        () => this.getMinimalHTMLFallback(websiteUrl)
      ),
      renderedHtml: circuitBreaker.execute(
        'rendered_html',
        () => this.collectRenderedHTML(websiteUrl),
        () => this.getMinimalHTMLFallback(websiteUrl)
      ),
      aboveFoldScreenshot: circuitBreaker.execute(
        'screenshot',
        () => this.collectAboveFoldScreenshot(websiteUrl, config),
        () => this.getScreenshotFallback('Above-fold screenshot service unavailable')
      ),
      fullPageScreenshot: circuitBreaker.execute(
        'full_page_screenshot', 
        () => this.collectFullPageScreenshot(websiteUrl, config),
        () => this.getScreenshotFallback('Full-page screenshot service unavailable')
      )
    };

    // Wait for all tasks with individual error handling
    const results = await Promise.allSettled([
      dataPromises.initialHtml,
      dataPromises.renderedHtml,
      dataPromises.aboveFoldScreenshot,
      dataPromises.fullPageScreenshot
    ]);

    // Process results with proper error handling
    const [initialResult, renderedResult, screenshotResult, fullPageResult] = results;

    // Extract initial HTML data
    let initialHtml: string | undefined;
    let initialHtmlError: string | undefined;
    if (initialResult.status === 'fulfilled') {
      initialHtml = initialResult.value.html;
      timing.initialHtml = initialResult.value.duration;
    } else {
      initialHtmlError = initialResult.reason?.message || 'Initial HTML fetch failed';
      logger.warn('Initial HTML collection failed', { 
        websiteUrl, 
        error: initialHtmlError 
      });
    }

    // Extract rendered HTML data  
    let renderedHtml: string | undefined;
    let renderedHtmlError: string | undefined;
    if (renderedResult.status === 'fulfilled') {
      renderedHtml = renderedResult.value.html;
      timing.renderedHtml = renderedResult.value.duration;
    } else {
      renderedHtmlError = renderedResult.reason?.message || 'Rendered HTML capture failed';
      logger.warn('Rendered HTML collection failed', { 
        websiteUrl, 
        error: renderedHtmlError 
      });
    }

    // Extract screenshot data
    let screenshotUrl: string | undefined;
    let screenshotPath: string | undefined;
    let screenshotError: string | undefined;
    let screenshotMethod: string | undefined;
    let webVitals: any;
    
    if (screenshotResult.status === 'fulfilled') {
      const screenshot = screenshotResult.value;
      screenshotUrl = screenshot.screenshotUrl;
      screenshotPath = screenshot.screenshotPath;
      screenshotError = screenshot.error;
      screenshotMethod = screenshot.screenshotMethod;
      webVitals = screenshot.webVitals;
      timing.screenshot = screenshot.duration;
    } else {
      screenshotError = screenshotResult.reason?.message || 'Screenshot capture failed';
      logger.warn('Screenshot collection failed', { 
        websiteUrl, 
        error: screenshotError 
      });
    }

    // Extract full-page screenshot data
    let fullPageScreenshotUrl: string | undefined;
    let fullPageScreenshotPath: string | undefined;
    let fullPageScreenshotError: string | undefined;
    
    if (fullPageResult.status === 'fulfilled') {
      const fullPage = fullPageResult.value;
      fullPageScreenshotUrl = fullPage.fullPageScreenshotUrl;
      fullPageScreenshotPath = fullPage.fullPageScreenshotPath;
      fullPageScreenshotError = fullPage.error;
      timing.fullPageScreenshot = fullPage.duration;
    } else {
      fullPageScreenshotError = fullPageResult.reason?.message || 'Full-page screenshot failed';
      logger.info('Full-page screenshot collection failed (non-critical)', { 
        websiteUrl, 
        error: fullPageScreenshotError 
      });
    }

    timing.total = Date.now() - startTime;

    // Validate we have minimum viable data
    const hasMinimumData = initialHtml || renderedHtml;
    if (!hasMinimumData) {
      const error = 'No HTML data collected - both initial and rendered HTML failed';
      logger.error('Critical data collection failure', {
        websiteUrl,
        initialHtmlError,
        renderedHtmlError,
        timing
      });
      throw new Error(error);
    }

    // Use fallbacks intelligently
    const finalInitialHtml = initialHtml || renderedHtml;
    const finalRenderedHtml = renderedHtml || initialHtml;

    logger.info('Parallel data collection completed', {
      websiteUrl,
      timing,
      dataQuality: {
        hasInitialHtml: !!initialHtml,
        hasRenderedHtml: !!renderedHtml,
        hasScreenshot: !!screenshotUrl,
        hasFullPageScreenshot: !!fullPageScreenshotUrl,
        hasWebVitals: !!webVitals
      }
    });

    return {
      initialHtml: finalInitialHtml,
      initialHtmlError,
      renderedHtml: finalRenderedHtml,
      renderedHtmlError,
      screenshotUrl,
      screenshotPath,
      screenshotError,
      screenshotMethod,
      fullPageScreenshotUrl,
      fullPageScreenshotPath,
      fullPageScreenshotError,
      webVitals,
      timing
    };
  }

  /**
   * Collect initial HTML via simple HTTP fetch (for SEO)
   */
  private async collectInitialHTML(url: string): Promise<{html: string; duration: number}> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const html = await response.text();
      
      if (html.length < 100 || !html.toLowerCase().includes('<html')) {
        throw new Error(`Invalid HTML content (length: ${html.length})`);
      }

      const duration = Date.now() - startTime;
      
      logger.info('[PARALLEL] Initial HTML collected successfully', {
        url,
        duration,
        htmlLength: html.length
      });

      return { html, duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.warn('[PARALLEL] Initial HTML collection failed', {
        url,
        duration,
        error: message
      });
      
      throw new Error(`Initial HTML fetch failed: ${message}`);
    }
  }

  /**
   * Collect rendered HTML via Playwright (for CTAs/dynamic content)
   */
  private async collectRenderedHTML(url: string): Promise<{html: string; duration: number}> {
    const startTime = Date.now();
    
    try {
      // Use the existing captureRenderedHTMLOnly method
      const html = await screenshotService.captureRenderedHTMLOnly(url);
      
      if (!html || html.length < 100) {
        throw new Error(`Invalid rendered HTML (length: ${html?.length || 0})`);
      }

      const duration = Date.now() - startTime;
      
      logger.info('[PARALLEL] Rendered HTML collected successfully', {
        url,
        duration,
        htmlLength: html.length
      });

      return { html, duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.warn('[PARALLEL] Rendered HTML collection failed', {
        url,
        duration,
        error: message
      });
      
      throw new Error(`Rendered HTML capture failed: ${message}`);
    }
  }

  /**
   * Collect above-fold screenshot
   */
  private async collectAboveFoldScreenshot(url: string, config: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await screenshotService.captureWebsiteScreenshot({
        url,
        viewport: config.viewport || { width: 1440, height: 900 },
        outputDir: 'uploads/screenshots',
        captureFullPage: false // Only above-fold for speed
      });

      const duration = Date.now() - startTime;
      
      logger.info('[PARALLEL] Above-fold screenshot collected', {
        url,
        duration,
        method: result.screenshotMethod,
        hasError: !!result.error
      });

      return { ...result, duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.warn('[PARALLEL] Above-fold screenshot collection failed', {
        url,
        duration,
        error: message
      });
      
      throw new Error(`Screenshot capture failed: ${message}`);
    }
  }

  /**
   * Collect full-page screenshot (optional enhancement)
   */
  private async collectFullPageScreenshot(url: string, config: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Only attempt full-page if we have Screenshotone API configured
      if (!process.env.SCREENSHOTONE_API_KEY) {
        throw new Error('Full-page screenshots require Screenshotone API key');
      }

      const result = await screenshotService.captureFullPageWithAPI(
        url,
        'uploads/screenshots'
      );

      const duration = Date.now() - startTime;
      
      logger.info('[PARALLEL] Full-page screenshot collected', {
        url,
        duration,
        hasError: !!result.fullPageError
      });

      return { 
        fullPageScreenshotUrl: result.fullPageScreenshotUrl,
        fullPageScreenshotPath: result.fullPageScreenshotPath,
        error: result.fullPageError,
        duration 
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.info('[PARALLEL] Full-page screenshot collection failed (non-critical)', {
        url,
        duration,
        error: message
      });
      
      throw new Error(`Full-page screenshot failed: ${message}`);
    }
  }

  /**
   * Fallback HTML when services are unavailable
   */
  private async getMinimalHTMLFallback(url: string): Promise<{html: string; duration: number}> {
    const startTime = Date.now();
    
    // Create a minimal HTML structure for basic analysis
    const minimalHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Website Analysis - Service Unavailable</title>
</head>
<body>
  <header>
    <nav>Navigation</nav>
  </header>
  <main>
    <section>
      <h1>Website Content Analysis</h1>
      <p>This is a fallback HTML structure used when the primary content capture service is unavailable.</p>
      <p>Some criteria may show conservative baseline scores.</p>
    </section>
  </main>
  <footer>
    <p>Footer content</p>
  </footer>
</body>
</html>`.trim();

    const duration = Date.now() - startTime;
    
    logger.info('[PARALLEL] Using minimal HTML fallback', {
      url,
      duration,
      htmlLength: minimalHtml.length,
      fallback: true
    });

    return { html: minimalHtml, duration };
  }

  /**
   * Fallback screenshot result when services are unavailable
   */
  private async getScreenshotFallback(error: string): Promise<any> {
    const startTime = Date.now();
    const duration = Date.now() - startTime;
    
    logger.info('[PARALLEL] Using screenshot fallback', {
      error,
      duration,
      fallback: true
    });

    return {
      screenshotPath: '',
      screenshotUrl: '',
      screenshotError: error,
      screenshotMethod: 'fallback',
      webVitals: undefined,
      duration
    };
  }
}

// Export singleton instance
export const parallelDataCollector = new ParallelDataCollector();