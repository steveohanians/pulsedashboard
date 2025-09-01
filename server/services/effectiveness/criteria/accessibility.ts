/**
 * Accessibility Criterion Scorer
 * 
 * Evaluates accessibility: focus management, contrast, landmarks, keyboard navigation
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreAccessibility(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Check for semantic HTML structure
    const semanticElements = [
      'header', 'nav', 'main', 'article', 'section', 'aside', 'footer'
    ];
    const semanticCount = semanticElements.reduce((count, tag) => 
      count + $(tag).length, 0
    );
    const hasSemanticStructure = semanticCount >= 3;

    // Check for ARIA attributes
    const ariaAttributes = [
      '[aria-label]', '[aria-labelledby]', '[aria-describedby]', 
      '[aria-expanded]', '[aria-hidden]', '[role]'
    ];
    const ariaCount = ariaAttributes.reduce((count, selector) => 
      count + $(selector).length, 0
    );
    const hasAriaLabels = ariaCount >= 5;

    // Check for modern ARIA patterns
    const hasAriaLive = $('[aria-live]').length > 0;
    const hasAriaCurrent = $('[aria-current]').length > 0;
    const hasAriaExpanded = $('[aria-expanded]').length > 0;
    const modernAriaScore = [hasAriaLive, hasAriaCurrent, hasAriaExpanded].filter(Boolean).length;

    // Check image alt text coverage
    const images = $('img');
    const imagesWithAlt = $('img[alt]');
    const imagesWithEmptyAlt = $('img[alt=""]');
    const decorativeImages = imagesWithEmptyAlt.length;
    const totalImages = images.length;
    const altTextCoverage = totalImages === 0 ? 1 : 
      (imagesWithAlt.length) / totalImages;
    const hasGoodAltTexts = altTextCoverage >= 0.9;

    // Check for meaningful alt text (not just present)
    const meaningfulAltTexts = imagesWithAlt.filter((_, el) => {
      const alt = $(el).attr('alt') || '';
      // Check if alt text is not placeholder text
      return alt.length > 3 && 
             !alt.match(/^(image|img|photo|picture|icon|logo)\d*$/i) &&
             !alt.match(/^untitled/i);
    });
    const meaningfulAltRatio = totalImages === 0 ? 1 : meaningfulAltTexts.length / totalImages;

    // Check for form accessibility with multiple labeling methods
    const formInputs = $('input, textarea, select');
    const labeledInputs = formInputs.filter((_, el) => {
      const $el = $(el);
      const id = $el.attr('id');
      
      // Method 1: Explicit label with for attribute
      if (id && $(`label[for="${id}"]`).length > 0) return true;
      
      // Method 2: Implicit label (input wrapped in label)
      if ($el.parent('label').length > 0) return true;
      
      // Method 3: ARIA labeling
      if ($el.attr('aria-label') || $el.attr('aria-labelledby')) return true;
      
      // Method 4: Title attribute (fallback)
      if ($el.attr('title')) return true;
      
      return false;
    });
    const formLabelsRatio = formInputs.length === 0 ? 1 : 
      labeledInputs.length / formInputs.length;
    const hasFormLabels = formLabelsRatio >= 0.8;

    // Check for focus management
    const focusableElements = $(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    const elementsWithTabIndex = $('[tabindex]');
    const hasFocusManagement = focusableElements.length >= 3;

    // Check for skip links with more patterns
    const skipLinkPatterns = [
      'a[href^="#"]:contains("skip")',
      'a[href^="#"]:contains("Skip")',
      'a[href^="#"]:contains("jump")',
      'a[href^="#"]:contains("Jump")',
      'a[href^="#main"]',
      'a[href^="#content"]',
      '.skip-link',
      '[class*="skip"]'
    ];
    const skipLinks = $(skipLinkPatterns.join(', '));
    const hasSkipLinks = skipLinks.length > 0;

    // Check for proper button/link semantics
    const buttonsAsLinks = $('button[onclick*="location"], button[onclick*="href"]');
    const linksAsButtons = $('a[href="#"][onclick], a[href="javascript:"]').filter((_, el) => {
      const text = $(el).text().toLowerCase();
      return !text.includes('read more') && !text.includes('learn more');
    });
    const hasProperSemantics = buttonsAsLinks.length === 0 && linksAsButtons.length < 3;

    // Check headings hierarchy for screen readers
    const headings = $('h1, h2, h3, h4, h5, h6');
    const h1Count = $('h1').length;
    const hasHeadingStructure = h1Count === 1 && headings.length >= 2;

    // Check for color contrast indicators (simplified check)
    const hasStyleElements = $('style, link[rel="stylesheet"]').length > 0;
    const hasCSSFramework = context.html.toLowerCase().includes('bootstrap') || 
                          context.html.toLowerCase().includes('tailwind') ||
                          $('.container, .row, .col').length > 0;
    
    // Check for accessibility tools/libraries
    const pageText = context.html.toLowerCase();
    const hasA11yLibrary = pageText.includes('axe-core') || 
                          pageText.includes('accessibility') ||
                          pageText.includes('a11y');

    // Check for keyboard navigation hints
    const hasKeyboardNav = $('[accesskey]').length > 0 || 
                          elementsWithTabIndex.length > 2;

    // Language declaration
    const hasLangAttribute = $('html[lang]').length > 0;

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Semantic HTML structure (20% of score - 2 points)
    if (hasSemanticStructure) {
      score += 2.0;
      passes.passed.push('semantic_html_structure');
    } else {
      passes.failed.push('no_semantic_structure');
    }

    // ARIA attributes with modern patterns (15% of score - 1.5 points)
    if (hasAriaLabels && modernAriaScore >= 2) {
      score += 1.5;
      passes.passed.push('comprehensive_aria');
    } else if (hasAriaLabels || modernAriaScore >= 1) {
      score += 1.0;
      passes.passed.push('aria_attributes_present');
    } else if (ariaCount >= 2) {
      score += 0.5;
      passes.passed.push('some_aria_attributes');
    } else {
      passes.failed.push('insufficient_aria');
    }

    // Image alt text (15% of score - 1.5 points)
    if (meaningfulAltRatio >= 0.8) {
      score += 1.5;
      passes.passed.push('meaningful_alt_text');
    } else if (hasGoodAltTexts) {
      score += 1.2;
      passes.passed.push('good_alt_text_coverage');
    } else if (altTextCoverage >= 0.6) {
      score += 0.8;
      passes.passed.push('adequate_alt_text_coverage');
    } else {
      passes.failed.push('poor_alt_text_coverage');
    }

    // Form accessibility (15% of score - 1.5 points)
    if (hasFormLabels && formInputs.length > 0) {
      score += 1.5;
      passes.passed.push('form_labels_present');
    } else if (formInputs.length === 0) {
      score += 1.0; // No penalty if no forms
      passes.passed.push('no_forms_to_evaluate');
    } else {
      passes.failed.push('missing_form_labels');
    }

    // Focus management (10% of score - 1 point)
    if (hasFocusManagement && hasKeyboardNav) {
      score += 1.0;
      passes.passed.push('focus_management_present');
    } else if (hasFocusManagement) {
      score += 0.5;
      passes.passed.push('basic_focus_management');
    } else {
      passes.failed.push('no_focus_management');
    }

    // Heading structure (10% of score - 1 point)
    if (hasHeadingStructure) {
      score += 1.0;
      passes.passed.push('proper_heading_structure');
    } else {
      passes.failed.push('improper_heading_structure');
    }

    // Skip links (5% of score - 0.5 points)
    if (hasSkipLinks) {
      score += 0.5;
      passes.passed.push('skip_links_present');
    } else {
      passes.failed.push('no_skip_links');
    }

    // Semantic button/link usage (5% of score - 0.5 points)
    if (hasProperSemantics) {
      score += 0.5;
      passes.passed.push('proper_button_link_semantics');
    } else {
      passes.failed.push('improper_button_link_usage');
    }

    // Language attribute (2.5% of score - 0.25 points)
    if (hasLangAttribute) {
      score += 0.25;
      passes.passed.push('language_declared');
    } else {
      passes.failed.push('no_language_declaration');
    }

    // Accessibility tools/framework (2.5% of score - 0.25 points)
    if (hasA11yLibrary || hasCSSFramework) {
      score += 0.25;
      passes.passed.push('accessibility_tools');
    } else {
      passes.failed.push('no_accessibility_tools');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed accessibility analysis", {
      url: context.websiteUrl,
      score,
      semanticCount,
      ariaCount,
      modernAriaScore,
      altTextCoverage: Math.round(altTextCoverage * 100),
      meaningfulAltRatio: Math.round(meaningfulAltRatio * 100),
      formLabelsRatio: Math.round(formLabelsRatio * 100),
      focusableElements: focusableElements.length,
      hasSkipLinks,
      hasProperSemantics
    });

    return {
      criterion: 'accessibility',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Accessibility analysis: ${semanticCount} semantic elements, ${ariaCount} ARIA attributes, ${Math.round(meaningfulAltRatio * 100)}% meaningful alt text`,
        details: {
          semanticCount,
          ariaCount,
          hasAriaLive,
          hasAriaCurrent,
          hasAriaExpanded,
          modernAriaScore,
          totalImages,
          altTextCoverage: Math.round(altTextCoverage * 100),
          meaningfulAltRatio: Math.round(meaningfulAltRatio * 100),
          formInputs: formInputs.length,
          labeledInputs: labeledInputs.length,
          formLabelsRatio: Math.round(formLabelsRatio * 100),
          focusableElements: focusableElements.length,
          hasSkipLinks,
          hasLangAttribute,
          h1Count,
          headingsTotal: headings.length,
          buttonsAsLinks: buttonsAsLinks.length,
          linksAsButtons: linksAsButtons.length,
          hasProperSemantics
        },
        reasoning: `Score based on semantic HTML (${hasSemanticStructure ? 'present' : 'missing'}), ARIA attributes (${ariaCount} with modern score: ${modernAriaScore}), meaningful alt text (${Math.round(meaningfulAltRatio * 100)}%), form labels (${Math.round(formLabelsRatio * 100)}%), focus management (${hasFocusManagement ? 'adequate' : 'poor'}), heading structure (${hasHeadingStructure ? 'proper' : 'improper'}), and semantic button/link usage (${hasProperSemantics ? 'proper' : 'improper'})`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in accessibility analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'accessibility',
      score: 0,
      evidence: {
        description: 'Error analyzing accessibility',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete accessibility analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}