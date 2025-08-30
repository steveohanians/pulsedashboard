/**
 * AI-Powered CTAs Criterion Scorer (5-Criteria with Vision)
 * 
 * Evaluates CTA effectiveness using AI analysis with vision integration
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import { OpenAI } from "openai";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";
import { getEffectivenessPrompt } from "../promptManager";
import { callOpenAIWithVision } from "../visionHelper";

export async function scoreCTAs(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Extract CTA content from the page
    const ctaContent = extractCTAContent($);
    
    logger.info("Extracted CTA content for AI analysis", {
      url: context.websiteUrl,
      contentLength: ctaContent.length,
      ctaSectionsFound: (ctaContent.match(/\n/g) || []).length + 1
    });

    if (!ctaContent || ctaContent.length < 50) {
      return {
        criterion: 'ctas',
        score: 0,
        evidence: {
          description: 'Insufficient CTA content found for analysis',
          details: { contentLength: ctaContent.length },
          reasoning: 'Unable to evaluate CTAs without adequate content'
        },
        passes: {
          passed: [],
          failed: ['insufficient_content']
        }
      };
    }

    // Get AI prompt from database
    const effectivenessPrompt = await getEffectivenessPrompt('ctas');
    if (!effectivenessPrompt) {
      throw new Error('No prompt template available for ctas criterion');
    }
    
    const prompt = effectivenessPrompt.promptTemplate.replace('{content}', ctaContent);
    
    logger.info("CTA AI analysis starting", {
      url: context.websiteUrl,
      contentLength: ctaContent.length,
      promptSource: 'database',
      openaiModel: config.openai.model
    });
    
    let analysisText: string;
    
    // Try vision-enhanced analysis first if full-page screenshot is available
    if (context.fullPageScreenshot) {
      try {
        logger.info("Using vision-enhanced CTA analysis", {
          url: context.websiteUrl,
          screenshotPath: context.fullPageScreenshot
        });
        
        analysisText = await callOpenAIWithVision(
          ctaContent,
          context.fullPageScreenshot,
          prompt,
          effectivenessPrompt.systemPrompt,
          openai,
          500
        );
        
        logger.info("Vision-enhanced CTA analysis completed", {
          url: context.websiteUrl,
          responseLength: analysisText.length
        });
      } catch (visionError) {
        logger.warn("Vision analysis failed, falling back to text-only", {
          url: context.websiteUrl,
          error: visionError instanceof Error ? visionError.message : String(visionError)
        });
        
        // Fallback to text-only analysis
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
          max_tokens: 500
        });
        
        analysisText = response.choices[0]?.message?.content?.trim() || '';
      }
    } else {
      // Text-only analysis when no screenshot available
      logger.info("Using text-only CTA analysis (no screenshot)", {
        url: context.websiteUrl
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
        max_tokens: 500
      });
      
      analysisText = response.choices[0]?.message?.content?.trim() || '';
    }

    if (!analysisText) {
      throw new Error('No response from OpenAI CTA analysis');
    }

    // Parse AI response
    let analysis;
    try {
      const cleanJsonText = analysisText.replace(/^```json\s*|\s*```$/g, '').trim();
      analysis = JSON.parse(cleanJsonText);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI CTA response', {
        response: analysisText,
        error: parseError
      });
      throw new Error('Invalid JSON response from CTA analysis');
    }

    // Advanced CTA Scoring System (following detailed specification)
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};

    // Use AI-computed strength score as the primary score (already 0.00-1.00)
    const strengthScore = Math.max(0, Math.min(1, analysis.cta_strength_score || 0));
    
    // Convert to 10-point scale
    score = strengthScore * 10;

    // Determine pass/fail based on the 5 scoring components
    
    // 1. Presence & Clarity (+0.2)
    if (analysis.cta_present) {
      passes.passed.push('cta_present');
      evidenceDetails.cta_primary_examples = analysis.cta_primary_examples || [];
      evidenceDetails.cta_secondary_examples = analysis.cta_secondary_examples || [];
    } else {
      passes.failed.push('no_primary_cta');
    }

    // 2. Early Availability (+0.2) 
    if (analysis.cta_above_fold) {
      passes.passed.push('cta_above_fold');
    } else {
      passes.failed.push('no_above_fold_cta');
    }

    // 3. Page-End Closure (+0.2)
    if (analysis.cta_page_end) {
      passes.passed.push('cta_page_end');
    } else {
      passes.failed.push('no_page_end_cta');
    }

    // 4. Block Closure (+0.2)
    if (analysis.cta_block_closure) {
      passes.passed.push('cta_block_closure');
      evidenceDetails.cta_block_examples = analysis.cta_block_examples || [];
    } else {
      passes.failed.push('no_block_closure');
    }

    // 5. Reinforcement (+0.2) - determined by AI analysis
    // AI already computed this as part of strength score, so we infer from score components
    const expectedBaseScore = (analysis.cta_present ? 0.2 : 0) + 
                             (analysis.cta_above_fold ? 0.2 : 0) + 
                             (analysis.cta_page_end ? 0.2 : 0) +
                             (analysis.cta_block_closure ? 0.2 : 0);
    const hasReinforcement = strengthScore > expectedBaseScore;
    
    if (hasReinforcement) {
      passes.passed.push('cta_reinforcement');
    } else {
      passes.failed.push('no_cta_reinforcement');
    }

    // Handle special cases and penalties

    // Conflict Rule: AI already applied -0.25 penalty in strength score
    if (analysis.cta_conflict) {
      passes.failed.push('cta_conflict');
      // Score already reduced by AI, just mark as failed
    }

    // NO-PRIMARY Rule: AI already handled this in cta_present and strength score
    if (!analysis.cta_present && (analysis.cta_secondary_examples?.length > 0)) {
      passes.failed.push('only_secondary_ctas');
      // AI already limited score to max +0.25 for secondary-only
    }

    // OCR and Visual Issues
    if (analysis.extraction_issues?.includes('visual_cta_unassessed')) {
      passes.failed.push('visual_cta_unassessed');
    }

    // Store comprehensive analysis data for evidence
    evidenceDetails.cta_strength_score = strengthScore;
    evidenceDetails.cta_evidence = analysis.cta_evidence;
    evidenceDetails.primary_cta_groups_used = analysis.primary_cta_groups_used || [];
    evidenceDetails.cta_conflict = analysis.cta_conflict || false;
    evidenceDetails.ocr_status = analysis.ocr_status;
    evidenceDetails.extraction_issues = analysis.extraction_issues || [];
    
    // Additional evidence details
    evidenceDetails.analysis = analysis;
    
    // Ensure score is within bounds
    score = Math.min(10, Math.max(0, score));

    logger.info("Completed AI-powered CTA analysis", {
      url: context.websiteUrl,
      score,
      ctaPresent: analysis.cta_present,
      strengthScore: analysis.cta_strength_score,
      ctaConflict: analysis.cta_conflict,
      primaryGroups: analysis.primary_cta_groups_used
    });

    return {
      criterion: 'ctas',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `CTA analysis: ${passes.passed.length}/5 criteria met, strength score ${analysis.cta_strength_score}`,
        details: {
          ctaContent: ctaContent.substring(0, 300) + '...',
          analysis,
          ...evidenceDetails
        },
        reasoning: analysis.cta_evidence || `CTA strength score: ${analysis.cta_strength_score}. Primary CTAs: ${analysis.cta_primary_examples?.join(', ') || 'none'}. Issues: ${analysis.extraction_issues?.join(', ') || 'none'}`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in AI-powered CTA analysis', {
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

// CTA content extraction function
function extractCTAContent($: cheerio.CheerioAPI): string {
  const ctaContent: string[] = [];
  
  // Extract CTA elements
  const ctaSelectors = [
    'a[href]', 'button', 'input[type="submit"]', 'input[type="button"]',
    '[role="button"]', '.btn', '.button', '.cta', '[class*="cta"]'
  ];
  
  ctaSelectors.forEach(selector => {
    $(selector).each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href');
      const location = getElementLocation($el);
      
      if (text && text.length > 2) {
        ctaContent.push(`CTA: "${text}" | Location: ${location} | Link: ${href || 'button'}`);
      }
    });
  });
  
  return ctaContent.join('\n');
}

// Helper to determine element location
function getElementLocation($el: cheerio.Cheerio<cheerio.Element>): string {
  if ($el.closest('header, .header, nav, .nav').length) return 'header';
  if ($el.closest('footer, .footer').length) return 'footer';
  if ($el.closest('.hero, [class*="hero"]').length) return 'hero';
  if ($el.closest('aside, .sidebar').length) return 'sidebar';
  return 'main';
}