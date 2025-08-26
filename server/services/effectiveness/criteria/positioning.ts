/**
 * Positioning Criterion Scorer
 * 
 * Evaluates hero section for audience clarity, outcome specificity, capability definition, and brevity
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";
import { getEffectivenessPrompt } from "../promptManager";

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

    // Get prompt from database or use default
    const effectivenessPrompt = await getEffectivenessPrompt('positioning');
    if (!effectivenessPrompt) {
      throw new Error('No prompt template available for positioning criterion');
    }
    
    const prompt = effectivenessPrompt.promptTemplate.replace('{content}', heroContent);
    
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

    // Calculate score based on criteria and collect evidence
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};
    
    if (analysis.audience_named) {
      score += 2.5;
      passes.passed.push('audience_named');
      if (analysis.audience_evidence) {
        evidenceDetails.audience_evidence = analysis.audience_evidence;
      }
    } else {
      passes.failed.push('audience_named');
    }
    
    if (analysis.outcome_present) {
      score += 2.5;
      passes.passed.push('outcome_present');
      if (analysis.outcome_evidence) {
        evidenceDetails.outcome_evidence = analysis.outcome_evidence;
      }
    } else {
      passes.failed.push('outcome_present');
    }
    
    if (analysis.capability_clear) {
      score += 2.5;
      passes.passed.push('capability_clear');
      if (analysis.capability_evidence) {
        evidenceDetails.capability_evidence = analysis.capability_evidence;
      }
    } else {
      passes.failed.push('capability_clear');
    }
    
    if (analysis.brevity_check) {
      score += 2.5;
      passes.passed.push('brevity_check');
      if (analysis.brevity_evidence) {
        evidenceDetails.brevity_evidence = analysis.brevity_evidence;
      }
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
          wordCount: h1.split(' ').length,
          ...evidenceDetails // Include extracted evidence
        },
        reasoning: generatePositioningInsights(analysis, buzzwordCount, passes.passed, passes.failed)
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

/**
 * Generate actionable insights for positioning analysis
 */
function generatePositioningInsights(analysis: any, buzzwordCount: number, passed: string[], failed: string[]): string {
  const insights: string[] = [];
  
  // Overall assessment
  if (passed.length >= 3) {
    insights.push("Your hero section effectively communicates your value proposition with clear positioning elements.");
  } else if (passed.length >= 2) {
    insights.push("Your positioning has solid foundations but needs refinement to maximize visitor conversion.");
  } else {
    insights.push("Your hero section requires significant optimization to clearly communicate your value to visitors.");
  }
  
  // Specific recommendations
  const recommendations: string[] = [];
  
  if (failed.includes('audience_named')) {
    recommendations.push("**Define your target audience** - Be specific about who you serve rather than using generic terms");
  }
  
  if (failed.includes('outcome_present')) {
    recommendations.push("**Clarify the outcome** - Visitors should immediately understand what result they'll achieve by working with you");
  }
  
  if (failed.includes('capability_clear')) {
    recommendations.push("**Specify your capabilities** - Explain exactly how you deliver results, not just what you do");
  }
  
  if (failed.includes('brevity_check')) {
    recommendations.push("**Simplify your message** - Hero content should be concise and immediately scannable");
  }
  
  if (buzzwordCount > 0) {
    recommendations.push(`**Reduce buzzwords** - Replace ${buzzwordCount} generic terms with specific, results-focused language`);
  }
  
  // Combine insights and recommendations
  let result = insights[0];
  if (recommendations.length > 0) {
    result += ` Key improvements: ${recommendations.join('; ')}.`;
  }
  
  return result;
}