/**
 * Trust Criterion Scorer
 * 
 * Evaluates trust signals: customer logos, third-party proof, recent proof, case studies
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreTrust(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Look for customer logos/testimonials
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[src*="logo" i]',
      'img[class*="logo" i]',
      '.customer-logo img',
      '.client-logo img',
      '.partner-logo img'
    ];
    
    const testimonialSelectors = [
      '.testimonial',
      '.review',
      '.quote',
      '[class*="testimonial"]',
      '[class*="review"]'
    ];

    const caseStudySelectors = [
      'a[href*="case-study" i]',
      'a[href*="case-studies" i]',
      'a[href*="success-story" i]',
      '.case-study',
      '.success-story'
    ];

    const certificationSelectors = [
      'img[alt*="certified" i]',
      'img[alt*="badge" i]',
      'img[alt*="award" i]',
      '.certification',
      '.badge',
      '.award'
    ];

    // Count trust elements
    const customerLogos = $(logoSelectors.join(',')).length;
    const testimonials = $(testimonialSelectors.join(',')).length;
    const caseStudies = $(caseStudySelectors.join(',')).length;
    const certifications = $(certificationSelectors.join(',')).length;

    // Look for specific trust indicators in text
    const pageText = $('body').text().toLowerCase();
    const trustKeywords = [
      'customers', 'clients served', 'companies trust us', 'trusted by',
      'years of experience', 'since', 'founded', 'established',
      'award', 'certified', 'accredited', 'recognized',
      'testimonial', 'review', 'rating'
    ];

    const trustKeywordCount = trustKeywords.reduce((count, keyword) => {
      return count + (pageText.includes(keyword) ? 1 : 0);
    }, 0);

    // Check for recent proof (within threshold months)
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2]; // Last 3 years
    const hasRecentDates = recentYears.some(year => 
      pageText.includes(year.toString())
    );

    // Look for specific numbers that suggest scale
    const numberMatches = pageText.match(/(\d{1,3}[,.]?\d{0,3})\s*(customers|clients|companies|users|projects)/gi) || [];
    const hasScaleIndicators = numberMatches.length > 0;

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Customer logos (25% of score)
    if (customerLogos >= 5) {
      score += 2.5;
      passes.passed.push('sufficient_logos');
    } else if (customerLogos >= 3) {
      score += 1.5;
      passes.passed.push('some_logos');
    } else {
      passes.failed.push('insufficient_logos');
    }

    // Third-party proof - certifications, awards (20% of score)
    if (certifications >= 2) {
      score += 2.0;
      passes.passed.push('third_party_proof');
    } else if (certifications >= 1) {
      score += 1.0;
      passes.passed.push('some_third_party_proof');
    } else {
      passes.failed.push('no_third_party_proof');
    }

    // Recent proof (20% of score)
    if (hasRecentDates) {
      score += 2.0;
      passes.passed.push('recent_proof');
    } else {
      passes.failed.push('no_recent_proof');
    }

    // Case studies/testimonials (25% of score)
    const testimonialScore = testimonials + caseStudies;
    if (testimonialScore >= 3) {
      score += 2.5;
      passes.passed.push('multiple_case_stories');
    } else if (testimonialScore >= 1) {
      score += 1.5;
      passes.passed.push('some_case_stories');
    } else {
      passes.failed.push('no_case_stories');
    }

    // Trust keywords and scale indicators (10% of score)
    if (trustKeywordCount >= 5 && hasScaleIndicators) {
      score += 1.0;
      passes.passed.push('trust_language');
    } else if (trustKeywordCount >= 3) {
      score += 0.5;
      passes.passed.push('some_trust_language');
    } else {
      passes.failed.push('weak_trust_language');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed trust analysis", {
      url: context.websiteUrl,
      score,
      customerLogos,
      testimonials,
      caseStudies,
      certifications,
      trustKeywordCount,
      hasRecentDates,
      hasScaleIndicators
    });

    return {
      criterion: 'trust',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Trust analysis: ${customerLogos} logos, ${testimonials} testimonials, ${caseStudies} case studies, ${certifications} certifications`,
        details: {
          customerLogos,
          testimonials,
          caseStudies,
          certifications,
          trustKeywordCount,
          hasRecentDates,
          hasScaleIndicators,
          numberMatches: numberMatches.slice(0, 3), // First 3 examples
          recentYears
        },
        reasoning: `Score based on customer logos (${customerLogos >= 5 ? 'sufficient' : customerLogos >= 3 ? 'some' : 'insufficient'}), third-party proof (${certifications >= 2 ? 'strong' : certifications >= 1 ? 'some' : 'none'}), recent proof (${hasRecentDates ? 'present' : 'absent'}), and case stories (${testimonials + caseStudies >= 3 ? 'multiple' : testimonials + caseStudies >= 1 ? 'some' : 'none'})`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in trust analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'trust',
      score: 0,
      evidence: {
        description: 'Error analyzing trust signals',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete trust analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}