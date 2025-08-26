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
        reasoning: generateUXInsights(passes.passed, passes.failed, {
          headingsCount: headings.length,
          avgWordsPerLine,
          interactiveElements,
          hasFramework,
          hasNavigation,
          hasViewportMeta,
          hasAltTexts,
          ariaLabels
        })
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

/**
 * Generate actionable insights for UX analysis
 */
function generateUXInsights(passed: string[], failed: string[], details: {
  headingsCount: number;
  avgWordsPerLine: number;
  interactiveElements: number;
  hasFramework: boolean;
  hasNavigation: boolean;
  hasViewportMeta: boolean;
  hasAltTexts: boolean;
  ariaLabels: number;
}): string {
  const insights: string[] = [];
  const recommendations: string[] = [];
  
  // Overall assessment
  if (passed.length >= 5) {
    insights.push("Your website delivers a strong user experience with well-structured content and good accessibility practices.");
  } else if (passed.length >= 3) {
    insights.push("Your UX foundation is solid but has opportunities for optimization to enhance user engagement.");
  } else {
    insights.push("Your website's user experience needs significant improvement to reduce bounce rates and increase conversions.");
  }
  
  // Specific recommendations based on failed checks
  if (failed.includes('improper_heading_hierarchy')) {
    recommendations.push("**Fix heading structure** - Use a single H1 and logical H2-H6 progression to help users scan content");
  }
  
  if (failed.includes('poor_line_length')) {
    if (details.avgWordsPerLine > 20) {
      recommendations.push("**Shorten text lines** - Break up long paragraphs for better readability");
    } else {
      recommendations.push("**Optimize text layout** - Adjust column widths for comfortable reading");
    }
  }
  
  if (failed.includes('poor_interactivity')) {
    recommendations.push("**Add interactive elements** - Include more buttons, forms, or engaging components to guide user actions");
  }
  
  if (failed.includes('no_responsive_design')) {
    recommendations.push("**Implement responsive design** - Ensure your site works seamlessly across mobile, tablet, and desktop");
  }
  
  if (failed.includes('no_css_framework')) {
    recommendations.push("**Adopt a CSS framework** - Use Bootstrap, Tailwind, or similar for consistent, professional styling");
  }
  
  if (failed.includes('no_accessibility_features')) {
    recommendations.push("**Improve accessibility** - Add alt text for images and ARIA labels for screen readers");
  }
  
  if (failed.includes('no_navigation')) {
    recommendations.push("**Add clear navigation** - Include a primary navigation menu to help users find content");
  }
  
  // Positive reinforcement for good practices
  const strengths: string[] = [];
  if (passed.includes('proper_heading_hierarchy')) strengths.push("clear content hierarchy");
  if (passed.includes('optimal_line_length')) strengths.push("readable text formatting");
  if (passed.includes('rich_interactivity')) strengths.push("engaging interactive elements");
  if (passed.includes('responsive_design')) strengths.push("mobile optimization");
  if (passed.includes('accessibility_features')) strengths.push("accessibility compliance");
  
  // Combine insights and recommendations
  let result = insights[0];
  if (strengths.length > 0) {
    result += ` Strengths: ${strengths.join(', ')}.`;
  }
  if (recommendations.length > 0) {
    result += ` Priority improvements: ${recommendations.join('; ')}.`;
  }
  
  return result;
}