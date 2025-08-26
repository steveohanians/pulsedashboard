/**
 * Brand Story Criterion Scorer
 * 
 * Evaluates brand story: POV, outcomes within 24mo, mechanism, proof proximity
 */

import { CriterionResult, ScoringContext, ScoringConfig, OPENAI_CLASSIFIERS } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreBrandStory(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Extract brand story content (first few paragraphs, about sections)
    const aboutSelectors = [
      'section[class*="about"]',
      '.about-us',
      '.our-story',
      '.company-story',
      '[class*="story"]',
      '.mission',
      '.vision'
    ];
    
    let storyContent = '';
    for (const selector of aboutSelectors) {
      const sectionText = $(selector).text().trim();
      if (sectionText && sectionText.length > 100) {
        storyContent = sectionText;
        break;
      }
    }
    
    // Fallback to first few paragraphs if no dedicated about section
    if (!storyContent) {
      storyContent = $('p').slice(0, 5).map((_, el) => $(el).text().trim()).get().join(' ');
    }
    
    // Limit content for API
    storyContent = storyContent.substring(0, 800);
    
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

    // Use OpenAI to analyze brand story
    const classifier = OPENAI_CLASSIFIERS.STORY;
    const prompt = classifier.prompt.replace('{content}', storyContent);
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      messages: [
        {
          role: 'system',
          content: 'You are an expert brand strategist analyzing brand story elements. Return only valid JSON.'
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

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    
    // Point of view (25% of score - 2.5 points)
    if (analysis.pov_present) {
      score += 2.5;
      passes.passed.push('pov_present');
    } else {
      passes.failed.push('no_pov');
    }
    
    // Mechanism named (25% of score - 2.5 points)  
    if (analysis.mechanism_named) {
      score += 2.5;
      passes.passed.push('mechanism_named');
    } else {
      passes.failed.push('no_mechanism');
    }
    
    // Recent outcomes (25% of score - 2.5 points)
    if (analysis.outcomes_recent && (hasRecentOutcomes || hasQuantifiedOutcomes)) {
      score += 2.5;
      passes.passed.push('recent_outcomes');
    } else if (analysis.outcomes_recent || hasQuantifiedOutcomes) {
      score += 1.5;
      passes.passed.push('some_outcomes');
    } else {
      passes.failed.push('no_recent_outcomes');
    }
    
    // Complete case study (25% of score - 2.5 points)
    if (analysis.case_complete && hasProofProximity) {
      score += 2.5;
      passes.passed.push('complete_case_study');
    } else if (analysis.case_complete || hasProofProximity) {
      score += 1.25;
      passes.passed.push('partial_case_study');
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