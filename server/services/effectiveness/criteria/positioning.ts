/**
 * Positioning Criterion Scorer
 * 
 * Evaluates hero section for audience clarity, outcome specificity, capability definition, and brevity
 */

import { CriterionResult, ScoringContext, ScoringConfig, OPENAI_CLASSIFIERS } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scorePositioning(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Extract hero content (first H1, subheading, first paragraph)
    const h1 = $('h1').first().text().trim();
    const subheading = $('h2, .subhead, .subtitle, p').first().text().trim();
    const firstParagraph = $('p').first().text().trim();
    
    const heroContent = [h1, subheading, firstParagraph]
      .filter(text => text.length > 0)
      .join(' ')
      .substring(0, 500); // Limit for API
    
    logger.info("Extracted hero content for positioning analysis", {
      url: context.websiteUrl,
      h1Length: h1.length,
      contentLength: heroContent.length
    });

    if (!heroContent) {
      return {
        criterion: 'positioning',
        score: 0,
        evidence: {
          description: 'No hero content found',
          details: { h1, subheading, firstParagraph },
          reasoning: 'Unable to evaluate positioning without hero content'
        },
        passes: {
          passed: [],
          failed: ['audience_named', 'outcome_present', 'capability_clear', 'brevity_check']
        }
      };
    }

    // Use OpenAI to analyze hero content
    const classifier = OPENAI_CLASSIFIERS.HERO;
    const prompt = classifier.prompt.replace('{content}', heroContent);
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: config.openai.temperature,
      messages: [
        {
          role: 'system',
          content: 'You are an expert copywriter analyzing website positioning. Return only valid JSON.'
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
      throw new Error('No response from OpenAI positioning analysis');
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI positioning response', {
        response: analysisText,
        error: parseError
      });
      throw new Error('Invalid JSON response from positioning analysis');
    }

    // Check for buzzwords (reduces score)
    const buzzwordCount = config.buzzwords.reduce((count, word) => {
      return count + (heroContent.toLowerCase().includes(word.toLowerCase()) ? 1 : 0);
    }, 0);

    // Calculate score based on criteria
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    
    if (analysis.audience_named) {
      score += 2.5;
      passes.passed.push('audience_named');
    } else {
      passes.failed.push('audience_named');
    }
    
    if (analysis.outcome_present) {
      score += 2.5;
      passes.passed.push('outcome_present');
    } else {
      passes.failed.push('outcome_present');
    }
    
    if (analysis.capability_clear) {
      score += 2.5;
      passes.passed.push('capability_clear');
    } else {
      passes.failed.push('capability_clear');
    }
    
    if (analysis.brevity_check) {
      score += 2.5;
      passes.passed.push('brevity_check');
    } else {
      passes.failed.push('brevity_check');
    }

    // Reduce score for buzzwords
    const buzzwordPenalty = buzzwordCount * 0.5;
    score = Math.max(0, score - buzzwordPenalty);

    // Apply confidence factor
    score = score * (analysis.confidence || 0.8);
    score = Math.min(10, Math.max(0, score));

    logger.info("Completed positioning analysis", {
      url: context.websiteUrl,
      score,
      buzzwordCount,
      confidence: analysis.confidence,
      passes: passes.passed.length
    });

    return {
      criterion: 'positioning',
      score: Math.round(score * 10) / 10, // Round to 1 decimal
      evidence: {
        description: `Positioning analysis of hero content: ${passes.passed.length}/4 criteria passed`,
        details: {
          heroContent,
          analysis,
          buzzwordCount,
          buzzwordPenalty,
          wordCount: h1.split(' ').length
        },
        reasoning: `Score based on audience clarity (${analysis.audience_named ? 'pass' : 'fail'}), outcome specificity (${analysis.outcome_present ? 'pass' : 'fail'}), capability definition (${analysis.capability_clear ? 'pass' : 'fail'}), and brevity (${analysis.brevity_check ? 'pass' : 'fail'}). ${buzzwordCount > 0 ? `Reduced by ${buzzwordPenalty} points for ${buzzwordCount} buzzwords.` : ''}`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in positioning analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'positioning',
      score: 0,
      evidence: {
        description: 'Error analyzing positioning',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete positioning analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}