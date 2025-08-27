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
             text.length < 30 || 
             text.length > 500;
    };

    // Utility function to check if text is a testimonial
    const isTestimonial = (text: string, $el: any): boolean => {
      // Check for quote marks or attribution
      const hasQuotes = Boolean(text.match(/[""].*[""]/)) || text.includes('"');
      const hasAttribution = Boolean(text.match(/\- .+, (CEO|President|Director|Manager)/i));
      const inTestimonialElement = $el.closest('.testimonial, [class*="testimonial"], blockquote').length > 0;
      
      return hasQuotes || hasAttribution || inTestimonialElement;
    };

    // 1. Identify Brand Story Sections First
    const storySelectors = [
      // Explicit story sections
      '[class*="about"]',
      '[class*="story"]',
      '[class*="history"]',
      '[class*="mission"]',
      '[class*="vision"]',
      '[class*="values"]',
      '[class*="founder"]',
      '[class*="journey"]',
      
      // Common story locations
      '#about',
      '.company-info'
    ];

    let storySection = null;
    let dedicatedStoryContent = '';

    for (const selector of storySelectors) {
      const section = $(selector).first();
      if (section.length && section.text().length > 100 && !isBoilerplate(section.text().trim())) {
        storySection = section;
        dedicatedStoryContent = section.text().trim().substring(0, 2000);
        break;
      }
    }

    // 2. Look for Brand Positioning & Story Content (more inclusive)
    const brandContentPatterns = [
      // Origin stories
      /founded|began|started|established|since \d{4}/i,
      /journey|evolution|grew|transformed/i,
      
      // Mission/purpose
      /our mission|we believe|we exist|our purpose/i,
      /dedicated to|committed to|passionate about/i,
      
      // Values/philosophy  
      /our approach|our philosophy|we value|our values/i,
      /principles|core belief|culture/i,
      
      // Differentiators (but not features)
      /what sets us apart|what makes us different|why choose/i,
      /unlike others|we're not just|more than just/i,
      
      // Company positioning (more inclusive)
      /we (help|work|partner|collaborate|focus|specialize)/i,
      /our (team|expertise|experience|clients|work)/i,
      /years of experience|award.winning|industry.leading/i,
      /trusted by|recognized|proven|results/i,
      /we're|we are|at \w+, we/i,
      
      // Value propositions
      /deliver|provide|create|build|develop|design/i,
      /solution|service|strategy|innovation|expertise/i,
      /performance|success|growth|outcomes|impact/i
    ];

    // Extract paragraphs matching these patterns (more inclusive)
    const storyParagraphs: string[] = [];
    $('p, h2, h3, h4, h5').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      
      // Skip navigation and footer content
      if ($el.closest('nav, footer, header').length > 0) return;
      
      if (brandContentPatterns.some(pattern => pattern.test(text)) &&
          text.length > 20 && text.length < 800 && !isBoilerplate(text) &&
          !isTestimonial(text, $el)) {
        storyParagraphs.push(text);
      }
    });

    // 3. Separate Story from Pure Service Lists - Less restrictive filtering
    const nonStoryPatterns = [
      /pricing|packages|plans|cost|fee\$/i,
      /click here|learn more|get started|sign up|contact us/i,
      /step 1|step 2|step 3|how it works/i,
      /features:|benefits:|includes:|what's included/i
      // Removed overly restrictive patterns like "we offer" and "solutions"
    ];

    const filteredStory = storyParagraphs.filter(text => 
      !nonStoryPatterns.some(pattern => pattern.test(text))
    );

    console.log('Found story sections:', storySection?.length || 0);
    console.log('Story paragraphs found:', storyParagraphs.length);
    console.log('After filtering:', filteredStory.length);
    
    // 3.5. Look for additional content in common positioning areas
    const additionalContent: string[] = [];
    
    // Look in specific sections that often contain brand content
    const brandSectionSelectors = [
      '.intro, [class*="intro"]',
      '[class*="value"]', '[class*="about"]',
      'section:nth-child(2)', 'section:nth-child(3)',
      '[class*="why"]', '[class*="difference"]',
      '.container > p', '.content > p',
      'main > section p', 'main > p'
    ];
    
    brandSectionSelectors.forEach(selector => {
      $(selector).slice(0, 8).each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Skip if already captured or if navigation/footer
        if ($el.closest('nav, footer, header').length > 0) return;
        if (storyParagraphs.includes(text) || filteredStory.includes(text)) return;
        
        // Look for brand-relevant content
        if ((text.match(/\b(we|our|us)\b/gi) || []).length >= 2 && // Multiple company references
            text.length > 30 && text.length < 600 && 
            !isBoilerplate(text) && !isTestimonial(text, $el)) {
          additionalContent.push(text);
        }
      });
    });
    
    console.log('Additional content found:', additionalContent.length);

    // 4. Extract Company Credentials
    const credentialPatterns = [
      /(\d+)\+?\s*years/i,  // "20+ years"
      /since (\d{4})/i,      // "since 2003"
      /(\d+)\+?\s*clients/i, // "500+ clients"
      /award[- ]winning/i,
      /recognized|certified|accredited/i,
      /trusted by/i
    ];

    const credentials: string[] = [];
    $('p, li, h3, h4').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (credentialPatterns.some(pattern => pattern.test(text)) &&
          text.length < 150 && !isBoilerplate(text) &&
          !isTestimonial(text, $el)) {
        credentials.push(text);
      }
    });

    // 6. Look for Team/Culture Content
    const teamCultureSelectors = [
      '[class*="team"]',
      '[class*="culture"]',
      '[class*="people"]'
    ];

    const teamCultureContent: string[] = [];
    teamCultureSelectors.forEach(selector => {
      const section = $(selector).first();
      if (section.length) {
        section.find('p').slice(0, 2).each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          if (text.length > 50 && text.length < 500 && !isBoilerplate(text) &&
              !isTestimonial(text, $el)) {
            teamCultureContent.push(text);
          }
        });
      }
    });

    // 7. Construct Coherent Narrative - Organize content by story type
    const storyElements = {
      origin: [] as string[],      // Founded, history
      mission: [] as string[],     // Why we exist
      approach: [] as string[],    // How we work
      values: [] as string[],      // What we believe
      impact: [] as string[],      // Results, difference we make
      credentials: [] as string[], // Years, clients, awards
      positioning: [] as string[]  // General company positioning
    };

    // Categorize extracted content from filtered story
    filteredStory.forEach(text => {
      if (/founded|began|started|since \d{4}/i.test(text)) {
        storyElements.origin.push(text);
      } else if (/mission|purpose|exist|believe/i.test(text)) {
        storyElements.mission.push(text);
      } else if (/approach|how we|process|method/i.test(text)) {
        storyElements.approach.push(text);
      } else if (/value|principle|culture|philosophy/i.test(text)) {
        storyElements.values.push(text);
      } else if (/result|impact|achieve|deliver/i.test(text)) {
        storyElements.impact.push(text);
      } else {
        storyElements.positioning.push(text); // General brand positioning
      }
    });

    // Add additional content to positioning
    storyElements.positioning.push(...additionalContent);

    // Add team/culture and credentials
    storyElements.values.push(...teamCultureContent);
    storyElements.credentials = credentials;

    // Build narrative in logical order - include positioning content
    const narrative = [
      ...storyElements.origin,
      ...storyElements.mission,
      ...storyElements.values,
      ...storyElements.approach,
      ...storyElements.positioning, // Include general positioning
      ...storyElements.impact,
      ...storyElements.credentials
    ].filter(text => text && text.length > 20);

    // Remove duplicates while preserving order
    const uniqueNarrative = [...new Set(narrative)];
    
    console.log('Final narrative elements:', uniqueNarrative.length);
    
    let storyContent = uniqueNarrative.join(' ');

    // Use dedicated story content if we found a comprehensive section
    if (dedicatedStoryContent.length > storyContent.length && dedicatedStoryContent.length > 300) {
      storyContent = dedicatedStoryContent;
    }

    // 8. Fallback for Minimal Sites
    if (storyContent.length < 200) {
      // Look for "why us" or differentiator content
      const differentiators: string[] = [];
      
      $('h2, h3, h4').each((_, el) => {
        const $el = $(el);
        const heading = $el.text().trim();
        if (heading.match(/why|different|unique|about us/i)) {
          // Get content after this heading
          let content = '';
          let current = $el.next();
          
          while (current.length && !current.is('h2, h3, h4') && differentiators.length < 3) {
            if (current.is('p, ul, ol')) {
              const text = current.text().trim();
              if (text.length > 50 && !isBoilerplate(text) && !isTestimonial(text, current)) {
                content += text + ' ';
              }
            }
            current = current.next();
          }
          
          if (content.trim().length > 50) {
            differentiators.push(content.trim().substring(0, 300));
          }
        }
      });
      
      // Look for meta description as last resort
      const metaDesc = $('meta[name="description"]').attr('content') || '';
      
      storyContent = [...differentiators, metaDesc].join(' ');
    }

    // Final limit for API
    storyContent = storyContent.substring(0, 2500)
    
    logger.info("Extracted comprehensive brand story content", {
      url: context.websiteUrl,
      contentLength: storyContent.length,
      storyElementsFound: {
        origin: storyElements.origin.length,
        mission: storyElements.mission.length,
        values: storyElements.values.length,
        approach: storyElements.approach.length,
        impact: storyElements.impact.length,
        credentials: storyElements.credentials.length
      },
      narrativeParagraphs: storyParagraphs.length,
      filteredAfterServiceRemoval: filteredStory.length,
      dedicatedSectionFound: dedicatedStoryContent.length > 0
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