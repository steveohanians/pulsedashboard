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

function calculateFallbackCTAs(ctaContent: string): {
  score: number;
  analysis: any;
} {
  const analysis = {
    cta_present: /get started|contact|sign up|learn more|buy now|book now|request|download|subscribe|register/i.test(ctaContent),
    cta_above_fold: ctaContent.substring(0, 1000).match(/get started|contact|sign up|learn more|buy now|book now|request|download/i) !== null,
    cta_page_end: ctaContent.substring(ctaContent.length - 1000).match(/contact|get started|sign up|learn more/i) !== null,
    cta_block_closure: (ctaContent.match(/get started|contact|sign up|learn more|buy now|book now|request|download/gi) || []).length >= 2,
    cta_conflict: false,
    confidence: 0.3,
    fallback: true,
    cta_strength_score: 0,
    cta_evidence: 'Fallback assessment based on pattern matching',
    cta_primary_examples: ctaContent.match(/get started|contact|sign up|learn more|buy now|book now|request|download/gi) || [],
    cta_secondary_examples: [],
    extraction_issues: ['fallback_analysis']
  };

  let score = 2;
  if (analysis.cta_present) score += 2;
  if (analysis.cta_above_fold) score += 2;
  if (analysis.cta_page_end) score += 1;
  if (analysis.cta_block_closure) score += 1.5;

  analysis.cta_strength_score = score / 10;
  return { score: Math.min(10, score), analysis };
}

export async function scoreCTAs(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Extract CTA content from the page
    let ctaContent = extractCTAContent($);
    
    // Validate extracted content
    if (!ctaContent || ctaContent.trim().length < 50) {
      // Try alternative extraction method
      ctaContent = $('body').text().replace(/\s+/g, ' ').trim();
      
      if (ctaContent.length < 50) {
        logger.warn("Insufficient content for CTA analysis", {
          url: context.websiteUrl,
          contentLength: ctaContent.length
        });
        
        return {
          criterion: 'ctas',
          score: 0,
          evidence: {
            description: 'Insufficient content found for analysis',
            details: { contentLength: ctaContent.length },
            reasoning: 'Unable to evaluate CTAs without adequate content'
          },
          passes: {
            passed: [],
            failed: ['insufficient_content']
          }
        };
      }
    }
    
    // Debug what CTA content we actually extracted
    const ctaKeywords = ['GET TO KNOW US', 'View more work', 'Contact Us', 'Learn More', 'Get Started', 'Book Now', 'Sign Up', 'button', 'btn'];
    const foundKeywords = ctaKeywords.filter(keyword => ctaContent.toLowerCase().includes(keyword.toLowerCase()));
    const buttonCount = (ctaContent.match(/button|btn/gi) || []).length;
    
    logger.info("[CTA ANALYSIS] Extracted page content for AI analysis", {
      url: context.websiteUrl,
      contentLength: ctaContent.length,
      lineCount: (ctaContent.match(/\n/g) || []).length + 1,
      foundCTAKeywords: foundKeywords.length > 0 ? foundKeywords : 'none-found',
      buttonCount: buttonCount,
      hasJavaScriptContent: context.html.includes('</script>') || context.html.includes('onclick'),
      htmlSource: context.html.includes('<!DOCTYPE html>') ? 'full-html' : 'partial-content',
      contentPreview: ctaContent.substring(0, 300) + '...'
    });

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
        
        try {
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
        } catch (openaiError) {
          logger.warn("OpenAI analysis failed, using rule-based fallback", {
            url: context.websiteUrl,
            error: openaiError instanceof Error ? openaiError.message : String(openaiError)
          });
          
          const fallbackResult = calculateFallbackCTAs(ctaContent);
          return {
            criterion: 'ctas',
            score: fallbackResult.score,
            evidence: {
              description: `Rule-based CTA analysis: ${fallbackResult.score}/10`,
              details: {
                ctaContent: ctaContent.substring(0, 300) + '...',
                analysis: fallbackResult.analysis,
                fallbackUsed: true
              },
              reasoning: 'AI analysis unavailable, used pattern-based scoring'
            },
            passes: {
              passed: Object.entries(fallbackResult.analysis).filter(([key, value]) => value === true && key !== 'fallback').map(([key]) => key),
              failed: Object.entries(fallbackResult.analysis).filter(([key, value]) => value === false).map(([key]) => key)
            }
          };
        }
      }
    } else {
      try {
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
      } catch (openaiError) {
        logger.warn("OpenAI analysis failed, using rule-based fallback", {
          url: context.websiteUrl,
          error: openaiError instanceof Error ? openaiError.message : String(openaiError)
        });
        
        const fallbackResult = calculateFallbackCTAs(ctaContent);
        return {
          criterion: 'ctas',
          score: fallbackResult.score,
          evidence: {
            description: `Rule-based CTA analysis: ${fallbackResult.score}/10`,
            details: {
              ctaContent: ctaContent.substring(0, 300) + '...',
              analysis: fallbackResult.analysis,
              fallbackUsed: true
            },
            reasoning: 'AI analysis unavailable, used pattern-based scoring'
          },
          passes: {
            passed: Object.entries(fallbackResult.analysis).filter(([key, value]) => value === true && key !== 'fallback').map(([key]) => key),
            failed: Object.entries(fallbackResult.analysis).filter(([key, value]) => value === false).map(([key]) => key)
          }
        };
      }
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

    // Map extraction_issues to fails
    if (analysis.extraction_issues && Array.isArray(analysis.extraction_issues)) {
      analysis.extraction_issues.forEach((issue: string) => {
        if (!passes.failed.includes(issue)) {
          passes.failed.push(issue);
        }
      });
    }

    // Ensure we're not duplicating pass/fail entries
    passes.passed = [...new Set(passes.passed)];
    passes.failed = [...new Set(passes.failed)];

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
        description: `CTA analysis: strength score ${(analysis.cta_strength_score * 10).toFixed(1)}/10. ${analysis.cta_evidence || ''}`,
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

// CTA content extraction function - extracts full page text preserving structure
function extractCTAContent($: cheerio.CheerioAPI): string {
  // Remove script and style elements first
  $('script, style, noscript').remove();
  
  // Build structured text representation preserving layout
  const textParts: string[] = [];
  const processedElements = new Set<cheerio.Element>();
  
  // Process the page in natural reading order
  $('body').find('*').each((_, element) => {
    const $el = $(element);
    
    // Skip if already processed or not visible
    if (processedElements.has(element)) {
      return;
    }
    
    // Skip hidden elements
    if ($el.css('display') === 'none' || $el.css('visibility') === 'hidden') {
      return;
    }
    
    // Get direct text content (not from children)
    const directText = $el.contents()
      .filter(function() { return this.type === 'text'; })
      .text()
      .trim();
    
    if (directText) {
      // Mark as processed
      processedElements.add(element);
      
      // Preserve headings with line breaks
      if ($el.is('h1, h2, h3, h4, h5, h6')) {
        textParts.push('\n' + directText + '\n');
      }
      // Preserve paragraph breaks
      else if ($el.is('p, div, section, article')) {
        if (directText.length > 0) {
          textParts.push(directText + '\n');
        }
      }
      // Inline elements including buttons and links
      else if ($el.is('a, button, span, strong, em')) {
        if (directText.length > 0) {
          textParts.push(directText + ' ');
        }
      }
      // List items
      else if ($el.is('li')) {
        textParts.push('• ' + directText + '\n');
      }
    }
  });
  
  // Clean up and normalize whitespace while preserving structure
  let pageText = textParts.join('');
  
  // Collapse multiple blank lines to maximum of 2
  pageText = pageText.replace(/\n{3,}/g, '\n\n');
  
  // Collapse multiple spaces to single space
  pageText = pageText.replace(/ {2,}/g, ' ');
  
  // Trim each line
  pageText = pageText.split('\n').map(line => line.trim()).join('\n');
  
  // Remove empty lines at start and end
  pageText = pageText.trim();
  
  // If extraction failed or too short, try simpler approach
  if (pageText.length < 100) {
    // Fallback: just get all text from body
    pageText = $('body').text()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();
  }
  
  return pageText;
}