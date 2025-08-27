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
    
    // Extract hero content with improved logic for all heading levels
    let h1 = $('h1').first().text().trim();
    
    // Enhanced hero section detection with modern patterns
    const heroSelectors = [
      '.hero', '#hero', '[class*="hero"]',
      '.banner', '#banner', '[class*="banner"]',
      '.jumbotron', '.masthead', '.header-content',
      '[class*="masthead"]', '[class*="jumbotron"]',
      'header section', 'main > section:first-child',
      'section:first-of-type', 'main > *:first-child',
      '[role="banner"]', '.intro', '[class*="intro"]',
      '.landing', '[class*="landing"]'
    ];
    
    // Utility function to check for boilerplate content
    const isBoilerplate = (text: string): boolean => {
      const boilerplatePatterns = [
        /^(menu|nav|footer|contact|copyright|privacy|terms|cookie|login|sign|search)/i,
        /^[\d\s\-\(\)]+$/, // Phone numbers
        /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, // Emails
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // Dates
        /^(mon|tue|wed|thu|fri|sat|sun)/i, // Days
        /^(all rights reserved|©|\®|\™)/i
      ];
      
      return boilerplatePatterns.some(pattern => pattern.test(text)) || 
             text.length < 10 || 
             text.length > 500;
    };
    
    let heroSection = null;
    for (const selector of heroSelectors) {
      const section = $(selector);
      if (section.length > 0) {
        heroSection = section.first();
        break;
      }
    }
    
    let subheading = '';
    let firstParagraph = '';
    const additionalContent: string[] = [];
    
    if (heroSection) {
      // Extract all heading levels from hero section
      const headings = heroSection.find('h1, h2, h3, h4, h5, h6, [class*="eyebrow"], [class*="subtitle"], [class*="tagline"]');
      headings.each((_, el) => {
        const text = $(el).text().trim();
        if (!subheading && text !== h1 && text.length > 5 && !isBoilerplate(text)) {
          subheading = text;
          return false; // break
        }
      });
      
      // Get first meaningful paragraph
      heroSection.find('p').each((_, el) => {
        const text = $(el).text().trim();
        if (!firstParagraph && text.length > 20 && !isBoilerplate(text)) {
          firstParagraph = text;
          return false; // break
        }
      });
      
      // Get additional hero content from various elements
      heroSection.find('h2, h3, h4, h5, .tagline, .value-prop, .subtitle, [class*="value"], [class*="benefit"]')
        .slice(0, 5).each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10 && text !== h1 && text !== subheading && !isBoilerplate(text)) {
          additionalContent.push(text);
        }
      });
    } else {
      // Enhanced fallback strategy for sites without clear hero sections
      const mainContent = $('main, [role="main"], #main, .main-content').first();
      const firstSection = mainContent.find('section, article, [class*="section"]').first();
      
      if (firstSection.length) {
        // Extract from first content section
        h1 = h1 || firstSection.find('h1').first().text().trim();
        subheading = firstSection.find('h2, h3, h4, h5').first().text().trim();
        firstParagraph = firstSection.find('p').first().text().trim();
      }
      
      // If still nothing, try visible text near top of page
      if (!subheading) {
        $('h2, h3, h4, h5, p').slice(0, 10).each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          
          // Check if element is likely visible and meaningful
          if (!isBoilerplate(text) && 
              !$el.closest('nav, header > *, footer').length &&
              $el.parents().length < 10) { // Not deeply nested
            
            if (!subheading && el.tagName.match(/^h[2-5]$/i)) {
              subheading = text;
            } else if (!firstParagraph && el.tagName.toLowerCase() === 'p') {
              firstParagraph = text;
            }
          }
        });
      }
      
      // Collect valuable heading content for analysis
      $('h2, h3, h4, h5').slice(0, 6).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 15 && !isBoilerplate(text) && text !== subheading) {
          additionalContent.push(text);
        }
      });
    }
    
    // Look for value proposition sections beyond hero
    const valuePropSelectors = [
      '.value-proposition', '[class*="value"]',
      '[class*="intro"]', '[class*="about"]',
      'section:nth-child(2)', '[class*="features"]',
      '[class*="benefits"]', '.description', '[class*="description"]'
    ];

    valuePropSelectors.forEach(selector => {
      const section = $(selector).first();
      if (section.length) {
        section.find('h2, h3, h4, p').slice(0, 5).each((_, el) => {
          const text = $(el).text().trim();
          if (text.length > 20 && text.length < 200 && !isBoilerplate(text)) {
            additionalContent.push(text);
          }
        });
      }
    });
    
    // Enhanced tagline and value prop detection
    $('.tagline, .value-prop, .headline, .slogan, [class*="tagline"], [class*="slogan"], [class*="headline"]')
      .slice(0, 3).each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && !isBoilerplate(text)) {
        additionalContent.push(text);
      }
    });
    
    // Final content assembly with improved deduplication
    const contentParts = [
      h1,
      subheading,
      firstParagraph,
      ...additionalContent
    ]
    .filter(text => text && text.trim().length > 0)
    .map(text => text.replace(/\s+/g, ' ').trim()) // Clean whitespace
    .filter((text, index, self) => {
      // Remove duplicates and near-duplicates
      return self.findIndex(t => 
        t === text || 
        (t.includes(text) && t.length < text.length * 1.2)
      ) === index;
    });

    // If we have too little content, be more aggressive in collection
    if (contentParts.join(' ').length < 200) {
      $('p').slice(0, 5).each((_, el) => {
        const text = $(el).text().trim();
        if (!isBoilerplate(text)) {
          contentParts.push(text);
        }
      });
    }
    
    const heroContent = contentParts
      .join(' ')
      .substring(0, 1500); // Maintain limit for API efficiency
    
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
    
    // Replace all template variables
    const prompt = effectivenessPrompt.promptTemplate
      .replace('{h1}', h1)
      .replace('{subheading}', subheading)
      .replace('{firstParagraph}', firstParagraph)
      .replace('{content}', heroContent);
    
    // Log what we're sending to OpenAI
    logger.info("Positioning prompt content being sent to OpenAI", {
      url: context.websiteUrl,
      h1: h1.substring(0, 100),
      subheading: subheading.substring(0, 100),
      firstParagraph: firstParagraph.substring(0, 100),
      contentLength: heroContent.length,
      contentPreview: heroContent.substring(0, 200) + '...'
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