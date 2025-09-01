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
import { callOpenAIWithVision } from "../visionHelper";

export async function scoreBrandStory(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Modern brand story patterns
    const brandStoryIndicators = [
      /who we are|what we do|why we exist/i,
      /years of (experience|success|expertise)/i,
      /founded|established|since \d{4}/i,
      /our (mission|vision|purpose|goal)/i,
      /committed to|dedicated to|passionate about/i,
      /our approach|our philosophy|our values/i,
      /what makes us different|sets us apart/i,
      // Modern B2B language
      /expert.?led|ai.?powered|ai.?accelerated/i,
      /digital\s+(agency|solutions|experiences|transformation)/i,
      /results.?driven|outcome.?focused|performance/i,
      /innovative|cutting.?edge|next.?generation/i,
      /trusted\s+by|partnered?\s+with|worked?\s+with/i,
      /transform|accelerate|optimize|scale/i
    ];

    // Minimal exclusions - only obvious non-story content
    const notBrandStory = [
      /cookie|privacy|terms\s+of\s+service/i,
      /copyright|©|all\s+rights\s+reserved/i,
      /\d+\s+min\s+read/i, // Blog post indicators
      /by\s+[A-Z][a-z]+\s+[A-Z][a-z]+/ // Author bylines
    ];

    // Filter function
    const isBrandStoryContent = (text: string): boolean => {
      if (notBrandStory.some(pattern => pattern.test(text))) {
        return false;
      }
      return text.length > 20 && text.length < 500;
    };

    // Simplified single-pass extraction
    const extractCompleteBrandStory = ($: cheerio.Root): string => {
      const storyParts: string[] = [];
      
      // 1. Get meta descriptions first (always fast)
      const metaTags = [
        $('meta[name="description"]').attr('content'),
        $('meta[property="og:description"]').attr('content')
      ].filter(Boolean);
      storyParts.push(...metaTags);
      
      // 2. Get hero/intro content (most important)
      const heroSelectors = [
        'h1', '.hero h2', '.hero p',
        '[class*="hero"] h1, [class*="hero"] h2, [class*="hero"] p',
        'header h1, header h2, header p',
        'section:first-of-type h1, section:first-of-type h2, section:first-of-type p'
      ];
      
      $(heroSelectors.join(', ')).slice(0, 10).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 20 && text.length < 500 && !storyParts.includes(text)) {
          storyParts.push(text);
        }
      });
      
      // 3. Get about/mission content
      const aboutSelectors = [
        '.about, .mission, .vision, .story',
        '[class*="about"], [class*="mission"]',
        'section:has(h2:contains("About"))',
        'section:has(h2:contains("Who"))',
        'section:has(h2:contains("Mission"))'
      ];
      
      $(aboutSelectors.join(', ')).each((i, section) => {
        if (i > 5) return false; // Limit sections processed
        $(section).find('h2, h3, h4, p').slice(0, 5).each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 20 && text.length < 500 && !storyParts.includes(text)) {
            storyParts.push(text);
          }
        });
      });
      
      // 4. Try __NEXT_DATA__ if available (with proper limits)
      const MAX_NEXT_DATA_SIZE = 50000; // 50KB limit
      const nextDataScript = $('script#__NEXT_DATA__').html();
      if (nextDataScript && nextDataScript.length < MAX_NEXT_DATA_SIZE) {
        try {
          const nextData = JSON.parse(nextDataScript);
          let itemsProcessed = 0;
          const MAX_ITEMS = 20;
          
          const extractFromObj = (obj: any, depth = 0): void => {
            if (depth > 3 || itemsProcessed >= MAX_ITEMS) return;
            
            if (typeof obj === 'string' && obj.length > 30 && obj.length < 500) {
              if (isBrandStoryContent(obj) && !storyParts.includes(obj)) {
                storyParts.push(obj);
                itemsProcessed++;
              }
            } else if (Array.isArray(obj)) {
              obj.slice(0, 5).forEach(item => extractFromObj(item, depth + 1));
            } else if (obj && typeof obj === 'object') {
              const relevantKeys = ['hero', 'about', 'intro', 'story', 'mission', 'value'];
              Object.keys(obj).forEach(key => {
                if (relevantKeys.some(k => key.toLowerCase().includes(k))) {
                  extractFromObj(obj[key], depth + 1);
                }
              });
            }
          };
          
          if (nextData?.props?.pageProps) {
            extractFromObj(nextData.props.pageProps);
          }
        } catch (e) {
          // Silent fail - not critical
        }
      }
      
      // 5. Extract metrics/proof (simplified)
      const proofPatterns = [
        /\d+\+?\s*(years|clients|projects|companies)/i,
        /since\s+\d{4}/i,
        /\d+%\s*(growth|increase|improvement)/i
      ];
      
      const targetSelectors = 'h1, h2, h3, h4, h5, h6, p, .about, .intro, .mission';
      $(targetSelectors).each((i, el) => {
        if (i > 200) return false; // Stop after 200 elements
        const text = $(el).text().trim();
        if (text.length < 200) {
          for (const pattern of proofPatterns) {
            if (pattern.test(text) && !storyParts.includes(text)) {
              storyParts.push(text);
              break;
            }
          }
        }
      });
      
      // 6. Deduplicate and format
      const unique = Array.from(new Set(storyParts));
      
      // 7. Return up to 2000 chars
      return unique.slice(0, 15).join('\n').substring(0, 2000);
    }

    // Main execution
    const storyContent = extractCompleteBrandStory($);
    
    logger.info("Extracted brand story content", {
      url: context.websiteUrl,
      contentLength: storyContent.length,
      linesFound: (storyContent.match(/\n/g) || []).length + 1
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

    // Get prompt from database
    const effectivenessPrompt = await getEffectivenessPrompt('brand_story');
    if (!effectivenessPrompt) {
      throw new Error('No prompt template available for brand_story criterion');
    }
    
    const prompt = effectivenessPrompt.promptTemplate.replace('{content}', storyContent);
    
    let analysisText: string;
    
    // Try vision-enhanced analysis first if full-page screenshot is available
    if (context.fullPageScreenshot) {
      try {
        logger.info("Using vision-enhanced brand story analysis", {
          url: context.websiteUrl
        });
        
        analysisText = await callOpenAIWithVision(
          storyContent,
          context.fullPageScreenshot,
          prompt,
          effectivenessPrompt.systemPrompt,
          openai,
          500
        );
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
      throw new Error('No response from OpenAI brand story analysis');
    }

    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const cleanJsonText = analysisText.replace(/^```json\s*|\s*```$/g, '').trim();
      analysis = JSON.parse(cleanJsonText);
    } catch (parseError) {
      logger.error('Failed to parse OpenAI brand story response', {
        response: analysisText,
        error: parseError
      });
      throw new Error('Invalid JSON response from brand story analysis');
    }

    // Calculate score and collect evidence (5 criteria × 2 points = 10 max)
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};

    // 1. Point of View (20% - 2 points)
    if (analysis.pov_present) {
      score += 2;
      passes.passed.push('pov_present');
      if (analysis.pov_evidence && analysis.pov_evidence !== 'none found') {
        evidenceDetails.pov_evidence = analysis.pov_evidence;
      }
    } else {
      passes.failed.push('no_clear_pov');
    }

    // 2. Mechanism/Approach (20% - 2 points)
    if (analysis.mechanism_named) {
      score += 2;
      passes.passed.push('mechanism_described');
      if (analysis.mechanism_evidence && analysis.mechanism_evidence !== 'none found') {
        evidenceDetails.mechanism_evidence = analysis.mechanism_evidence;
      }
    } else {
      passes.failed.push('no_clear_approach');
    }

    // 3. Outcomes Stated (20% - 2 points)
    if (analysis.outcomes_stated) {
      score += 2;
      passes.passed.push('outcomes_stated');
      if (analysis.outcomes_evidence && analysis.outcomes_evidence !== 'none found') {
        evidenceDetails.outcomes_evidence = analysis.outcomes_evidence;
      }
    } else {
      passes.failed.push('no_outcomes_stated');
    }

    // 4. Proof Elements (20% - 2 points)
    if (analysis.proof_elements) {
      score += 2;
      passes.passed.push('proof_elements');
      if (analysis.proof_evidence && analysis.proof_evidence !== 'none found') {
        evidenceDetails.proof_evidence = analysis.proof_evidence;
      }
    } else {
      passes.failed.push('no_proof_elements');
    }

    // 5. Visual Brand Story Support (20% - 2 points)
    if (analysis.visual_supports_story) {
      score += 2;
      passes.passed.push('visual_supports_story');
      if (analysis.visual_supports_evidence && analysis.visual_supports_evidence !== 'none found') {
        evidenceDetails.visual_supports_evidence = analysis.visual_supports_evidence;
      }
    } else {
      passes.failed.push('visual_story_weak');
    }

    // Store visual analysis data
    if (analysis.visual_hierarchy_score !== undefined) {
      evidenceDetails.visual_hierarchy_score = analysis.visual_hierarchy_score;
    }
    if (analysis.visual_effectiveness) {
      evidenceDetails.visual_effectiveness = analysis.visual_effectiveness;
    }

    // Handle additional fields gracefully
    const contentQuality = analysis.content_quality || 'complete';
    const extractionIssues = analysis.extraction_issues || [];
    
    // Adjust score based on content quality if provided
    if (contentQuality === 'fragment' || contentQuality === 'invalid') {
      score *= 0.75;
    } else if (contentQuality === 'partial') {
      score *= 0.9;
    }
    
    // Apply confidence factor from AI analysis
    const confidenceFactor = analysis.confidence || 1.0;
    score = score * confidenceFactor;
    
    // Ensure score is within bounds
    score = Math.min(10, Math.max(0, score));

    logger.info("Completed brand story analysis", {
      url: context.websiteUrl,
      score,
      confidence: analysis.confidence,
      visualSupportsStory: analysis.visual_supports_story
    });

    return {
      criterion: 'brand_story',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Brand story analysis: ${passes.passed.length}/5 criteria met`,
        details: {
          storyContent: storyContent.substring(0, 300) + '...',
          analysis,
          contentQuality,
          extractionIssues,
          ...evidenceDetails
        },
        reasoning: `Score based on 5 criteria: POV (${analysis.pov_present ? '✓' : '✗'}), mechanism (${analysis.mechanism_named ? '✓' : '✗'}), outcomes (${analysis.outcomes_stated ? '✓' : '✗'}), proof elements (${analysis.proof_elements ? '✓' : '✗'}), visual support (${analysis.visual_supports_story ? '✓' : '✗'})`
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