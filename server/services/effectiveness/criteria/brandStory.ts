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
    
    // Comprehensive section detection beyond just "about"
    const aboutSelectors = [
      'section[class*="about"]', '.about-us', '.our-story', '.company-story',
      '[class*="story"]', '.mission', '.vision', '#about', '[id*="about"]',
      // Modern naming patterns
      '[class*="intro"]', '[class*="value"]', '[class*="approach"]',
      '[class*="services"]', '[class*="what-we-do"]', '[class*="why-we"]',
      '[class*="difference"]', 'section:nth-of-type(2)', 'section:nth-of-type(3)',
      '.container h2 + p', '[class*="content"] h2 + p'
    ];
    
    let storyContent = '';
    const contentParts: string[] = [];
    
    // 1. First try dedicated sections
    for (const selector of aboutSelectors) {
      const section = $(selector);
      if (section.length > 0) {
        const sectionText = section.text().trim();
        if (sectionText && sectionText.length > 100 && !isBoilerplate(sectionText)) {
          storyContent = sectionText.substring(0, 2000);
          break;
        }
      }
    }
    
    // 2. Look for value proposition patterns
    if (!storyContent || storyContent.length < 300) {
      const valuePatterns = [
        /we (help|provide|deliver|create|build|offer)/i,
        /our (approach|mission|goal|vision|commitment)/i,
        /years of experience/i,
        /trusted by/i,
        /working with/i,
        /specializ(e|ing) in/i,
        /focus(ed)? on/i,
        /dedicated to/i
      ];

      // Find paragraphs containing these patterns
      $('p, h2, h3, h4, li').each((_, el) => {
        const text = $(el).text().trim();
        if (valuePatterns.some(pattern => pattern.test(text)) && 
            text.length > 40 && text.length < 500 && !isBoilerplate(text)) {
          contentParts.push(text);
        }
      });
    }
    
    // 3. Extract structured content lists
    $('ul, ol').each((_, list) => {
      const $list = $(list);
      // Check if this list is likely content (not navigation)
      if (!$list.closest('nav, header, footer').length) {
        const items = $list.find('li').slice(0, 6);
        const listContent: string[] = [];
        
        items.each((_, li) => {
          const text = $(li).text().trim();
          if (text.length > 20 && text.length < 200 && 
              !text.match(/^(home|about|contact|blog|careers|privacy)/i) &&
              !isBoilerplate(text)) {
            listContent.push(text);
          }
        });
        
        if (listContent.length >= 3) {
          contentParts.push(listContent.join('. '));
        }
      }
    });
    
    // 4. Smart header + content pairing
    $('h2, h3, h4').each((_, heading) => {
      const $heading = $(heading);
      const headingText = $heading.text().trim();
      
      // Skip navigation/footer headings
      if ($heading.closest('nav, header, footer').length) return;
      
      // Look for brand-relevant headings
      const relevantPatterns = [
        /who we|what we|why we|how we/i,
        /our (story|mission|approach|values|team|expertise)/i,
        /about|story|mission|vision/i,
        /services|solutions|capabilities/i,
        /difference|different|unique|why choose/i
      ];
      
      if (relevantPatterns.some(p => p.test(headingText))) {
        // Get next siblings until next heading
        const content: string[] = [];
        let current = $heading.next();
        
        while (current.length && !current.is('h1, h2, h3, h4')) {
          if (current.is('p, ul, ol, blockquote')) {
            const text = current.text().trim();
            if (!isBoilerplate(text)) {
              content.push(text);
            }
          }
          current = current.next();
        }
        
        if (content.length > 0) {
          contentParts.push(`${headingText}: ${content.join(' ')}`);
        }
      }
    });
    
    // 5. Extract from feature/service cards
    const cardSelectors = [
      '[class*="card"]',
      '[class*="feature"]',
      '[class*="service"]',
      '[class*="grid"] > div',
      '[class*="col-"] > div'
    ];

    cardSelectors.forEach(selector => {
      $(selector).slice(0, 6).each((_, card) => {
        const $card = $(card);
        const title = $card.find('h3, h4, h5').first().text().trim();
        const desc = $card.find('p').first().text().trim();
        
        if (title && desc && desc.length > 30 && !isBoilerplate(desc)) {
          contentParts.push(`${title}: ${desc}`);
        }
      });
    });
    
    // 6. Improved fallback strategy
    if (contentParts.length < 3) {
      // Get main content area
      const mainContent = $('main, [role="main"], #content, .content').first();
      
      if (mainContent.length) {
        // Get all text nodes from main content
        mainContent.find('h2, h3, p').slice(0, 10).each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          
          // Score the text for relevance
          let score = 0;
          
          // Positive indicators
          if (text.length > 50 && text.length < 300) score++;
          if (/we|our|us/i.test(text)) score++;
          if (/help|provide|deliver|solution|service/i.test(text)) score++;
          if (/year|experience|expert|leader/i.test(text)) score++;
          
          // Negative indicators
          if (isBoilerplate(text)) score -= 2;
          if ($el.closest('aside, .sidebar').length) score--;
          
          if (score > 0) {
            contentParts.push(text);
          }
        });
      }
    }
    
    // Get testimonials and case studies
    $('.testimonial, .case-study, [class*="testimonial"], [class*="success"], [class*="client"]')
      .slice(0, 3).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50 && text.length < 500 && !isBoilerplate(text)) {
        contentParts.push(text);
      }
    });
    
    // 7. Deduplication and assembly
    if (storyContent.length < 300) {
      // Remove duplicates and clean up
      const cleanedParts = contentParts
        .filter((text, index, self) => {
          // Remove exact duplicates
          if (self.indexOf(text) !== index) return false;
          
          // Remove if it's a substring of another part
          const isSubstring = self.some((other, otherIndex) => 
            otherIndex !== index && 
            other.includes(text) && 
            other.length > text.length
          );
          
          return !isSubstring;
        })
        .map(text => text.replace(/\s+/g, ' ').trim())
        .filter(text => text.length > 30); // Minimum length

      // Prioritize quality content
      cleanedParts.sort((a, b) => {
        // Prioritize content with "we/our" language
        const aScore = (a.match(/\b(we|our|us)\b/gi) || []).length;
        const bScore = (b.match(/\b(we|our|us)\b/gi) || []).length;
        return bScore - aScore;
      });

      // Take best content up to limit
      storyContent = cleanedParts.slice(0, 10).join(' ');
    }
    
    // If still too little, expand search
    if (storyContent.length < 300) {
      const additionalContent = $('section p').slice(0, 8)
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(text => text.length > 50 && text.length < 400 && !isBoilerplate(text))
        .join(' ');
      
      storyContent = (storyContent + ' ' + additionalContent);
    }
    
    // Final limit for API (increased for better analysis)
    storyContent = storyContent.substring(0, 2500);
    
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