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
import { callOpenAIWithVision } from "../visionHelper";
import * as path from "path";

// Fallback scoring when OpenAI is unavailable
function calculateFallbackPositioning(heroContent: string): {
  score: number;
  analysis: any;
} {
  const analysis = {
    audience_named: /for\s+(companies|businesses|teams|leaders|enterprises)/i.test(heroContent),
    outcome_present: /help|enable|improve|increase|reduce|transform/i.test(heroContent),
    capability_clear: /we\s+(help|provide|deliver|create|build)/i.test(heroContent),
    brevity_check: heroContent.split(' ').length < 50,
    confidence: 0.3,
    fallback: true
  };
  
  let score = 3; // Base conservative score
  if (analysis.audience_named) score += 1.5;
  if (analysis.outcome_present) score += 1.5;
  if (analysis.capability_clear) score += 1.5;
  if (analysis.brevity_check) score += 1;
  
  return { score: Math.min(7, score), analysis };
}

export async function scorePositioning(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Simplified boilerplate detection
    const isBoilerplate = (text: string): boolean => {
      return /^(cookie|privacy|terms|copyright|©|menu|login|sign in)$/i.test(text.trim()) ||
             text.length < 5;
    };

    // Balanced positioning content extraction - hero-focused but comprehensive
    const extractPositioningContent = ($: cheerio.Root): string => {
      const positioningParts: string[] = [];
      
      // 1. Get the main headline (H1 or first H2)
      const h1 = $('h1').not('nav h1, footer h1').first().text().trim();
      const h2First = $('h2').not('nav h2, footer h2').first().text().trim();
      const mainHeadline = h1 || h2First;
      
      if (mainHeadline && mainHeadline.length > 5 && mainHeadline.length < 200) {
        positioningParts.push(mainHeadline);
      }
      
      // 2. Get hero section content (primary focus)
      const heroSection = $('[class*="hero"], header, section:first-of-type').first();
      if (heroSection.length) {
        heroSection.find('p, h2, h3, [class*="tagline"], [class*="subtitle"]').each((i, el) => {
          if (i > 5) return false;
          const text = $(el).text().trim();
          if (text && text !== mainHeadline && text.length > 10 && text.length < 300) {
            positioningParts.push(text);
          }
        });
      }
      
      // 3. Look for WHO (audience) throughout the page
      const audiencePatterns = [
        /for\s+(companies|businesses|organizations|teams|leaders|startups|enterprises)/i,
        /we (help|serve|work with|partner with)\s+\w+/i,
        /designed for|built for|made for/i,
        /whether you('re|'re)/i
      ];
      
      // 4. Look for WHAT (outcomes/value) throughout the page
      const outcomePatterns = [
        /we help|we enable|we empower|we provide/i,
        /transform|accelerate|optimize|improve|increase|reduce|drive|deliver/i,
        /results|outcomes|success|growth|performance|revenue/i,
        /solution|platform|service|software/i
      ];
      
      // 5. Look for HOW (differentiators) throughout the page
      const differentiatorPatterns = [
        /trusted by|used by|chosen by|loved by/i,
        /unlike|different|unique|only|first/i,
        /years of experience|expertise|proven|award/i,
        /our approach|our method|our process|our framework/i
      ];
      
      // Scan broader but with limits (first 50 text elements)
      const allPatterns = [...audiencePatterns, ...outcomePatterns, ...differentiatorPatterns];
      let elementsScanned = 0;
      const maxElements = 50;
      
      $('p, h2, h3, h4, li').each((_, el) => {
        if (elementsScanned++ >= maxElements) return false;
        
        const text = $(el).text().trim();
        if (text.length > 20 && text.length < 250 && !isBoilerplate(text)) {
          // Check if it matches positioning patterns
          if (allPatterns.some(pattern => pattern.test(text))) {
            if (!positioningParts.includes(text)) {
              positioningParts.push(text);
            }
          }
        }
      });
      
      // 6. Extract any eyebrow text (small text above headline)
      const eyebrowSelectors = [
        '.eyebrow', '[class*="eyebrow"]',
        'h5:first-of-type', 'h6:first-of-type',
        '[class*="overline"]', '[class*="pre-heading"]'
      ];
      
      $(eyebrowSelectors.join(',')).first().each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 5 && text.length < 100) {
          positioningParts.unshift(text);
        }
      });
      
      // 7. Look for about/intro sections specifically
      const aboutSelectors = [
        '[class*="about"]:not(nav *, footer *)',
        '[class*="intro"]:not(nav *, footer *)',
        'section:has(h2:contains("Who"))',
        'section:has(h2:contains("What"))'
      ];
      
      $(aboutSelectors.join(',')).each((i, section) => {
        if (i > 2) return false; // Check first 3 matching sections
        $(section).find('p').slice(0, 3).each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 30 && text.length < 250 && !positioningParts.includes(text)) {
            positioningParts.push(text);
          }
        });
      });
      
      // 8. Return clean, deduplicated content (expanded limit)
      const unique = Array.from(new Set(positioningParts));
      return unique.slice(0, 15).join('\n').substring(0, 1500);
    };

    // Extract focused positioning content
    let heroContent = extractPositioningContent($);

    if (!heroContent || heroContent.length < 50) {
      // Fallback: get first section's text
      const fallbackContent = $('main, body').first()
        .find('h1, h2, h3, p').slice(0, 10)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(text => text.length > 10 && text.length < 300)
        .join('\n')
        .substring(0, 1000);
        
      heroContent = fallbackContent;
    }

    // Prepare content for OpenAI
    const contentForAI = {
      heroContent: heroContent,
      mainHeadline: $('h1').first().text().trim() || $('h2').first().text().trim(),
      subheading: $('h1 + p, h2 + p, [class*="hero"] p').first().text().trim()
    };
    
    logger.info("Extracted positioning content", {
      url: context.websiteUrl,
      contentLength: heroContent.length,
      mainHeadline: contentForAI.mainHeadline.substring(0, 100)
    });

    if (!heroContent) {
      return {
        criterion: 'positioning',
        score: 0,
        evidence: {
          description: 'No positioning content found',
          details: { mainHeadline: contentForAI.mainHeadline },
          reasoning: 'Unable to evaluate positioning without hero content'
        },
        passes: {
          passed: [],
          failed: ['audience_named', 'outcome_present', 'capability_clear', 'brevity_check']
        }
      };
    }

    // Get prompt from database
    const effectivenessPrompt = await getEffectivenessPrompt('positioning');
    if (!effectivenessPrompt) {
      throw new Error('No prompt template available for positioning criterion');
    }
    
    // Replace template variables with clean content
    const prompt = effectivenessPrompt.promptTemplate
      .replace('{content}', contentForAI.heroContent)
      .replace('{h1}', contentForAI.mainHeadline)
      .replace('{subheading}', contentForAI.subheading)
      .replace('{firstParagraph}', contentForAI.subheading); // Use same as subheading
    
    let analysis;
    let analysisText: string = '';

    try {
      // Try vision-enhanced analysis if full-page screenshot is available
      if (context.fullPageScreenshot && config.openai.model === 'gpt-4o') {
        try {
          // Convert screenshot URL to file path
          const screenshotFilename = context.fullPageScreenshot.split('/').pop();
          const screenshotPath = path.join('uploads', 'screenshots', screenshotFilename);
          
          logger.info('Using vision-enhanced positioning analysis', {
            url: context.websiteUrl,
            screenshotPath: screenshotFilename
          });

          analysisText = await callOpenAIWithVision(
            heroContent,
            screenshotPath,
            effectivenessPrompt.promptTemplate,
            effectivenessPrompt.systemPrompt,
            openai,
            300
          );

        } catch (visionError) {
          logger.warn('Vision analysis failed, falling back to text-only', {
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
            max_tokens: 200
          });

          analysisText = response.choices[0]?.message?.content?.trim() || '';
        }
      } else {
        // Standard text-only analysis
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

        analysisText = response.choices[0]?.message?.content?.trim() || '';
      }

      if (!analysisText) {
        throw new Error('No response from OpenAI positioning analysis');
      }

      // Extract JSON from markdown code blocks if present
      const cleanJsonText = analysisText.replace(/^```json\s*|\s*```$/g, '').trim();
      analysis = JSON.parse(cleanJsonText);

    } catch (error) {
      logger.warn('AI analysis failed, using fallback', { 
        criterion: 'positioning', 
        error: error instanceof Error ? error.message : String(error),
        url: context.websiteUrl
      });
      
      const fallback = calculateFallbackPositioning(heroContent);
      analysis = fallback.analysis;
      
      // Continue with fallback scoring logic
      return {
        criterion: 'positioning',
        score: fallback.score,
        evidence: {
          description: `Positioning analysis using fallback pattern matching`,
          details: {
            audience_named: analysis.audience_named,
            outcome_present: analysis.outcome_present,
            capability_clear: analysis.capability_clear,
            brevity_check: analysis.brevity_check,
            heroContent: heroContent.substring(0, 200) + '...'
          },
          reasoning: 'Fallback analysis due to AI unavailability. Conservative scoring based on content patterns.',
          fallbackUsed: true
        },
        passes: {
          passed: Object.entries(analysis).filter(([key, value]) => 
            key !== 'confidence' && key !== 'fallback' && value === true
          ).map(([key]) => key),
          failed: Object.entries(analysis).filter(([key, value]) => 
            key !== 'confidence' && key !== 'fallback' && value === false
          ).map(([key]) => key)
        }
      };
    }

    // Check for buzzwords (reduces score)
    const buzzwordCount = config.buzzwords.reduce((count, word) => {
      return count + (heroContent.toLowerCase().includes(word.toLowerCase()) ? 1 : 0);
    }, 0);

    // Calculate score based on criteria and collect evidence
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};
    
    // Equal weight for each criterion (5 criteria × 2 points = 10 points max)
    if (analysis.audience_named) {
      score += 2;
      passes.passed.push('audience_identified');
      if (analysis.audience_evidence) {
        evidenceDetails.audience_evidence = analysis.audience_evidence;
      }
    } else {
      passes.failed.push('no_target_audience');
    }
    
    if (analysis.outcome_present) {
      score += 2;
      passes.passed.push('value_stated');
      if (analysis.outcome_evidence) {
        evidenceDetails.outcome_evidence = analysis.outcome_evidence;
      }
    } else {
      passes.failed.push('no_specific_value');
    }
    
    if (analysis.capability_clear) {
      score += 2;
      passes.passed.push('capability_clear');
      if (analysis.capability_evidence) {
        evidenceDetails.capability_evidence = analysis.capability_evidence;
      }
    } else {
      passes.failed.push('no_capability_clear');
    }
    
    if (analysis.brevity_check) {
      score += 2;
      passes.passed.push('concise_messaging');
      if (analysis.brevity_evidence) {
        evidenceDetails.brevity_evidence = analysis.brevity_evidence;
      }
    } else {
      passes.failed.push('headline_too_long');
    }

    // 5th criterion: visual positioning support
    if (analysis.visual_supports_positioning) {
      score += 2;
      passes.passed.push('visual_supports_positioning');
      if (analysis.visual_supports_evidence) {
        evidenceDetails.visual_supports_evidence = analysis.visual_supports_evidence;
      }
    } else {
      passes.failed.push('visual_positioning_weak');
    }

    // Store visual analysis data
    if (analysis.visual_hierarchy_score !== undefined) {
      evidenceDetails.visual_hierarchy_score = analysis.visual_hierarchy_score;
    }
    if (analysis.visual_effectiveness) {
      evidenceDetails.visual_effectiveness = analysis.visual_effectiveness;
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
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Positioning analysis of hero content: ${passes.passed.length}/5 criteria passed`,
        details: {
          heroContent,
          analysis,
          buzzwordCount,
          buzzwordPenalty,
          wordCount: contentForAI.mainHeadline.split(' ').length,
          mainHeadline: contentForAI.mainHeadline,
          subheading: contentForAI.subheading,
          ...evidenceDetails
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
  
  if (failed.includes('no_target_audience')) {
    recommendations.push("**Define your target audience** - Be specific about who you serve");
  }
  
  if (failed.includes('no_specific_value')) {
    recommendations.push("**Clarify the outcome** - State what result visitors will achieve");
  }
  
  if (failed.includes('no_capability_clear')) {
    recommendations.push("**Specify your capabilities** - Explain how you deliver results");
  }
  
  if (failed.includes('headline_too_long')) {
    recommendations.push("**Simplify your message** - Keep hero content concise and scannable");
  }
  
  if (buzzwordCount > 0) {
    recommendations.push(`**Reduce buzzwords** - Replace ${buzzwordCount} generic terms with specific language`);
  }
  
  // Combine insights and recommendations
  let result = insights[0];
  if (recommendations.length > 0) {
    result += ` Key improvements: ${recommendations.join('; ')}.`;
  }
  
  return result;
}