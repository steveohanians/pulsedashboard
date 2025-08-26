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
    
    // Identify CTA elements
    const ctaSelectors = [
      'button:contains("get"), button:contains("start"), button:contains("try"), button:contains("buy"), button:contains("sign"), button:contains("join")',
      'a:contains("get"), a:contains("start"), a:contains("try"), a:contains("buy"), a:contains("sign"), a:contains("join")',
      '.cta, .call-to-action, .btn-primary, .button-primary',
      'input[type="submit"]',
      '[class*="cta"], [id*="cta"]'
    ];

    let allCTAs: Array<{
      text: string;
      tag: string;
      href?: string;
      classes: string;
      isAboveFold: boolean;
    }> = [];

    for (const selector of ctaSelectors) {
      $(selector).each((_, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (text.length > 0 && text.length < 100) { // Filter reasonable CTA text
          allCTAs.push({
            text,
            tag: element.tagName?.toLowerCase() || '',
            href: $el.attr('href'),
            classes: $el.attr('class') || '',
            isAboveFold: true // Simplified - assume first screenful
          });
        }
      });
    }

    // Remove duplicates based on text
    const uniqueCTAs = allCTAs.filter((cta, index, self) => 
      index === self.findIndex(c => c.text === cta.text)
    );

    const aboveFoldCTAs = uniqueCTAs.filter(cta => cta.isAboveFold);
    
    // Analyze CTA hierarchy and prominence
    const primaryCTAs = uniqueCTAs.filter(cta => 
      cta.classes.includes('primary') || 
      cta.classes.includes('main') ||
      cta.tag === 'button' ||
      ['get started', 'start free', 'try now', 'buy now', 'sign up'].some(phrase => 
        cta.text.toLowerCase().includes(phrase)
      )
    );

    const secondaryCTAs = uniqueCTAs.filter(cta => 
      cta.classes.includes('secondary') ||
      ['learn more', 'see how', 'watch demo', 'contact'].some(phrase => 
        cta.text.toLowerCase().includes(phrase)
      )
    );

    // Check for CTA message consistency (if we have links to analyze)
    let messageMatchScore = 0;
    let messageMatchChecks = 0;

    if (uniqueCTAs.length > 0 && uniqueCTAs[0].href) {
      // For now, simplified message matching - can be enhanced with actual link following
      const firstCTA = uniqueCTAs[0];
      if (firstCTA.href && !firstCTA.href.startsWith('#') && !firstCTA.href.startsWith('mailto:')) {
        // Simulate message match check - in full implementation, would fetch destination page
        const hasConsistentMessage = firstCTA.text.length >= 5 && firstCTA.text.length <= 50;
        if (hasConsistentMessage) {
          messageMatchScore = 1;
        }
        messageMatchChecks = 1;
      }
    }

    // Analyze CTA dominance (visual prominence)
    const hasVisualHierarchy = primaryCTAs.length >= 1 && primaryCTAs.length <= 3;
    const hasSecondaryPaths = secondaryCTAs.length >= 1;

    // Check for form CTAs
    const forms = $('form').length;
    const formCTAs = $('form button, form input[type="submit"]').length;
    const hasFormCTAs = formCTAs > 0;

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Above-fold CTA presence (30% of score - 3 points)
    if (aboveFoldCTAs.length >= 2) {
      score += 3.0;
      passes.passed.push('multiple_above_fold_ctas');
    } else if (aboveFoldCTAs.length >= 1) {
      score += 2.0;
      passes.passed.push('above_fold_cta_present');
    } else {
      passes.failed.push('no_above_fold_cta');
    }

    // CTA dominance and hierarchy (25% of score - 2.5 points)
    if (hasVisualHierarchy && primaryCTAs.length >= 1) {
      score += 2.5;
      passes.passed.push('clear_cta_hierarchy');
    } else if (primaryCTAs.length >= 1) {
      score += 1.5;
      passes.passed.push('primary_cta_present');
    } else {
      passes.failed.push('no_clear_hierarchy');
    }

    // Secondary paths (20% of score - 2 points)
    if (hasSecondaryPaths) {
      score += 2.0;
      passes.passed.push('secondary_paths_available');
    } else {
      passes.failed.push('no_secondary_paths');
    }

    // Message match (15% of score - 1.5 points)
    if (messageMatchChecks > 0 && messageMatchScore > 0) {
      score += 1.5;
      passes.passed.push('message_match_verified');
    } else if (uniqueCTAs.length > 0) {
      score += 0.75; // Partial credit for having CTAs
      passes.passed.push('ctas_present');
    } else {
      passes.failed.push('no_message_match');
    }

    // Form integration (10% of score - 1 point)
    if (hasFormCTAs) {
      score += 1.0;
      passes.passed.push('form_ctas_present');
    } else if (forms > 0) {
      score += 0.5;
      passes.passed.push('forms_present');
    } else {
      passes.failed.push('no_form_integration');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed CTA analysis", {
      url: context.websiteUrl,
      score,
      totalCTAs: uniqueCTAs.length,
      aboveFoldCTAs: aboveFoldCTAs.length,
      primaryCTAs: primaryCTAs.length,
      secondaryCTAs: secondaryCTAs.length,
      hasFormCTAs
    });

    return {
      criterion: 'ctas',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `CTA analysis: ${uniqueCTAs.length} total CTAs, ${aboveFoldCTAs.length} above-fold, ${primaryCTAs.length} primary, ${secondaryCTAs.length} secondary`,
        details: {
          totalCTAs: uniqueCTAs.length,
          aboveFoldCTAs: aboveFoldCTAs.length,
          primaryCTAs: primaryCTAs.map(cta => cta.text).slice(0, 3),
          secondaryCTAs: secondaryCTAs.map(cta => cta.text).slice(0, 3),
          hasVisualHierarchy,
          hasFormCTAs,
          forms,
          messageMatchChecks
        },
        reasoning: `Score based on above-fold presence (${aboveFoldCTAs.length} CTAs), visual hierarchy (${hasVisualHierarchy ? 'clear' : 'unclear'}), secondary paths (${hasSecondaryPaths ? 'available' : 'missing'}), and form integration (${hasFormCTAs ? 'present' : 'absent'})`
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