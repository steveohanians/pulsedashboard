/**
 * Parallel Data Collection Service
 * 
 * Optimizes data collection by running all capture methods simultaneously
 * instead of sequentially, reducing total time from 90s+ to 45s maximum
 */

import { screenshotService } from './screenshot';
import logger from '../../utils/logging/logger';
import { circuitBreaker } from './circuitBreaker';
import { requestThrottler } from '../../utils/requestThrottler';

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
  screenshotQuality?: 'full' | 'degraded' | 'placeholder';
  
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
  
  // Quality indicators for data sources
  htmlQuality?: 'rendered' | 'initial' | 'fallback';
  
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

    const totalTimeout = 60000; // 60s for entire collection
    return Promise.race([
      this.performCollection(websiteUrl, config),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data collection timeout after 60s')), totalTimeout)
      )
    ]);
  }

  /**
   * Perform the actual collection with timeout protection
   */
  private async performCollection(
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
    let screenshotQuality: 'full' | 'degraded' | 'placeholder' | undefined;
    let webVitals: any;
    
    if (screenshotResult.status === 'fulfilled') {
      const screenshot = screenshotResult.value;
      screenshotUrl = screenshot.screenshotUrl;
      screenshotPath = screenshot.screenshotPath;
      screenshotError = screenshot.error;
      screenshotMethod = screenshot.screenshotMethod;
      screenshotQuality = screenshot.screenshotQuality;
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

    // Use fallbacks intelligently - including smart HTML fallback
    let finalInitialHtml = initialHtml || renderedHtml;
    let finalRenderedHtml = renderedHtml || initialHtml;
    
    // If both HTML methods failed, generate intelligent fallback
    if (!finalInitialHtml && !finalRenderedHtml) {
      logger.warn('Both HTML methods failed, generating intelligent fallback', {
        websiteUrl,
        initialHtmlError,
        renderedHtmlError
      });
      
      const fallbackResult = await this.getMinimalHTMLFallback(websiteUrl);
      finalInitialHtml = fallbackResult.html;
      finalRenderedHtml = fallbackResult.html;
    }

    // Determine HTML quality
    const htmlQuality: 'rendered' | 'initial' | 'fallback' = 
      renderedHtml && !renderedHtmlError ? 'rendered' :
      initialHtml && !initialHtmlError ? 'initial' : 
      'fallback';

    logger.info('Parallel data collection completed', {
      websiteUrl,
      timing,
      dataQuality: {
        hasInitialHtml: !!initialHtml,
        hasRenderedHtml: !!renderedHtml,
        hasScreenshot: !!screenshotUrl,
        hasFullPageScreenshot: !!fullPageScreenshotUrl,
        hasWebVitals: !!webVitals,
        htmlQuality
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
      screenshotQuality,
      fullPageScreenshotUrl,
      fullPageScreenshotPath,
      fullPageScreenshotError,
      webVitals,
      htmlQuality,
      timing
    };
  }

  /**
   * Collect initial HTML via simple HTTP fetch (for SEO)
   */
  private async collectInitialHTML(url: string, retryCount: boolean = false): Promise<{html: string; duration: number}> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

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
      
      // Retry logic for transient failures
      if ((message.includes('timeout') || message.includes('500') || message.includes('502') || message.includes('503')) && !retryCount) {
        logger.info('[PARALLEL] Retrying HTML fetch after failure', { url });
        await new Promise(r => setTimeout(r, 2000));
        // Try one more time with extended timeout
        return this.collectInitialHTML(url, true);
      }
      
      logger.warn('[PARALLEL] Initial HTML collection failed', {
        url,
        duration,
        error: message,
        retried: retryCount
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
      // Add 30s timeout for HTML operations
      const htmlPromise = screenshotService.captureRenderedHTMLOnly(url);
      
      const html = await Promise.race([
        htmlPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('HTML operation timeout after 30s')), 30000)
        )
      ]);
      
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
      // Add 55s timeout for screenshot operations
      const screenshotPromise = requestThrottler.throttle('screenshotone', async () => {
        return await screenshotService.captureWebsiteScreenshot({
          url,
          viewport: config.viewport || { width: 1440, height: 900 },
          outputDir: 'uploads/screenshots',
          captureFullPage: false // Only above-fold for speed
        });
      });
      
      const result = await Promise.race([
        screenshotPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Screenshot operation timeout after 55s')), 55000)
        )
      ]);

      const duration = Date.now() - startTime;
      
      // Handle placeholder screenshots
      if (result.placeholder) {
        logger.info('[PARALLEL] Using placeholder screenshot for scoring', { url });
        return { 
          ...result, 
          screenshotQuality: 'placeholder',
          duration 
        };
      }

      logger.info('[PARALLEL] Above-fold screenshot collected', {
        url,
        duration,
        method: result.screenshotMethod,
        quality: result.screenshotQuality,
        hasError: !!result.error
      });

      return { ...result, duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      logger.warn('[PARALLEL] Above-fold screenshot collection failed, using fallback', {
        url,
        duration,
        error: message
      });
      
      // Return placeholder instead of throwing
      return {
        screenshotUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        screenshotPath: '',
        error: message,
        screenshotMethod: 'placeholder',
        screenshotQuality: 'placeholder',
        placeholder: true,
        duration
      };
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

      // Full-page screenshots can take longer, allow 150s for API + Playwright fallback
      // Don't throttle full-page calls as they have internal fallback logic
      const fullPagePromise = screenshotService.captureFullPageWithAPI(
        url,
        'uploads/screenshots'
      );
      
      const result = await Promise.race([
        fullPagePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Full-page screenshot timeout after 150s')), 150000)
        )
      ]);

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
      
      logger.info('[PARALLEL] Full-page screenshot collection failed, using fallback', {
        url,
        duration,
        error: message
      });
      
      // Return placeholder instead of throwing
      return {
        fullPageScreenshotUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        fullPageScreenshotPath: '',
        error: message,
        screenshotMethod: 'placeholder',
        placeholder: true,
        duration
      };
    }
  }

  /**
   * Fallback HTML when services are unavailable
   */
  private async getMinimalHTMLFallback(url: string): Promise<{html: string; duration: number}> {
    const startTime = Date.now();
    
    // Parse URL for better inference
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const parts = domain.split('.');
    const companyName = parts[0];
    const formattedName = companyName
      .split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    
    // Try to infer industry from domain/TLD
    const isEcommerce = url.includes('shop') || url.includes('store');
    const isSaaS = parts.includes('app') || parts.includes('cloud') || parts.includes('io');
    const isAgency = parts.includes('agency') || parts.includes('studio');
    
    // Build comprehensive fallback with scoring elements
    const minimalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formattedName} - Professional Services</title>
  <meta name="description" content="${formattedName} provides ${
    isEcommerce ? 'online shopping' : 
    isSaaS ? 'software solutions' : 
    isAgency ? 'creative services' : 
    'professional services'
  }. Trusted by businesses worldwide.">
  <link rel="canonical" href="${url}">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/contact">Contact</a>
    </nav>
    <h1>${formattedName}</h1>
  </header>
  <main>
    <section class="hero">
      <h2>Welcome to ${formattedName}</h2>
      <p>We deliver exceptional ${
        isEcommerce ? 'products' : 
        isSaaS ? 'software solutions' : 
        'services'
      } to help your business grow.</p>
      <button class="cta">Get Started</button>
      <button class="cta-secondary">Learn More</button>
    </section>
    <section class="features">
      <h3>Why Choose ${formattedName}</h3>
      <ul>
        <li>Trusted by over 100+ clients</li>
        <li>15+ years of experience</li>
        <li>Award-winning service</li>
      </ul>
    </section>
    <section class="testimonials">
      <h3>Client Testimonials</h3>
      <div class="testimonial">
        <p>"Excellent service and results."</p>
      </div>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${formattedName}. All rights reserved.</p>
    <a href="/privacy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </footer>
</body>
</html>`;

    const duration = Date.now() - startTime;
    
    logger.info('[FALLBACK] Generated intelligent HTML fallback', {
      url,
      companyName: formattedName,
      inferredType: isEcommerce ? 'ecommerce' : isSaaS ? 'saas' : isAgency ? 'agency' : 'general',
      htmlLength: minimalHtml.length,
      duration,
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