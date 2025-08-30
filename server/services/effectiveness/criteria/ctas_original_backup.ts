/**
 * CTAs Criterion Scorer
 * 
 * Evaluates call-to-action effectiveness: above-fold presence, message match, dominance, secondary paths
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreCTAs(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // 1. Expanded CTA text patterns (comprehensive action words)
    const ctaPatterns = [
      // Action-oriented
      /\b(get|start|try|buy|sign|join|download|request|book|schedule|claim|access|unlock|explore|discover)\b/i,
      // Engagement-oriented  
      /\b(learn|see|watch|view|read|browse|shop|compare|calculate|estimate)\b/i,
      // Contact-oriented
      /\b(contact|call|email|chat|talk|speak|connect|reach)\b/i,
      // Conversion-oriented
      /\b(demo|trial|free|quote|pricing|consultation|assessment)\b/i,
      // Navigation-oriented (still CTAs)
      /\b(more|how|why|what|solutions|services|products|plans)\b/i
    ];

    // Helper function for better CTA text extraction
    function extractCTAText(element: any): string {
      const $el = $(element);
      let text = '';
      
      // Try direct text first
      text = $el.text().trim();
      
      // If empty, look for aria-label
      if (!text) {
        text = $el.attr('aria-label') || '';
      }
      
      // If still empty, look for title
      if (!text) {
        text = $el.attr('title') || '';
      }
      
      // If still empty, look for value (for input buttons)
      if (!text) {
        text = $el.attr('value') || '';
      }
      
      // If has icon + text, get just text
      if (text) {
        // Remove icon fonts/symbols
        text = text.replace(/[\ue000-\uf8ff]/g, '').trim();
        // Remove excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();
      }
      
      return text;
    }

    // Helper function for CTA classification
    function classifyCTA(cta: any): string {
      const text = cta.text.toLowerCase();
      const classes = cta.classes.toLowerCase();
      
      // Primary indicators
      const primaryIndicators = [
        // Text patterns
        () => /^(get started|start free|try now|sign up|buy now|book now|get demo)/.test(text),
        // Class patterns
        () => /primary|main|hero|cta-main/.test(classes),
        // Position (in hero)
        () => cta.location === 'hero',
        // Size indicators
        () => /large|big|xl/.test(classes)
      ];
      
      // Secondary indicators
      const secondaryIndicators = [
        () => /(learn|read|view|see|watch) more/.test(text),
        () => /secondary|alternate|ghost|outline/.test(classes),
        () => /how|why|about|explore/.test(text)
      ];
      
      // Tertiary indicators (navigation/utility)
      const tertiaryIndicators = [
        () => /contact|support|help|login|account/.test(text),
        () => cta.location === 'footer',
        () => /utility|nav|menu/.test(classes)
      ];
      
      if (primaryIndicators.some(fn => fn())) return 'primary';
      if (secondaryIndicators.some(fn => fn())) return 'secondary';
      if (tertiaryIndicators.some(fn => fn())) return 'tertiary';
      
      return 'other';
    }

    // Helper function to calculate prominence
    function calculateProminence(cta: any): number {
      let prominence = 0;
      if (cta.location === 'hero') prominence += 3;
      if (cta.location === 'header') prominence += 2;
      if (cta.location === 'sticky') prominence += 2;
      if (cta.classes.includes('primary')) prominence += 2;
      if (cta.tag === 'button') prominence += 1;
      return prominence;
    }

    // 2. Visual CTA indicators and modern selectors
    const modernCtaSelectors = [
      // Class-based
      '[class*="cta"]', '[class*="button"]', '[class*="btn"]', '[class*="action"]', '[class*="link"]',
      
      // Styled links that look like buttons
      'a[class*="primary"]', 'a[class*="secondary"]', 'a[class*="tertiary"]',
      
      // Common frameworks
      '.btn-primary, .btn-secondary, .btn-default',
      '.button--primary, .button--secondary',
      
      // Interactive elements
      '[data-action]', '[data-click]', 'span[onclick]', 'div[role="button"]',
      
      // Standard elements
      'button', 'a', 'input[type="submit"]', '[role="button"]', '[onclick]'
    ];

    // 3. Extract CTAs by location for better context
    const ctasByLocation: { [key: string]: any[] } = {
      hero: [],
      header: [],
      main: [],
      footer: [],
      sticky: []
    };

    let allCTAs: Array<{
      text: string;
      tag: string;
      href?: string;
      classes: string;
      location: string;
      hasClickHandler?: boolean;
      dataAction?: string;
      isFormCTA?: boolean;
      formAction?: string;
      formMethod?: string;
    }> = [];

    // Hero CTAs (most important)
    $('.hero, [class*="hero"], [class*="banner"], section:first-of-type').find('a, button').each((_, el) => {
      const text = extractCTAText(el);
      const $el = $(el);
      
      if (text && (ctaPatterns.some(pattern => pattern.test(text)) || 
          $el.attr('class')?.includes('cta') || 
          $el.attr('class')?.includes('btn')) &&
          text.length > 2 && text.length < 50) {
        const cta = {
          text,
          tag: el.tagName.toLowerCase(),
          href: $el.attr('href') || $el.attr('data-href') || '#',
          classes: $el.attr('class') || '',
          location: 'hero'
        };
        allCTAs.push(cta);
        ctasByLocation.hero.push(cta);
      }
    });

    // Header/Navigation CTAs
    $('nav, header').find('a, button').each((_, el) => {
      const $el = $(el);
      const text = extractCTAText(el);
      
      // Look for action-oriented nav items
      if (text && text.match(/contact|demo|trial|pricing|get started|sign up|log in|get|try|buy/i)) {
        const cta = {
          text,
          tag: el.tagName.toLowerCase(),
          href: $el.attr('href') || '#',
          classes: $el.attr('class') || '',
          location: 'header'
        };
        allCTAs.push(cta);
        ctasByLocation.header.push(cta);
      }
    });

    // Sticky/Fixed CTAs
    $('[style*="fixed"], [style*="sticky"], .sticky, .fixed').find('a, button').each((_, el) => {
      const text = extractCTAText(el);
      const $el = $(el);
      
      if (text && text.length > 2 && text.length < 50) {
        const cta = {
          text,
          tag: el.tagName.toLowerCase(),
          href: $el.attr('href') || '#',
          classes: $el.attr('class') || '',
          location: 'sticky'
        };
        allCTAs.push(cta);
        ctasByLocation.sticky.push(cta);
      }
    });

    // 4 & 6. Main content CTAs with modern patterns and click handlers
    modernCtaSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $el = $(element);
        const text = extractCTAText(element);
        
        // Skip if already captured in hero/header/sticky
        if ($el.closest('.hero, [class*="hero"], nav, header, [class*="sticky"], .sticky').length) {
          return;
        }
        
        if (text && (ctaPatterns.some(pattern => pattern.test(text)) || 
            $el.attr('class')?.match(/btn|button|cta/i)) &&
            text.length > 2 && text.length < 50) {
          
          const location = $el.closest('footer').length ? 'footer' : 'main';
          
          const cta: any = {
            text,
            tag: (element as any).tagName?.toLowerCase() || 'unknown',
            href: $el.attr('href') || $el.attr('data-href') || '#',
            classes: $el.attr('class') || '',
            location
          };

          // Check for click handlers
          if ($el.attr('onclick') || $el.attr('data-action') || $el.attr('data-toggle')) {
            cta.hasClickHandler = true;
            cta.dataAction = $el.attr('data-action') || $el.attr('onclick');
          }

          allCTAs.push(cta);
          ctasByLocation[location].push(cta);
        }
      });
    });

    // Check styled links that look like buttons
    $('a').each((_, el) => {
      const $el = $(el);
      const classes = $el.attr('class') || '';
      const style = $el.attr('style') || '';
      const text = extractCTAText(el);
      
      // Skip if already processed
      if (allCTAs.some(cta => cta.text === text)) return;
      
      // Check if it looks like a button (has padding, background, etc.)
      if ((classes.match(/btn|button|cta/i) || 
          style.includes('padding') || 
          style.includes('background')) &&
          text && text.length > 2 && text.length < 50) {
        
        const location = $el.closest('footer').length ? 'footer' : 
                        $el.closest('.hero, [class*="hero"]').length ? 'hero' : 'main';
        
        allCTAs.push({
          text,
          tag: 'a',
          href: $el.attr('href') || '#',
          classes,
          location
        });
      }
    });

    // Handle forms with submit buttons
    $('form').each((_, form) => {
      const $form = $(form);
      const submitBtn = $form.find('button[type="submit"], input[type="submit"], button:not([type="button"])').first();
      
      if (submitBtn.length) {
        const text = extractCTAText(submitBtn[0]) || 'Submit';
        allCTAs.push({
          text,
          tag: 'form-submit',
          formAction: $form.attr('action'),
          formMethod: $form.attr('method'),
          classes: submitBtn.attr('class') || '',
          isFormCTA: true,
          location: 'main'
        });
      }
    });

    // 7. Smart deduplication with intelligence
    const uniqueCTAs = allCTAs.reduce((acc: any[], cta) => {
      // Check if we already have this CTA text
      const existing = acc.find(c => 
        c.text.toLowerCase() === cta.text.toLowerCase()
      );
      
      if (!existing) {
        acc.push(cta);
      } else {
        // Keep the one with more information
        if (cta.href && !existing.href) {
          existing.href = cta.href;
        }
        if (cta.classes && !existing.classes) {
          existing.classes = cta.classes;
        }
        // Prefer hero/header CTAs over footer
        if (cta.location === 'hero' && existing.location !== 'hero') {
          existing.location = cta.location;
        }
      }
      
      return acc;
    }, []);

    // Add type classification and prominence to each CTA
    const processedCTAs = uniqueCTAs.map(cta => ({
      ...cta,
      type: classifyCTA(cta),
      prominence: calculateProminence(cta)
    }));

    // Filter CTAs by type using the new classification system
    const aboveFoldCTAs = processedCTAs.filter(cta => 
      cta.location === 'hero' || cta.location === 'header' || cta.location === 'sticky'
    );
    
    // Analyze CTA hierarchy using enhanced classification
    const primaryCTAs = processedCTAs.filter(cta => cta.type === 'primary');
    const secondaryCTAs = processedCTAs.filter(cta => cta.type === 'secondary');
    const tertiaryCTAs = processedCTAs.filter(cta => cta.type === 'tertiary');

    // Enhanced message consistency check
    let messageMatchScore = 0;
    let messageMatchChecks = 0;

    // Check the most prominent CTAs for message consistency
    const topCTAs = processedCTAs
      .sort((a, b) => b.prominence - a.prominence)
      .slice(0, 3);

    if (topCTAs.length > 0) {
      topCTAs.forEach(cta => {
        if (cta.href && !cta.href.startsWith('#') && !cta.href.startsWith('mailto:')) {
          // Enhanced message consistency criteria
          const hasGoodLength = cta.text.length >= 3 && cta.text.length <= 50;
          const hasActionVerb = ctaPatterns.some(pattern => pattern.test(cta.text));
          const isNotGeneric = !cta.text.match(/^(click|here|link|more)$/i);
          
          if (hasGoodLength && hasActionVerb && isNotGeneric) {
            messageMatchScore += 1;
          }
          messageMatchChecks += 1;
        }
      });
      
      // Normalize score
      if (messageMatchChecks > 0) {
        messageMatchScore = messageMatchScore / messageMatchChecks;
      }
    }

    // Enhanced visual hierarchy analysis
    const hasVisualHierarchy = primaryCTAs.length >= 1 && primaryCTAs.length <= 3;
    const hasSecondaryPaths = secondaryCTAs.length >= 1 || tertiaryCTAs.length >= 1;


    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Above-fold CTA presence (33% of score - 3.33 points)
    if (aboveFoldCTAs.length >= 2) {
      score += 3.33;
      passes.passed.push('multiple_above_fold_ctas');
    } else if (aboveFoldCTAs.length >= 1) {
      score += 2.22;
      passes.passed.push('above_fold_cta_present');
    } else {
      passes.failed.push('no_above_fold_cta');
    }

    // CTA dominance and hierarchy (28% of score - 2.78 points)
    if (hasVisualHierarchy && primaryCTAs.length >= 1) {
      score += 2.78;
      passes.passed.push('clear_cta_hierarchy');
    } else if (primaryCTAs.length >= 1) {
      score += 1.67;
      passes.passed.push('primary_cta_present');
    } else {
      passes.failed.push('no_clear_hierarchy');
    }

    // Secondary paths (22% of score - 2.22 points)
    if (hasSecondaryPaths) {
      score += 2.22;
      passes.passed.push('secondary_paths_available');
    } else {
      passes.failed.push('no_secondary_paths');
    }

    // Message match (17% of score - 1.67 points)
    if (messageMatchChecks > 0 && messageMatchScore > 0) {
      score += 1.67;
      passes.passed.push('message_match_verified');
    } else if (uniqueCTAs.length > 0) {
      score += 0.83; // Partial credit for having CTAs
      passes.passed.push('ctas_present');
    } else {
      passes.failed.push('message_mismatch');
    }


    score = Math.min(10, Math.max(0, score));

    logger.info("Completed enhanced CTA analysis", {
      url: context.websiteUrl,
      score,
      totalCTAs: processedCTAs.length,
      aboveFoldCTAs: aboveFoldCTAs.length,
      primaryCTAs: primaryCTAs.length,
      secondaryCTAs: secondaryCTAs.length,
      tertiaryCTAs: tertiaryCTAs.length,
      ctasByLocation: {
        hero: ctasByLocation.hero.length,
        header: ctasByLocation.header.length,
        main: ctasByLocation.main.length,
        footer: ctasByLocation.footer.length,
        sticky: ctasByLocation.sticky.length
      },
      messageMatchScore,
      topCTAs: topCTAs.map(cta => ({ text: cta.text, type: cta.type, prominence: cta.prominence })).slice(0, 3)
    });

    return {
      criterion: 'ctas',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Enhanced CTA analysis: ${processedCTAs.length} total CTAs, ${aboveFoldCTAs.length} above-fold, ${primaryCTAs.length} primary, ${secondaryCTAs.length} secondary, ${tertiaryCTAs.length} tertiary`,
        details: {
          totalCTAs: processedCTAs.length,
          ctasByLocation: {
            hero: ctasByLocation.hero.length,
            header: ctasByLocation.header.length,
            main: ctasByLocation.main.length,
            footer: ctasByLocation.footer.length,
            sticky: ctasByLocation.sticky.length
          },
          aboveFoldCTAs: aboveFoldCTAs.length,
          primaryCTAs: primaryCTAs.map(cta => ({ text: cta.text, location: cta.location })).slice(0, 3),
          secondaryCTAs: secondaryCTAs.map(cta => ({ text: cta.text, location: cta.location })).slice(0, 3),
          tertiaryCTAs: tertiaryCTAs.map(cta => ({ text: cta.text, location: cta.location })).slice(0, 2),
          topCTAsByProminence: topCTAs.map(cta => ({ 
            text: cta.text, 
            type: cta.type, 
            prominence: cta.prominence,
            location: cta.location 
          })).slice(0, 3),
          hasVisualHierarchy,
          messageMatchScore,
          messageMatchChecks,
          modernCTAsDetected: processedCTAs.filter(cta => 
            cta.hasClickHandler || cta.classes.includes('btn') || cta.classes.includes('button')
          ).length
        },
        reasoning: `Enhanced score based on above-fold presence (${aboveFoldCTAs.length} CTAs across hero/header/sticky), visual hierarchy (${hasVisualHierarchy ? 'clear' : 'unclear'} with ${primaryCTAs.length} primary CTAs), secondary paths (${hasSecondaryPaths ? 'available' : 'missing'} with ${secondaryCTAs.length + tertiaryCTAs.length} secondary/tertiary CTAs), and message consistency (${Math.round(messageMatchScore * 100)}% of top CTAs)`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in CTA analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'ctas',
      score: 0,
      evidence: {
        description: 'Error analyzing CTAs',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete CTA analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}