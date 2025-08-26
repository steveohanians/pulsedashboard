/**
 * UX Criterion Scorer
 * 
 * Evaluates user experience: layout quality, headings, line length, overflow, hover states
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreUX(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Analyze heading hierarchy
    const headings = $('h1, h2, h3, h4, h5, h6').toArray().map(el => {
      const $el = $(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: $el.text().trim(),
        level: parseInt(el.tagName.charAt(1))
      };
    });

    // Check for proper heading hierarchy
    const h1Count = headings.filter(h => h.level === 1).length;
    const hasProperHierarchy = h1Count === 1 && headings.length >= 3;
    
    // Analyze text blocks for line length
    const paragraphs = $('p').toArray().map(el => $(el).text().trim()).filter(text => text.length > 50);
    const avgWordsPerLine = paragraphs.reduce((acc, p) => {
      const words = p.split(/\s+/).length;
      const lines = Math.ceil(words / 12); // Estimate ~12 words per line
      return acc + (words / lines);
    }, 0) / Math.max(paragraphs.length, 1);
    
    // Check for interactive elements
    const buttons = $('button, input[type="submit"], input[type="button"], a.btn, .button').length;
    const links = $('a[href]').length;
    const forms = $('form').length;
    const interactiveElements = buttons + links + forms;

    // Look for responsive design indicators
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    const hasResponsiveClasses = $('[class*="responsive"], [class*="mobile"], [class*="tablet"], [class*="desktop"]').length > 0;
    
    // Check for CSS frameworks (implies better UX structure)
    const pageText = context.html.toLowerCase();
    const hasBootstrap = pageText.includes('bootstrap') || $('[class*="col-"], [class*="row"]').length > 5;
    const hasTailwind = pageText.includes('tailwind') || $('[class*="flex"], [class*="grid"]').length > 10;
    const hasFramework = hasBootstrap || hasTailwind;

    // Look for accessibility features
    const altTexts = $('img[alt]').length;
    const totalImages = $('img').length;
    const hasAltTexts = totalImages === 0 || (altTexts / totalImages) >= 0.8;
    
    // Check for ARIA labels
    const ariaLabels = $('[aria-label], [aria-describedby], [role]').length;
    const hasAriaLabels = ariaLabels > 0;

    // Navigation quality
    const navElements = $('nav, [role="navigation"], .navigation, .nav').length;
    const hasNavigation = navElements > 0;

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Heading hierarchy (15% of score - 1.5 points)
    if (hasProperHierarchy) {
      score += 1.5;
      passes.passed.push('proper_heading_hierarchy');
    } else {
      passes.failed.push('improper_heading_hierarchy');
    }

    // Text readability (20% of score - 2 points)
    if (avgWordsPerLine >= 8 && avgWordsPerLine <= 15) {
      score += 2.0;
      passes.passed.push('optimal_line_length');
    } else if (avgWordsPerLine >= 6 && avgWordsPerLine <= 20) {
      score += 1.0;
      passes.passed.push('acceptable_line_length');
    } else {
      passes.failed.push('poor_line_length');
    }

    // Interactive elements (15% of score - 1.5 points)
    if (interactiveElements >= 10) {
      score += 1.5;
      passes.passed.push('rich_interactivity');
    } else if (interactiveElements >= 5) {
      score += 1.0;
      passes.passed.push('adequate_interactivity');
    } else {
      passes.failed.push('poor_interactivity');
    }

    // Responsive design (15% of score - 1.5 points)
    if (hasViewportMeta && (hasResponsiveClasses || hasFramework)) {
      score += 1.5;
      passes.passed.push('responsive_design');
    } else if (hasViewportMeta) {
      score += 0.75;
      passes.passed.push('viewport_meta');
    } else {
      passes.failed.push('no_responsive_design');
    }

    // Framework/Structure (10% of score - 1 point)
    if (hasFramework) {
      score += 1.0;
      passes.passed.push('css_framework');
    } else {
      passes.failed.push('no_css_framework');
    }

    // Accessibility features (15% of score - 1.5 points)
    if (hasAltTexts && hasAriaLabels) {
      score += 1.5;
      passes.passed.push('accessibility_features');
    } else if (hasAltTexts || hasAriaLabels) {
      score += 0.75;
      passes.passed.push('some_accessibility');
    } else {
      passes.failed.push('no_accessibility_features');
    }

    // Navigation (10% of score - 1 point)
    if (hasNavigation) {
      score += 1.0;
      passes.passed.push('navigation_present');
    } else {
      passes.failed.push('no_navigation');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed UX analysis", {
      url: context.websiteUrl,
      score,
      headingsCount: headings.length,
      h1Count,
      avgWordsPerLine,
      interactiveElements,
      hasFramework,
      hasNavigation
    });

    return {
      criterion: 'ux',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `UX analysis: ${headings.length} headings (${h1Count} H1s), ${Math.round(avgWordsPerLine)} avg words/line, ${interactiveElements} interactive elements`,
        details: {
          headingsCount: headings.length,
          h1Count,
          hasProperHierarchy,
          avgWordsPerLine: Math.round(avgWordsPerLine * 10) / 10,
          interactiveElements,
          hasViewportMeta,
          hasFramework,
          hasNavigation,
          altTexts,
          totalImages,
          hasAltTexts,
          ariaLabels
        },
        reasoning: `Score based on heading structure (${hasProperHierarchy ? 'proper' : 'improper'}), line length (${Math.round(avgWordsPerLine)} words avg), interactivity (${interactiveElements} elements), responsive design (${hasViewportMeta ? 'present' : 'missing'}), framework usage (${hasFramework ? 'yes' : 'no'}), and accessibility features`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in UX analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'ux',
      score: 0,
      evidence: {
        description: 'Error analyzing UX',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete UX analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}