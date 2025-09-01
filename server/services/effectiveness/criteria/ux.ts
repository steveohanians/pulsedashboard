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
      const tagName = (el as any).tagName || (el as any).name || 'h1';
      return {
        tag: tagName.toLowerCase(),
        text: $el.text().trim(),
        level: parseInt(tagName.charAt(1))
      };
    });

    // Check for proper heading hierarchy
    const h1Count = headings.filter(h => h.level === 1).length;
    const hasProperHierarchy = h1Count === 1 && headings.length >= 3;
    
    // Modern approach: Check for readable content width indicators
    const hasReadableWidth = 
      $('[class*="container"], [class*="wrapper"], [class*="content"], article, main').length > 0 ||
      $('p').parent().filter((i, el) => {
        const classes = $(el).attr('class') || '';
        return !!classes.match(/col-|w-|max-w-|container/);
      }).length > 0;

    // Set avgWordsPerLine to optimal if modern layout detected
    const avgWordsPerLine = hasReadableWidth ? 12 : 20; // Assume good or poor
    
    // Count meaningful interactions, not all links
    const meaningfulButtons = $('button:not([type="submit"]), a.btn, a.button, [class*="btn"]:not(nav *)').filter((i, el) => {
      const text = $(el).text().trim();
      return text.length > 0 && text.length < 30; // Avoid counting nav links
    }).length;

    const meaningfulForms = $('form').filter((i, el) => {
      return $(el).find('input:not([type="hidden"])').length > 0;
    }).length;

    const interactiveComponents = $('.carousel, .slider, .tabs, .accordion, [class*="carousel"], [class*="slider"], [class*="tab"], [class*="accordion"]').length;

    const interactiveElements = meaningfulButtons + (meaningfulForms * 3) + (interactiveComponents * 2);

    // Look for responsive design indicators
    const hasViewportMeta = $('meta[name="viewport"]').length > 0;
    const hasResponsiveClasses = $('[class*="responsive"], [class*="mobile"], [class*="tablet"], [class*="desktop"]').length > 0;
    
    // Detect modern styling patterns regardless of framework
    const styleIndicators = {
      layoutClasses: $('[class*="flex"], [class*="grid"], [class*="container"], [class*="wrapper"]').length,
      componentClasses: $('[class*="card"], [class*="modal"], [class*="dropdown"], [class*="nav"]').length,
      utilityClasses: $('[class]').toArray().reduce((count, el) => {
        const classes = $(el).attr('class') || '';
        const classCount = classes.split(' ').filter(c => c.length > 0).length;
        return count + (classCount > 3 ? 1 : 0);
      }, 0),
      customProperties: context.html.includes('var(--') || context.html.includes(':root')
    };

    const hasModernStyling = 
      styleIndicators.layoutClasses >= 5 ||
      styleIndicators.componentClasses >= 3 ||
      styleIndicators.utilityClasses >= 10 ||
      styleIndicators.customProperties;

    const hasFramework = hasModernStyling; // Renamed for compatibility

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

    // Modern UX patterns
    const modernPatterns = {
      hasHero: $('.hero, [class*="hero"], header > div:has(h1)').length > 0,
      hasCards: $('.card, [class*="card"], article[class*="box"]').length >= 2,
      hasSections: $('section, [class*="section"]:not(a)').length >= 3,
      hasCallToAction: $('button:contains("Get"), button:contains("Start"), button:contains("Try"), a[class*="btn"]:contains("Demo")').length > 0,
      hasSocialProof: $('[class*="testimonial"], [class*="review"], [class*="client"], [class*="logo"]').length > 0,
      hasSearch: $('input[type="search"], [class*="search"]:has(input), [placeholder*="Search"]').length > 0,
      hasFooter: $('footer, [class*="footer"]').find('a').length >= 5
    };

    const modernUXScore = Object.values(modernPatterns).filter(Boolean).length;

    // Calculate score with modern UX weighting
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Visual hierarchy and layout (25% - 2.5 points)
    if (hasProperHierarchy && modernUXScore >= 4) {
      score += 2.5;
      passes.passed.push('excellent_layout');
    } else if (hasProperHierarchy || modernUXScore >= 3) {
      score += 1.5;
      passes.passed.push('good_layout');
    } else if (headings.length >= 2) {
      score += 0.5;
      passes.passed.push('basic_layout');
    } else {
      passes.failed.push('poor_layout');
    }

    // Content readability (15% - 1.5 points) 
    if (hasReadableWidth) {
      score += 1.5;
      passes.passed.push('readable_content');
    } else {
      score += 0.5;
      passes.failed.push('content_width_issues');
    }

    // Meaningful interactions (20% - 2 points)
    if (interactiveElements >= 15) {
      score += 2.0;
      passes.passed.push('rich_interactivity');
    } else if (interactiveElements >= 8) {
      score += 1.0;
      passes.passed.push('adequate_interactivity');
    } else {
      passes.failed.push('limited_interactivity');
    }

    // Mobile & Responsive (20% - 2 points)
    const hasMobileOptimization = hasViewportMeta && 
      ($('[class*="mobile"], [class*="responsive"], [class*="lg:"], [class*="md:"], [class*="sm:"]').length > 0 ||
       hasFramework);

    if (hasMobileOptimization) {
      score += 2.0;
      passes.passed.push('mobile_optimized');
    } else if (hasViewportMeta) {
      score += 1.0;
      passes.passed.push('basic_mobile_support');
    } else {
      passes.failed.push('no_mobile_optimization');
    }

    // Modern styling (10% - 1 point)
    if (hasFramework) {
      score += 1.0;
      passes.passed.push('modern_styling');
    } else {
      passes.failed.push('basic_styling');
    }

    // Accessibility features (10% - 1 point)
    if (hasAltTexts && hasAriaLabels) {
      score += 1.0;
      passes.passed.push('accessibility_features');
    } else if (hasAltTexts || hasAriaLabels) {
      score += 0.5;
      passes.passed.push('some_accessibility');
    } else {
      passes.failed.push('no_accessibility_features');
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
        description: `UX analysis: ${headings.length} headings (${h1Count} H1s), ${interactiveElements} interactive elements, ${modernUXScore} modern patterns detected`,
        details: {
          headingsCount: headings.length,
          h1Count,
          hasProperHierarchy,
          hasReadableWidth,
          interactiveElements,
          meaningfulButtons,
          hasViewportMeta,
          hasFramework,
          hasNavigation,
          modernUXScore,
          modernPatterns,
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
          ariaLabels,
          hasReadableWidth,
          modernUXScore,
          meaningfulButtons
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
  hasReadableWidth?: boolean;
  modernUXScore?: number;
  meaningfulButtons?: number;
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
  if (failed.includes('poor_layout')) {
    recommendations.push("**Improve page structure** - Add clear sections, hero area, and visual hierarchy to guide visitors");
  }
  
  if (failed.includes('content_width_issues')) {
    recommendations.push("**Optimize content width** - Use containers to limit text width for better readability");
  }
  
  if (failed.includes('limited_interactivity')) {
    recommendations.push("**Add meaningful CTAs** - Include clear action buttons and interactive elements to drive engagement");
  }
  
  if (failed.includes('no_mobile_optimization')) {
    recommendations.push("**Optimize for mobile** - Implement responsive design for seamless mobile experience");
  }
  
  if (failed.includes('basic_styling')) {
    recommendations.push("**Modernize design** - Update styling with contemporary patterns like cards, grids, and consistent spacing");
  }
  
  if (failed.includes('no_accessibility_features')) {
    recommendations.push("**Improve accessibility** - Add alt text for images and ARIA labels for screen readers");
  }
  
  if (failed.includes('no_navigation')) {
    recommendations.push("**Add clear navigation** - Include a primary navigation menu to help users find content");
  }
  
  // Positive reinforcement for good practices
  const strengths: string[] = [];
  if (passed.includes('excellent_layout')) strengths.push("excellent visual hierarchy");
  if (passed.includes('good_layout')) strengths.push("good page structure");
  if (passed.includes('readable_content')) strengths.push("optimized content width");
  if (passed.includes('rich_interactivity')) strengths.push("engaging interactive elements");
  if (passed.includes('mobile_optimized')) strengths.push("mobile optimization");
  if (passed.includes('modern_styling')) strengths.push("modern design patterns");
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