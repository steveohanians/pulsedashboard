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
import path from "path";

export async function scorePositioning(
  context: ScoringContext,
  config: ScoringConfig,
  openai: OpenAI
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Utility function to check for boilerplate content
    const isBoilerplate = (text: string): boolean => {
      const boilerplatePatterns = [
        /^(menu|nav|footer|contact|copyright|privacy|terms|cookie|login|sign|search)/i,
        /^[\d\s\-\(\)]+$/, // Phone numbers
        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, // Emails
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // Dates
        /^(mon|tue|wed|thu|fri|sat|sun)/i, // Days
        /^(all rights reserved|©|\®|\™)/i,
        /cookie|privacy policy|terms of service|copyright/i
      ];
      
      return boilerplatePatterns.some(pattern => pattern.test(text)) || 
             text.length < 10 || 
             text.length > 500;
    };

    // 1. Expand Hero Section Detection with flexible patterns
    const heroSelectors = [
      '[class*="hero"]',  // Catches hero, hero__, hero--
      '[class*="banner"]',
      '[class*="masthead"]',
      'section:first-child',
      'main > section:first-child',
      '.intro, [class*="intro"]',
      'header + section',  // First section after header
      '[data-section="hero"]',
      '.jumbotron', '.header-content',
      'section:first-of-type', 'main > *:first-child',
      '[role="banner"]', '.landing', '[class*="landing"]'
    ];

    // 2. Extract ALL Heading Levels (h1-h6) including eyebrow text
    const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    let extractedHeadings: { [key: string]: string[] } = {};

    headings.forEach(tag => {
      $(tag).each((_, el) => {
        const text = $(el).text().trim();
        // Skip navigation/footer
        if (!$(el).closest('nav, footer').length && text.length > 3 && !isBoilerplate(text)) {
          if (!extractedHeadings[tag]) extractedHeadings[tag] = [];
          extractedHeadings[tag].push(text);
        }
      });
    });

    // Use H5/H6 if they appear before H1 (common pattern for eyebrow text)
    const eyebrowText = extractedHeadings.h5?.[0] || extractedHeadings.h6?.[0] || '';
    const mainHeadline = extractedHeadings.h1?.[0] || '';
    const subheading = extractedHeadings.h2?.[0] || extractedHeadings.h3?.[0] || '';

    // 3. Find Value Proposition Sections
    const valuePropSelectors = [
      '.intro, [class*="intro"]',
      '[class*="value"]',
      '[class*="about"]',
      'section:nth-child(2)',  // Second section often has value props
      'section:nth-child(3)',
      '[class*="features"]',
      '[class*="benefits"]',
      '[class*="services"]'
    ];

    let valuePropContent: string[] = [];
    valuePropSelectors.forEach(selector => {
      // Early exit if we have enough content
      if (valuePropContent.length >= 10) return; // Stop after 10 value prop items
      
      const section = $(selector).first();
      if (section.length && !section.closest('footer').length) {
        // Get all text content from this section - LIMITED
        section.find('h2, h3, h4, h5, p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 10 && text.length < 300 && !isBoilerplate(text)) {
            valuePropContent.push(text);
          }
        });
      }
    });

    // 4. Extract Differentiators and Proof Points
    const differentiatorPatterns = [
      /\d+\s*(year|client|project|company|brand)/i,  // "20+ years", "500+ clients"
      /award[- ]winning/i,
      /trusted by/i,
      /recognized/i,
      /leading|leader/i,
      /expert|expertise/i,
      /proven/i,
      /results/i
    ];

    const additionalContent: string[] = [];

    // Find elements containing these patterns
    $('p, h2, h3, h4, h5, li').each((_, el) => {
      const text = $(el).text().trim();
      if (differentiatorPatterns.some(pattern => pattern.test(text)) && 
          text.length > 10 && text.length < 200 && !isBoilerplate(text)) {
        additionalContent.push(text);
      }
    });

    // 5. Get List-Based Value Props - LIMITED PROCESSING  
    let processedLists = 0;
    const MAX_LISTS = 8; // Limit list processing
    $('ul, ol').each((_, list) => {
      if (processedLists++ >= MAX_LISTS) return false; // Stop after 8 lists
      const $list = $(list);
      // Skip navigation
      if ($list.closest('nav, header, footer').length) return;
      
      const items = $list.find('li');
      const listItems: string[] = [];
      
      items.each((_, li) => {
        const text = $(li).text().trim();
        // Look for value prop patterns
        if (text.match(/approach|performance|excellence|collaborative|expertise|solution/i) &&
            text.length > 15 && text.length < 150 && !isBoilerplate(text)) {
          listItems.push(text);
        }
      });
      
      if (listItems.length >= 2) {
        additionalContent.push(...listItems);
      }
    });

    // 6. Smart Content Assembly
    const contentParts: string[] = [];

    // 1. Eyebrow/intro text (if exists)
    if (eyebrowText && eyebrowText !== mainHeadline) {
      contentParts.push(eyebrowText);
    }

    // 2. Main headline
    if (mainHeadline) {
      contentParts.push(mainHeadline);
    }

    // 3. Subheading (if different from main)
    if (subheading && subheading !== mainHeadline) {
      contentParts.push(subheading);
    }

    // 4. Value prop content
    contentParts.push(...valuePropContent);

    // 5. Additional differentiators
    contentParts.push(...additionalContent);

    // Remove duplicates and clean
    const uniqueParts = [...new Set(contentParts)]
      .filter(text => text && text.length > 5)
      .map(text => text.replace(/\s+/g, ' ').trim());
      
    // Early content sufficiency check - avoid expensive fallback processing
    const currentContentLength = uniqueParts.join(' ').length;
    const hasEnoughContent = currentContentLength >= 400 && uniqueParts.length >= 4;

    // 7. Fallback Enhancement - If content is thin, expand search
    if (!hasEnoughContent && currentContentLength < 300) {
      // Get comprehensive sections of content
      $('section').each((_, section) => {
        $(section).find('h2, h3, p').each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 20 && text.length < 200 &&
              !text.match(/cookie|privacy|copyright/i) && !isBoilerplate(text)) {
            uniqueParts.push(text);
          }
        });
      });
    }

    // If still missing content, use proximity-based extraction
    if (!hasEnoughContent && uniqueParts.join(' ').length < 200) {
      const mainElement = $('main, [role="main"]').first();
      if (mainElement.length) {
        // Get everything from top of main content  
        const topContent: string[] = [];
        mainElement.children().each((_, child) => {
          $(child).find('h1, h2, h3, h4, h5, p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 10 && !$(el).closest('nav').length && !isBoilerplate(text)) {
              topContent.push(text);
            }
          });
        });
        
        uniqueParts.push(...topContent);
      }
    }

    const heroContent = uniqueParts
      .filter((text, index, self) => self.indexOf(text) === index)
      .join(' ')
      .substring(0, 1500)
    
    logger.info("Extracted comprehensive positioning content", {
      url: context.websiteUrl,
      mainHeadlineLength: mainHeadline.length,
      eyebrowTextLength: eyebrowText.length,
      subheadingLength: subheading.length,
      valuePropParts: valuePropContent.length,
      differentiatorParts: additionalContent.length,
      totalContentLength: heroContent.length
    });

    if (!heroContent) {
      return {
        criterion: 'positioning',
        score: 0,
        evidence: {
          description: 'No positioning content found',
          details: { mainHeadline, subheading, eyebrowText },
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
    
    // Replace template variables - use comprehensive content instead of individual pieces
    const prompt = effectivenessPrompt.promptTemplate
      .replace('{content}', heroContent)
      .replace('{h1}', mainHeadline)
      .replace('{subheading}', subheading)
      .replace('{firstParagraph}', valuePropContent[0] || '');
    
    // Log what we're sending to OpenAI
    logger.info("Comprehensive positioning content sent to OpenAI", {
      url: context.websiteUrl,
      mainHeadline: mainHeadline.substring(0, 100),
      subheading: subheading.substring(0, 100),
      eyebrowText: eyebrowText.substring(0, 100),
      contentLength: heroContent.length,
      contentPreview: heroContent.substring(0, 200) + '...'
    });
    
    let analysisText: string;

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
          300 // Increased tokens for vision analysis
        );

      } catch (visionError) {
        logger.warn('Vision analysis failed, falling back to text-only', {
          url: context.websiteUrl,
          error: visionError instanceof Error ? visionError.message : String(visionError)
        });
        
        // Fallback to existing text-only analysis
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
      // Standard text-only analysis (existing behavior)
      logger.info('Using text-only positioning analysis', {
        url: context.websiteUrl,
        hasFullPageScreenshot: !!context.fullPageScreenshot,
        model: config.openai.model
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

      analysisText = response.choices[0]?.message?.content?.trim() || '';
    }

    if (!analysisText) {
      throw new Error('No response from OpenAI positioning analysis');
    }

    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const cleanJsonText = analysisText.replace(/^```json\s*|\s*```$/g, '').trim();
      analysis = JSON.parse(cleanJsonText);
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
    
    // Remove the arbitrary 22-word limit and fix evidence extraction
    const wordCount = heroContent.split(/\s+/).length;
    const brevityPass = wordCount <= 30; // More realistic than 22
    
    // Equal weight for each element
    if (analysis.audience_named) {
      score += 2.5;
      passes.passed.push('audience_identified');
      if (analysis.audience_evidence) {
        evidenceDetails.audience_evidence = analysis.audience_evidence;
      }
    } else {
      passes.failed.push('no_target_audience');
    }
    
    if (analysis.outcome_present) {
      score += 2.5;
      passes.passed.push('value_stated');
      if (analysis.outcome_evidence) {
        evidenceDetails.outcome_evidence = analysis.outcome_evidence;
      }
    } else {
      passes.failed.push('no_specific_value');
    }
    
    if (analysis.capability_clear) {
      score += 2.5;
      passes.passed.push('capability_clear');
      if (analysis.capability_evidence) {
        evidenceDetails.capability_evidence = analysis.capability_evidence;
      }
    } else {
      passes.failed.push('no_capability_clear');
    }
    
    if (brevityPass) {
      score += 2.5;
      passes.passed.push('concise_messaging');
    } else {
      // Don't fail for word count, just don't add points
      // This is subjective and shouldn't penalize
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
          wordCount: mainHeadline.split(' ').length,
          mainHeadline,
          subheading,
          eyebrowText,
          valuePropPartsCount: valuePropContent.length,
          differentiatorPartsCount: additionalContent.length,
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