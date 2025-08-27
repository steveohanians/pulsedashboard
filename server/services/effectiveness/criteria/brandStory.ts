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
    
    // Brand story INCLUDES:
    const brandStoryIndicators = [
      /who we are|what we do|why we exist/i,
      /years of (experience|success|expertise)/i,
      /founded|established|since \d{4}/i,
      /our (mission|vision|purpose|goal)/i,
      /committed to|dedicated to|passionate about/i,
      /our approach|our philosophy|our values/i,
      /what makes us different|sets us apart/i
    ];

    // Brand story EXCLUDES:
    const notBrandStory = [
      /guide to|tips for|how to|trends in|best practices/i,
      /our services include|services we offer/i,
      /case study|client story|testimonial|said/i,
      /click here|learn more|see more|read more/i,
      /\d{4}\s+(trends|guide|strategy|tips)/i,
      /blog|article|post|whitepaper/i,
      /©|copyright|privacy|cookie|terms/i
    ];

    // Filter function
    function isBrandStoryContent(text: string): boolean {
      // Exclude if matches non-story patterns
      if (notBrandStory.some(pattern => pattern.test(text))) {
        return false;
      }
      // Include if matches story patterns OR is in right location
      return brandStoryIndicators.some(pattern => pattern.test(text)) ||
             (text.length > 50 && text.length < 300);
    }

    // Smart Section Detection
    function extractBrandStory($: cheerio.CheerioAPI): string[] {
      let brandStoryContent: string[] = [];
      
      // Priority 1: Look for dedicated brand sections
      const primarySelectors = [
        '.intro, [class*="intro"]:not([class*="service"])',
        '[class*="about"]:not([class*="service"])',
        '[class*="story"]',
        '[class*="mission"]',
        '[class*="value"]:not([class*="service"])',
        'section:nth-child(2)', // Often contains brand story
        'section:nth-child(3)'
      ];
      
      // Try each selector until we find good content
      for (const selector of primarySelectors) {
        const section = $(selector).first();
        if (section.length && !section.closest('nav, footer').length) {
          const texts = section.find('h2, h3, h4, h5, p').slice(0, 6)
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(text => isBrandStoryContent(text));
          
          if (texts.length >= 2) {
            brandStoryContent.push(...texts);
            break; // Found good content, stop looking
          }
        }
      }
      
      // Priority 2: If no dedicated section, look for scattered brand elements
      if (brandStoryContent.length < 3) {
        $('h2, h3, h4, h5, p').slice(0, 20).each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          
          // Skip if in navigation or footer
          if ($el.closest('nav, header, footer, aside').length) return;
          
          // Check if it's brand story content
          if (isBrandStoryContent(text)) {
            brandStoryContent.push(text);
          }
        });
      }
      
      return brandStoryContent;
    }

    // Aggressive Deduplication
    function deduplicateContent(content: string[]): string[] {
      const cleaned: string[] = [];
      const fingerprints = new Set<string>();
      
      content.forEach(text => {
        // Create multiple fingerprints for better duplicate detection
        const fingerprint1 = text.substring(0, 50).toLowerCase().replace(/\s+/g, '');
        const fingerprint2 = text.substring(0, 30).toLowerCase().replace(/\s+/g, '');
        
        // Check if we've seen this before
        if (!fingerprints.has(fingerprint1) && !fingerprints.has(fingerprint2)) {
          // Also check if this is a substring of existing content
          const isDuplicate = cleaned.some(existing => {
            const similarity = existing.includes(text) || 
                              text.includes(existing) ||
                              (existing.substring(0, 30) === text.substring(0, 30));
            return similarity;
          });
          
          if (!isDuplicate) {
            fingerprints.add(fingerprint1);
            fingerprints.add(fingerprint2);
            cleaned.push(text);
          }
        }
      });
      
      return cleaned;
    }

    // Extract Company Credentials
    function extractCredentials($: cheerio.CheerioAPI): string[] {
      const credentials: string[] = [];
      const credentialPatterns = [
        /(\d+)\+?\s*years?\s*(of|in)?\s*(experience|business|success)?/i,
        /since\s+\d{4}/i,
        /founded\s+(in\s+)?\d{4}/i,
        /(\d+)\+?\s*(clients|customers|companies|brands)/i,
        /award[- ]winning/i,
        /recognized|certified|trusted\s+by/i
      ];
      
      // Look specifically for credential content
      $('*').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length < 150 && credentialPatterns.some(p => p.test(text))) {
          // Avoid duplicates from nested elements
          const tagName = (el as any).tagName || (el as any).name || '';
          if (!$(el).children().length || tagName.match(/^(p|h[2-6]|li)$/i)) {
            credentials.push(text);
          }
        }
      });
      
      return [...new Set(credentials)].slice(0, 3); // Max 3 credentials
    }

    // Build Labeled Narrative Structure
    function buildLabeledNarrative(contentPieces: string[], credentials: string[]): string[] {
      const narrative = {
        FOUNDATION: [] as string[],      // Founded/Established/Years
        IDENTITY: [] as string[],        // Who we are
        MISSION: [] as string[],         // Why we exist
        APPROACH: [] as string[],        // How we work
        VALUES: [] as string[],          // What we believe
        DIFFERENTIATORS: [] as string[], // What sets us apart
        PROOF: [] as string[],           // Credentials/Trust
        IMPACT: [] as string[]           // Results we deliver
      };
      
      // Add credentials to PROOF
      narrative.PROOF = credentials;
      
      // Categorize content with improved patterns
      contentPieces.forEach(text => {
        const lowerText = text.toLowerCase();
        
        if (/\b(founded|established|began|started|since)\b/i.test(text)) {
          narrative.FOUNDATION.push(text);
        } 
        else if (/^(we are|as a|our team|we're a)/i.test(text)) {
          narrative.IDENTITY.push(text);
        } 
        else if (/(our mission|we exist|purpose|dedicated to|committed to)/i.test(text)) {
          narrative.MISSION.push(text);
        } 
        else if (/(our approach|how we|process|method|we work)/i.test(text)) {
          narrative.APPROACH.push(text);
        } 
        else if (/(we believe|our values|philosophy|principles)/i.test(text)) {
          narrative.VALUES.push(text);
        } 
        else if (/(unlike|different|unique|sets us apart|why choose)/i.test(text)) {
          narrative.DIFFERENTIATORS.push(text);
        } 
        else if (/(results|outcomes|impact|achieve|deliver|help)/i.test(text)) {
          narrative.IMPACT.push(text);
        }
        // Default categorization based on content
        else if (lowerText.includes('we') || lowerText.includes('our')) {
          if (text.length < 100) {
            narrative.VALUES.push(text);
          } else {
            narrative.APPROACH.push(text);
          }
        }
      });
      
      // Build labeled output
      const labeledStory: string[] = [];
      
      Object.entries(narrative).forEach(([label, content]) => {
        if (content.length > 0) {
          // Take best/first item from each category
          const bestContent = content
            .filter(text => text && text.length > 20)
            .sort((a, b) => b.length - a.length)[0];
          
          if (bestContent) {
            labeledStory.push(`${label}: ${bestContent}`);
          }
        }
      });
      
      return labeledStory;
    }

    // Complete Extraction Function
    function extractCompleteBrandStory($: cheerio.CheerioAPI): string {
      // Step 1: Extract brand story content
      const storyContent = extractBrandStory($);
      
      // Step 2: Extract credentials separately
      const credentials = extractCredentials($);
      
      // Step 3: Combine and deduplicate
      const allContent = [...storyContent, ...credentials];
      const deduplicated = deduplicateContent(allContent);
      
      // Step 4: Build labeled narrative
      const labeledNarrative = buildLabeledNarrative(
        deduplicated.filter(text => !credentials.includes(text)),
        credentials
      );
      
      // Step 5: Format output
      if (labeledNarrative.length >= 3) {
        return labeledNarrative.join('\n');
      }
      
      // Step 6: Fallback if insufficient content
      if (labeledNarrative.length < 3) {
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const ogDesc = $('meta[property="og:description"]').attr('content') || '';
        
        labeledNarrative.push(`IDENTITY: ${metaDesc}`);
        if (ogDesc && ogDesc !== metaDesc) {
          labeledNarrative.push(`MISSION: ${ogDesc}`);
        }
      }
      
      // Return labeled story (max 2500 chars)
      return labeledNarrative
        .filter(line => line.split(': ')[1]?.length > 10) // Ensure content after label
        .slice(0, 8) // Max 8 labeled sections
        .join('\n')
        .substring(0, 2500);
    }

    // Main execution
    const storyContent = extractCompleteBrandStory($);
    
    logger.info("Extracted labeled brand story content", {
      url: context.websiteUrl,
      contentLength: storyContent.length,
      sectionsFound: (storyContent.match(/\n/g) || []).length + 1
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
    
    // Log the full content for debugging
    console.log("\n========== BRAND STORY CONTENT SENT TO OPENAI ==========");
    console.log(storyContent);
    console.log("========== END BRAND STORY CONTENT ==========\n");
    
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

    // Brand Story Scoring Logic - Updated for typical B2B content
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];

    // Look for quantified results (more common in B2B than case studies)
    const numberPattern = /(\d{1,3}[,.]?\d{0,3})\s*(%|percent|million|billion|thousand|times|x|years?|clients?|customers?|companies|projects?)/gi;
    const quantifiedResults = storyContent.match(numberPattern) || [];
    const hasQuantifiedOutcomes = quantifiedResults.length >= 1; // Lowered threshold

    // Check for proof elements (replacing case study focus)
    const proofKeywords = ['trusted by', 'working with', 'partnered with', 'clients include', 'award', 'recognized', 'certified', 'years of experience', 'founded', 'since'];
    const hasProofElements = proofKeywords.some(keyword => 
      storyContent.toLowerCase().includes(keyword)
    );

    // Calculate score and collect evidence
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };
    const evidenceDetails: Record<string, any> = {};

    // 1. Point of View (25% - 2.5 points)
    if (analysis.pov_present) {
      score += 2.5;
      passes.passed.push('pov_present');
      if (analysis.pov_evidence && analysis.pov_evidence !== 'none found') {
        evidenceDetails.pov = analysis.pov_evidence;
      }
    } else {
      passes.failed.push('no_clear_pov');
    }

    // 2. Mechanism/Approach (25% - 2.5 points)
    if (analysis.mechanism_named) {
      score += 2.5;
      passes.passed.push('mechanism_described');
      if (analysis.mechanism_evidence && analysis.mechanism_evidence !== 'none found') {
        evidenceDetails.mechanism = analysis.mechanism_evidence;
      }
    } else {
      passes.failed.push('no_clear_approach');
    }

    // 3. Outcomes Stated (25% - 2.5 points)
    // Updated: outcomes_stated instead of outcomes_recent
    if (analysis.outcomes_stated) {
      if (hasQuantifiedOutcomes) {
        score += 2.5;
        passes.passed.push('quantified_outcomes');
        evidenceDetails.outcomes_quantified = quantifiedResults.slice(0, 3).join(', ');
      } else {
        score += 1.75; // Partial credit for non-quantified outcomes
        passes.passed.push('outcomes_mentioned');
      }
      if (analysis.outcomes_evidence && analysis.outcomes_evidence !== 'none found') {
        evidenceDetails.outcomes = analysis.outcomes_evidence;
      }
    } else {
      passes.failed.push('no_outcomes_stated');
    }

    // 4. Proof Elements (25% - 2.5 points)
    // Replaced case_complete with proof_elements
    if (analysis.proof_elements) {
      if (hasProofElements && hasQuantifiedOutcomes) {
        score += 2.5;
        passes.passed.push('strong_proof_elements');
      } else if (analysis.proof_elements || hasProofElements) {
        score += 1.75;
        passes.passed.push('some_proof_elements');
      }
      if (analysis.proof_evidence && analysis.proof_evidence !== 'none found') {
        evidenceDetails.proof = analysis.proof_evidence;
      }
    } else {
      passes.failed.push('no_proof_elements');
    }

    // Bonus points for B2B-specific quality indicators
    let bonusPoints = 0;

    // Check for industry/vertical focus (common in B2B)
    const industryKeywords = ['enterprise', 'B2B', 'SaaS', 'financial services', 'healthcare', 'manufacturing', 'technology'];
    if (industryKeywords.some(keyword => storyContent.toLowerCase().includes(keyword))) {
      bonusPoints += 0.5;
      passes.passed.push('industry_focus');
    }

    // Check for capability breadth (B2B companies often list multiple capabilities)
    const capabilityKeywords = ['strategy', 'consulting', 'implementation', 'support', 'solutions', 'services', 'expertise'];
    const capabilityCount = capabilityKeywords.filter(keyword => 
      storyContent.toLowerCase().includes(keyword)
    ).length;
    if (capabilityCount >= 3) {
      bonusPoints += 0.5;
      passes.passed.push('capability_breadth');
    }

    // Apply confidence factor and bonuses
    score = (score + bonusPoints) * (analysis.confidence || 0.75);
    score = Math.min(10, Math.max(0, score));

    logger.info("Completed brand story analysis", {
      url: context.websiteUrl,
      score,
      bonusPoints,
      hasQuantifiedOutcomes,
      quantifiedResults: quantifiedResults.length,
      hasProofElements,
      confidence: analysis.confidence
    });

    return {
      criterion: 'brand_story',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Brand story analysis: ${passes.passed.length}/4+ elements present with ${quantifiedResults.length} quantified results`,
        details: {
          storyContent: storyContent.substring(0, 300) + '...',
          analysis,
          hasQuantifiedOutcomes,
          quantifiedResults: quantifiedResults.slice(0, 3),
          hasProofElements,
          bonusPoints,
          ...evidenceDetails // Include extracted evidence
        },
        reasoning: `Score based on point of view (${analysis.pov_present ? 'present' : 'missing'}), mechanism explanation (${analysis.mechanism_named ? 'present' : 'missing'}), outcomes stated (${analysis.outcomes_stated ? 'found' : 'missing'}), and proof elements (${analysis.proof_elements || hasProofElements ? 'present' : 'missing'}). Bonus points: ${bonusPoints}`
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