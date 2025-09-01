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
    
    // Enhanced logo detection with modern HTML structures
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[src*="logo" i]',
      'img[class*="logo" i]',
      '.customer-logo img',
      '.client-logo img',
      '.partner-logo img'
    ];
    
    const modernLogoSelectors = [
      ...logoSelectors,
      // Context-based detection
      'section img',  // All images in sections
      'div[class*="grid"] img',  // Grid layouts
      'div[class*="flex"] img',  // Flexbox layouts
      'ul li img',  // List-based logo displays
    ];
    
    // Analyze images in context for trust indicators
    const potentialLogos = $(modernLogoSelectors.join(','));
    const validLogos = potentialLogos.filter((i, el) => {
      const img = $(el);
      const parent = img.closest('section, div[class*="container"]');
      const parentText = parent.text().toLowerCase();
      
      // Check if image is in a trust context
      return /featured|trusted|client|partner|works with|used by/.test(parentText);
    });
    
    let customerLogos = $(logoSelectors.join(',')).length;
    
    // If specific selectors don't find logos, use context-based detection
    if (customerLogos === 0 && validLogos.length > 0) {
      customerLogos = validLogos.length;
    }
    
    // "Featured In" detection with higher scoring weight
    const featuredInSections = $('section, div').filter((i, el) => {
      const text = $(el).find('h1, h2, h3, h4, p').text().toLowerCase();
      const hasFeatureText = /featured in|as seen on|in the press|media/.test(text);
      const hasImages = $(el).find('img').length >= 2;
      return hasFeatureText && hasImages;
    });
    
    const featuredLogos = featuredInSections.find('img');
    
    // Detect major media outlets
    const majorMediaOutlets = ['forbes', 'inc', 'techcrunch', 'wsj', 'wall street journal', 
                               'gartner', 'forrester', 'bloomberg', 'reuters', 'cnn', 
                               'bbc', 'new york times', 'nyt', 'guardian', 'economist'];
    const hasMajorMedia = featuredLogos.filter((i, el) => {
      const imgAttrs = ($(el).attr('alt') || '') + ' ' + 
                      ($(el).attr('src') || '') + ' ' + 
                      ($(el).attr('title') || '');
      return majorMediaOutlets.some(outlet => imgAttrs?.toLowerCase().includes(outlet));
    }).length > 0;
    
    // Identify trust sections by structure, not just keywords
    const trustSections = $('section, div[class*="section"]').filter((i, el) => {
      const section = $(el);
      const hasMultipleImages = section.find('img').length >= 3;
      const hasGrid = section.find('[class*="grid"], [class*="flex"]').length > 0;
      const hasCompanyNames = /forbes|google|microsoft|amazon|deloitte|accenture|ibm|oracle|salesforce/i.test(section.text());
      
      return (hasMultipleImages && hasGrid) || hasCompanyNames;
    });
    
    // Smart fallback when specific selectors fail
    if (customerLogos === 0) {
      // Look for any section with 3+ images
      const imageSections = $('section, div').filter((i, el) => 
        $(el).find('img').length >= 3
      );
      
      if (imageSections.length > 0) {
        customerLogos = imageSections.first().find('img').length;
        logger.debug('Used fallback logo detection', { customerLogos });
      }
    }
    
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

    // Improved number extraction for business metrics
    const metricsPattern = /(\d{1,6}[,.]?\d{0,3})\+?\s*(%|percent|campaigns|projects|years|customers|clients|companies|users|countries|offices|team|employees|solutions|implementations|satisfied|completed|delivered|roi|increase|growth)/gi;
    const numberMatches = pageText.match(metricsPattern) || [];
    
    // Also look for standalone impressive numbers in headings
    const headingNumbers = $('h1, h2, h3').text().match(/\d{3,}/g) || [];
    const hasScaleIndicators = numberMatches.length > 0 || headingNumbers.length > 0;

    // Calculate score with adjusted weights
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Featured In/Media (30% - highest weight for major media coverage)
    if (featuredInSections.length > 0 && hasMajorMedia) {
      score += 3.0;
      passes.passed.push('major_media_coverage');
    } else if (featuredInSections.length > 0) {
      score += 1.5;
      passes.passed.push('media_coverage');
    } else {
      passes.failed.push('no_media_coverage');
    }

    // Customer logos (20% of score - reduced from 25%)
    if (customerLogos >= 5) {
      score += 2.0;
      passes.passed.push('sufficient_logos');
    } else if (customerLogos >= 3) {
      score += 1.2;
      passes.passed.push('some_logos');
    } else {
      passes.failed.push('insufficient_logos');
    }

    // Third-party proof - certifications, awards (15% of score - reduced from 20%)
    if (certifications >= 2) {
      score += 1.5;
      passes.passed.push('third_party_proof');
    } else if (certifications >= 1) {
      score += 0.8;
      passes.passed.push('some_third_party_proof');
    } else {
      passes.failed.push('no_third_party_proof');
    }

    // Recent proof (15% of score - reduced from 20%)
    if (hasRecentDates) {
      score += 1.5;
      passes.passed.push('recent_proof');
    } else {
      passes.failed.push('no_recent_proof');
    }

    // Case studies/testimonials (15% of score - reduced from 25%)
    const testimonialScore = testimonials + caseStudies;
    if (testimonialScore >= 3) {
      score += 1.5;
      passes.passed.push('multiple_case_stories');
    } else if (testimonialScore >= 1) {
      score += 0.8;
      passes.passed.push('some_case_stories');
    } else {
      passes.failed.push('no_case_stories');
    }

    // Trust keywords and scale indicators (5% of score - reduced from 10%)
    if (trustKeywordCount >= 5 && hasScaleIndicators) {
      score += 0.5;
      passes.passed.push('trust_language');
    } else if (trustKeywordCount >= 3) {
      score += 0.25;
      passes.passed.push('some_trust_language');
    } else {
      passes.failed.push('weak_trust_language');
    }

    score = Math.min(10, Math.max(0, score));

    // Debug logging for analysis insights
    logger.debug('Trust detection analysis', {
      totalImages: $('img').length,
      detectedLogos: customerLogos,
      potentialLogoSections: $('section:has(img)').length,
      featuredInFound: featuredInSections.length > 0,
      hasMajorMedia,
      headingsWithNumbers: headingNumbers,
      trustSectionCount: trustSections.length,
      validLogosCount: validLogos.length,
      metricsFound: numberMatches.length
    });

    logger.info("Completed trust analysis", {
      url: context.websiteUrl,
      score,
      customerLogos,
      testimonials,
      caseStudies,
      certifications,
      trustKeywordCount,
      hasRecentDates,
      hasScaleIndicators,
      featuredInSections: featuredInSections.length,
      hasMajorMedia
    });

    // Enhanced description including media coverage
    const descriptionParts = [];
    if (featuredInSections.length > 0) {
      descriptionParts.push(`${hasMajorMedia ? 'major media coverage' : 'media mentions'}`);
    }
    descriptionParts.push(
      `${customerLogos} logos`,
      `${testimonials} testimonials`,
      `${caseStudies} case studies`,
      `${certifications} certifications`
    );

    return {
      criterion: 'trust',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Trust analysis: ${descriptionParts.join(', ')}`,
        details: {
          customerLogos,
          testimonials,
          caseStudies,
          certifications,
          trustKeywordCount,
          hasRecentDates,
          hasScaleIndicators,
          numberMatches: numberMatches.slice(0, 3), // First 3 examples
          recentYears,
          featuredInSections: featuredInSections.length,
          hasMajorMedia,
          trustSections: trustSections.length,
          headingNumbers: headingNumbers.slice(0, 3) // First 3 examples
        },
        reasoning: `Score based on ${hasMajorMedia ? 'major media coverage, ' : featuredInSections.length > 0 ? 'media mentions, ' : ''}customer logos (${customerLogos >= 5 ? 'sufficient' : customerLogos >= 3 ? 'some' : 'insufficient'}), third-party proof (${certifications >= 2 ? 'strong' : certifications >= 1 ? 'some' : 'none'}), recent proof (${hasRecentDates ? 'present' : 'absent'}), and case stories (${testimonials + caseStudies >= 3 ? 'multiple' : testimonials + caseStudies >= 1 ? 'some' : 'none'})`
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