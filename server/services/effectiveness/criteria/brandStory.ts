/**
 * Brand Story Criterion Scorer
 * 
 * Evaluates brand story: POV, outcomes within 24mo, mechanism, proof proximity
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";
import { getEffectivenessPrompt } from "../promptManager";

export async function scoreBrandStory(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Enhanced brand story content extraction
    const aboutSelectors = [
      'section[class*="about"]',
      '.about-us',
      '.our-story',
      '.company-story',
      '[class*="story"]',
      '.mission',
      '.vision',
      '#about',
      '[id*="about"]'
    ];
    
    // Also look for headers that indicate story content
    const storyHeaderSelectors = [
      'h2:contains("about")',
      'h2:contains("story")',
      'h2:contains("mission")',
      'h2:contains("who we")',
      'h2:contains("why we")',
      'h3:contains("our approach")',
      'h3:contains("how we")',
      'h3:contains("what we do")'
    ];
    
    let storyContent = '';
    let contentParts = [];
    
    // First try dedicated sections
    for (const selector of aboutSelectors) {
      const section = $(selector);
      if (section.length > 0) {
        const sectionText = section.text().trim();
        if (sectionText && sectionText.length > 100) {
          // Get more content from dedicated sections
          storyContent = sectionText.substring(0, 2000);
          break;
        }
      }
    }
    
    // If no dedicated section, look for story-related headers
    if (!storyContent || storyContent.length < 200) {
      for (const selector of storyHeaderSelectors) {
        $(selector).each((_, el) => {
          const heading = $(el).text().trim();
          // Get the next few elements after this heading
          const content = $(el).nextAll('p, ul, ol, blockquote').slice(0, 3)
            .map((_, elem) => $(elem).text().trim())
            .get()
            .filter(text => text.length > 20)
            .join(' ');
          
          if (heading && content) {
            contentParts.push(`${heading}: ${content}`);
          }
        });
      }
      
      if (contentParts.length > 0) {
        storyContent = contentParts.join(' ').substring(0, 2000);
      }
    }
    
    // Enhanced fallback: get more comprehensive content
    if (!storyContent || storyContent.length < 200) {
      const paragraphs = $('p').slice(0, 8).map((_, el) => {
        const text = $(el).text().trim();
        // Filter out cookie notices, legal text, etc.
        if (text.length > 50 && 
            !text.match(/cookie|privacy policy|terms of service|copyright/i)) {
          return text;
        }
        return '';
      }).get().filter(t => t.length > 0);
      
      // Also get any testimonials or case study snippets
      $('.testimonial, .case-study, [class*="testimonial"], [class*="success"]').slice(0, 2).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && text.length < 500) {
          paragraphs.push(text);
        }
      });
      
      storyContent = paragraphs.join(' ');
    }
    
    // Final limit for API (increased for better analysis)
    storyContent = storyContent.substring(0, 2500);
    
    logger.info("Extracted brand story content", {
      url: context.websiteUrl,
      contentLength: storyContent.length
    });

    if (!storyContent || storyContent.length < 100) {
      return {
        criterion: 'brand_story',
        score: 0,
        evidence: {
          description: 'Insufficient brand story content found',
          details: { contentLength: storyContent.length },
          reasoning: 'Unable to evaluate brand story without adequate content'
        },
        passes: {
          passed: [],
          failed: ['insufficient_content']
        }
      };
    }

    // Get prompt from database or use default
    const effectivenessPrompt = await getEffectivenessPrompt('brand_story');
    if (!effectivenessPrompt) {
      throw new Error('No prompt template available for brand_story criterion');
    }
    
    const prompt = effectivenessPrompt.promptTemplate.replace('{content}', storyContent);
    
    // Log what we're sending to OpenAI
    logger.info("Brand story prompt content being sent to OpenAI", {
      url: context.websiteUrl,
      contentLength: storyContent.length,
      contentPreview: storyContent.substring(0, 300) + '...'
    });
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      messages: [
        {
          role: 'system',
          content: effectivenessPrompt.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200
    });

    const analysisText = response.choices[0]?.message?.content?.trim();
    if (!analysisText) {
      throw new Error('No response from OpenAI brand story analysis');
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI brand story response', {
        response: analysisText,
        error: parseError
      });
      throw new Error('Invalid JSON response from brand story analysis');
    }

    // Additional checks for recent outcomes and proof proximity
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];
    
    // Look for specific outcomes with dates
    const outcomeKeywords = ['increased', 'grew', 'achieved', 'delivered', 'improved', 'generated', 'saved', 'reduced'];
    const pageText = storyContent.toLowerCase();
    
    const hasRecentOutcomes = recentYears.some(year => {
      const yearStr = year.toString();
      return pageText.includes(yearStr) && outcomeKeywords.some(keyword => 
        pageText.includes(keyword) && 
        Math.abs(pageText.indexOf(keyword) - pageText.indexOf(yearStr)) < 100
      );
    });

    // Look for quantified results
    const numberPattern = /(\d{1,3}[,.]?\d{0,3})\s*(%|percent|million|billion|thousand|times|x)/gi;
    const quantifiedResults = storyContent.match(numberPattern) || [];
    const hasQuantifiedOutcomes = quantifiedResults.length >= 2;

    // Check for case study proximity (proof near outcomes)
    const proofKeywords = ['case study', 'success story', 'testimonial', 'client', 'customer'];
    const hasProofProximity = proofKeywords.some(keyword => pageText.includes(keyword));

    // Calculate score and collect evidence
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};
    
    // Point of view (25% of score - 2.5 points)
    if (analysis.pov_present) {
      score += 2.5;
      passes.passed.push('pov_present');
      if (analysis.pov_evidence) {
        evidenceDetails.pov_evidence = analysis.pov_evidence;
      }
    } else {
      passes.failed.push('no_pov');
    }
    
    // Mechanism named (25% of score - 2.5 points)  
    if (analysis.mechanism_named) {
      score += 2.5;
      passes.passed.push('mechanism_named');
      if (analysis.mechanism_evidence) {
        evidenceDetails.mechanism_evidence = analysis.mechanism_evidence;
      }
    } else {
      passes.failed.push('no_mechanism');
    }
    
    // Recent outcomes (25% of score - 2.5 points)
    if (analysis.outcomes_recent && (hasRecentOutcomes || hasQuantifiedOutcomes)) {
      score += 2.5;
      passes.passed.push('recent_outcomes');
      if (analysis.outcomes_evidence) {
        evidenceDetails.outcomes_evidence = analysis.outcomes_evidence;
      }
    } else if (analysis.outcomes_recent || hasQuantifiedOutcomes) {
      score += 1.5;
      passes.passed.push('some_outcomes');
      if (analysis.outcomes_evidence) {
        evidenceDetails.outcomes_evidence = analysis.outcomes_evidence;
      }
    } else {
      passes.failed.push('no_recent_outcomes');
    }
    
    // Complete case study (25% of score - 2.5 points)
    if (analysis.case_complete && hasProofProximity) {
      score += 2.5;
      passes.passed.push('complete_case_study');
      if (analysis.case_evidence) {
        evidenceDetails.case_evidence = analysis.case_evidence;
      }
    } else if (analysis.case_complete || hasProofProximity) {
      score += 1.25;
      passes.passed.push('partial_case_study');
      if (analysis.case_evidence) {
        evidenceDetails.case_evidence = analysis.case_evidence;
      }
    } else {
      passes.failed.push('no_case_study');
    }

    // Apply confidence factor
    score = score * (analysis.confidence || 0.8);
    score = Math.min(10, Math.max(0, score));

    logger.info("Completed brand story analysis", {
      url: context.websiteUrl,
      score,
      hasRecentOutcomes,
      quantifiedResults: quantifiedResults.length,
      hasProofProximity,
      confidence: analysis.confidence
    });

    return {
      criterion: 'brand_story',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Brand story analysis: ${passes.passed.length}/4 elements present with ${quantifiedResults.length} quantified results`,
        details: {
          storyContent: storyContent.substring(0, 200) + '...',
          analysis,
          hasRecentOutcomes,
          quantifiedResults: quantifiedResults.slice(0, 3),
          ...evidenceDetails, // Include extracted evidence
          hasProofProximity,
          recentYears
        },
        reasoning: `Score based on point of view (${analysis.pov_present ? 'present' : 'missing'}), mechanism explanation (${analysis.mechanism_named ? 'present' : 'missing'}), recent outcomes (${hasRecentOutcomes || hasQuantifiedOutcomes ? 'found' : 'missing'}), and complete case studies (${analysis.case_complete && hasProofProximity ? 'complete' : 'partial/missing'})`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in brand story analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'brand_story',
      score: 0,
      evidence: {
        description: 'Error analyzing brand story',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete brand story analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}