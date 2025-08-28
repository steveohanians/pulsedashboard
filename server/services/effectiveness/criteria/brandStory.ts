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

    // Modern Smart Section Detection with Framework Support
    function extractBrandStory($: cheerio.CheerioAPI): string[] {
      let brandStoryContent: string[] = [];
      // No artificial limits on content extraction
      
      // Priority 1: Try Next.js __NEXT_DATA__ (most reliable for Next.js sites)
      const nextDataScript = $('script#__NEXT_DATA__').html();
      if (nextDataScript) {
        try {
          const nextData = JSON.parse(nextDataScript);
          let processedItems = 0;
          const extractNextContent = (obj: any, depth = 0): void => {
            if (depth > 5) return;
            if (typeof obj === 'string' && obj.length > 30 && obj.length < 500) {
              if (isBrandStoryContent(obj)) {
                brandStoryContent.push(obj);
              }
            } else if (Array.isArray(obj)) {
              obj.forEach(item => extractNextContent(item, depth + 1));
            } else if (obj && typeof obj === 'object') {
              // Look for specific Next.js patterns
              const relevantKeys = ['hero', 'about', 'intro', 'story', 'mission', 
                                   'value', 'content', 'description', 'text', 'title',
                                   'heading', 'subheading', 'body'];
              Object.keys(obj).forEach(key => {
                if (relevantKeys.some(k => key.toLowerCase().includes(k))) {
                  extractNextContent(obj[key], depth + 1);
                }
              });
            }
          };
          
          // Check common Next.js data locations
          const pageProps = nextData?.props?.pageProps;
          if (pageProps) {
            extractNextContent(pageProps);
          }
          
          if (brandStoryContent.length >= 3) {
            logger.info("Extracted brand story from __NEXT_DATA__", {
              contentCount: brandStoryContent.length
            });
          }
          
          // Continue to extract comprehensive content from other sources too
        } catch (e) {
          logger.warn("Failed to parse __NEXT_DATA__", { error: e });
        }
      }
      
      // Priority 2: JSON-LD structured data (very reliable) - Limited processing
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonLd = JSON.parse($(el).html() || '{}');
          if (jsonLd['@type'] === 'Organization' || jsonLd['@type'] === 'Corporation' ||
              jsonLd['@type'] === 'LocalBusiness') {
            // Extract relevant fields
            const fields = ['description', 'slogan', 'foundingDate', 'numberOfEmployees',
                          'award', 'brand', 'knowsAbout', 'knowsLanguage', 'legalName',
                          'alternateName', 'disambiguatingDescription'];
            fields.forEach(field => {
              if (jsonLd[field]) {
                const value = typeof jsonLd[field] === 'string' ? jsonLd[field] : JSON.stringify(jsonLd[field]);
                if (value.length > 20 && value.length < 500) {
                  brandStoryContent.push(value);
                }
              }
            });
          }
          
          // Also check for WebSite or WebPage types
          if (jsonLd['@type'] === 'WebSite' || jsonLd['@type'] === 'WebPage') {
            if (jsonLd.description) brandStoryContent.push(jsonLd.description);
            if (jsonLd.about) brandStoryContent.push(jsonLd.about);
          }
        } catch (e) {
          // Invalid JSON-LD, skip
        }
      });
      
      // Priority 3: Meta tags (always available)
      const metaDescriptions = [
        $('meta[name="description"]').attr('content'),
        $('meta[property="og:description"]').attr('content'),
        $('meta[name="twitter:description"]').attr('content'),
        $('meta[property="og:site_name"]').attr('content')
      ].filter(Boolean);
      
      metaDescriptions.forEach(desc => {
        if (desc && desc.length > 30) {
          brandStoryContent.push(desc);
        }
      });
      
      // Priority 4: Modern React/Vue class patterns with hash suffixes
      const modernSelectors = [
        // React/Next.js patterns with hash suffixes
        '[class*="hero_"], [class*="Hero_"], [class*="hero-"]',
        '[class*="intro_"], [class*="Intro_"], [class*="intro-"]',
        '[class*="about_"], [class*="About_"], [class*="about-"]',
        '[class*="story_"], [class*="Story_"], [class*="story-"]',
        '[class*="mission_"], [class*="Mission_"], [class*="mission-"]',
        '[class*="value_"], [class*="Value_"], [class*="value-"]',
        // CSS Modules patterns
        '[class*="module_hero"], [class*="module_intro"], [class*="module_about"]',
        // Styled components patterns
        '[data-component="hero"], [data-component="about"], [data-component="intro"]',
        // Generic but common patterns
        '.container:first-of-type section:first-child',
        'main > section:first-child',
        'main > div:first-child > section:first-child'
      ];
      
      for (const selector of modernSelectors) {
        // Continue extracting comprehensive content
        
        const sections = $(selector);
        sections.each((_, el) => {
          const $section = $(el);
          if (!$section.closest('nav, footer, header').length) {
            // Extract all text content from modern components
            const texts = $section.find('h1, h2, h3, h4, h5, h6, p, span[class*="text"], div[class*="text"]')
              .map((_, textEl) => $(textEl).text().trim())
              .get()
              .filter(text => text.length > 30 && text.length < 500)
              .filter(text => isBrandStoryContent(text));
            
            brandStoryContent.push(...texts);
          }
        });
        
        // Continue comprehensive extraction
      }
      
      // Priority 5: Traditional HTML patterns (fallback)
      if (brandStoryContent.length < 3) {
        const traditionalSelectors = [
          '.intro, [class*="intro"]:not([class*="service"])',
          '[class*="about"]:not([class*="service"])',
          '[class*="story"]',
          '[class*="mission"]',
          '[class*="value"]:not([class*="service"])',
          'section:nth-child(2)',
          'section:nth-child(3)'
        ];
        
        for (const selector of traditionalSelectors) {
          const section = $(selector).first();
          if (section.length && !section.closest('nav, footer').length) {
            const texts = section.find('h2, h3, h4, h5, p')
              .map((_, el) => $(el).text().trim())
              .get()
              .filter(text => isBrandStoryContent(text));
            
            if (texts.length >= 2) {
              brandStoryContent.push(...texts);
              break;
            }
          }
        }
      }
      
      // Priority 6: Last resort - scan all text nodes
      if (brandStoryContent.length < 3) {
        $('h1, h2, h3, h4, h5, p, span, div').each((_, el) => {
          const $el = $(el);
          const text = $el.text().trim();
          
          // Skip if in navigation or footer
          if ($el.closest('nav, header, footer, aside').length) return;
          
          // Check if it's brand story content
          if (text.length > 30 && text.length < 500 && isBrandStoryContent(text)) {
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

    // Extract Company Credentials and Metrics
    function extractCredentials($: cheerio.CheerioAPI): string[] {
      const credentials: string[] = [];
      const credentialPatterns = [
        // Years and experience
        /(\d+)\+?\s*years?\s*(of|in)?\s*(experience|business|success)?/i,
        /since\s+\d{4}/i,
        /founded\s+(in\s+)?\d{4}/i,
        /established\s+(in\s+)?\d{4}/i,
        
        // Client/project counts
        /(\d+)\+?\s*(clients|customers|companies|brands|projects|partners)/i,
        /served\s+(\d+)\+?\s*(clients|customers|companies)/i,
        /worked\s+with\s+(\d+)\+?\s*(clients|brands|companies)/i,
        
        // Performance metrics
        /(\d+)([%xX])\s*(increase|growth|improvement|faster|better|ROI|conversion)/i,
        /(\d+)\s*(fold|times)\s*(increase|growth|improvement)/i,
        /improved\s+by\s+(\d+)([%xX])/i,
        /generated\s+\$?(\d+[KMB]?)\+?/i,
        /saved\s+\$?(\d+[KMB]?)\+?/i,
        
        // Awards and recognition
        /award[- ]winning/i,
        /(top|best)\s+\d+\s+(agency|company|firm)/i,
        /recognized|certified|trusted\s+by/i,
        /featured\s+in|as\s+seen\s+on/i,
        
        // Team size
        /(\d+)\+?\s*(employees|team members|professionals|experts)/i,
        /team\s+of\s+(\d+)\+?/i,
        
        // Market position
        /#\d+\s+(ranked|rated)/i,
        /leading|premier|top-rated/i,
        
        // Success rate
        /(\d+)%\s*(success rate|satisfaction|retention)/i,
        /(\d+)%\s+of\s+(clients|customers)\s+(recommend|return|satisfied)/i
      ];
      
      // First, try to extract from __NEXT_DATA__ if available
      const nextDataScript = $('script#__NEXT_DATA__').html();
      if (nextDataScript) {
        try {
          const nextData = JSON.parse(nextDataScript);
          let metricsProcessed = 0;
          const MAX_METRICS_ITEMS = 30; // Limit credential extraction
          const extractMetrics = (obj: any, depth = 0): void => {
            if (depth > 3 || metricsProcessed >= MAX_METRICS_ITEMS) return;
            metricsProcessed++;
            if (typeof obj === 'string' && obj.length < 200) {
              credentialPatterns.forEach(pattern => {
                if (pattern.test(obj)) {
                  credentials.push(obj);
                }
              });
            } else if (Array.isArray(obj)) {
              obj.forEach(item => extractMetrics(item, depth + 1));
            } else if (obj && typeof obj === 'object') {
              Object.values(obj).forEach(value => extractMetrics(value, depth + 1));
            }
          };
          extractMetrics(nextData?.props?.pageProps);
        } catch (e) {
          // Silent fail
        }
      }
      
      // Then look in JSON-LD
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonLd = JSON.parse($(el).html() || '{}');
          const metricsFields = ['foundingDate', 'numberOfEmployees', 'award', 
                               'aggregateRating', 'review', 'slogan'];
          metricsFields.forEach(field => {
            if (jsonLd[field]) {
              const value = typeof jsonLd[field] === 'string' ? jsonLd[field] : JSON.stringify(jsonLd[field]);
              if (value.length < 200) {
                credentials.push(value);
              }
            }
          });
        } catch (e) {
          // Silent fail
        }
      });
      
      // Look specifically for credential content in HTML - LIMITED PROCESSING
      let processedElements = 0;
      const MAX_ELEMENTS_TO_PROCESS = 100; // Critical performance limit
      $('*').each((_, el) => {
        if (processedElements++ >= MAX_ELEMENTS_TO_PROCESS) return false; // Stop after 100 elements
        const text = $(el).text().trim();
        if (text.length > 10 && text.length < 200) {
          credentialPatterns.forEach(pattern => {
            if (pattern.test(text)) {
              // Avoid duplicates from nested elements
              const tagName = (el as any).tagName || (el as any).name || '';
              if (!$(el).children().length || tagName.match(/^(p|h[2-6]|li|span|div)$/i)) {
                // Extract the specific metric if it's embedded in longer text
                const match = text.match(pattern);
                if (match && match[0]) {
                  // Keep the full context if it's short, otherwise extract just the metric
                  credentials.push(text.length < 100 ? text : match[0]);
                }
              }
            }
          });
        }
      });
      
      // Deduplicate and prioritize specific metrics
      const uniqueCredentials = Array.from(new Set(credentials));
      
      // Sort by specificity (prefer actual numbers over generic claims)
      const sorted = uniqueCredentials.sort((a, b) => {
        const aHasNumber = /\d+/.test(a);
        const bHasNumber = /\d+/.test(b);
        const aHasPercent = /%/.test(a);
        const bHasPercent = /%/.test(b);
        
        // Prioritize percentages and numbers
        if (aHasPercent && !bHasPercent) return -1;
        if (!aHasPercent && bHasPercent) return 1;
        if (aHasNumber && !bHasNumber) return -1;
        if (!aHasNumber && bHasNumber) return 1;
        
        // Prefer shorter, more concise statements
        return a.length - b.length;
      });
      
      return sorted.slice(0, 5); // Return top 5 credentials
    }

    // Early content sufficiency check helper
    function hasEnoughContent(contentParts: string[], minItems = 8, minLength = 1500): boolean {
      return contentParts.length >= minItems || contentParts.join(' ').length >= minLength;
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
        OUTCOMES: [] as string[],        // Specific results/metrics
        IMPACT: [] as string[]           // Results we deliver
      };
      
      // Separate metrics from general credentials
      const metrics = credentials.filter(c => /\d+[%xX]|fold|times|\$\d+/.test(c));
      const generalCreds = credentials.filter(c => !metrics.includes(c));
      
      narrative.PROOF = generalCreds;
      narrative.OUTCOMES = metrics;
      
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
        else if (/(our approach|how we|process|method|framework|we work)/i.test(text)) {
          narrative.APPROACH.push(text);
        } 
        else if (/(we believe|our values|philosophy|principles|culture)/i.test(text)) {
          narrative.VALUES.push(text);
        } 
        else if (/(unlike|different|unique|sets us apart|why choose|advantage)/i.test(text)) {
          narrative.DIFFERENTIATORS.push(text);
        }
        else if (/(\d+[%xX]|\d+\s*fold|generated|saved|increased|improved by)/i.test(text)) {
          narrative.OUTCOMES.push(text);
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
      console.log("DEBUG: Raw story content extracted:", storyContent.length, "items");
      storyContent.forEach((item, i) => console.log(`  Story ${i}:`, item.substring(0, 100)));
      
      // Step 2: Extract credentials separately
      const credentials = extractCredentials($);
      console.log("DEBUG: Credentials extracted:", credentials.length, "items");
      credentials.forEach((item, i) => console.log(`  Cred ${i}:`, item.substring(0, 100)));
      
      // Step 3: Combine and deduplicate
      const allContent = [...storyContent, ...credentials];
      console.log("DEBUG: Combined content before dedup:", allContent.length, "items");
      const deduplicated = deduplicateContent(allContent);
      console.log("DEBUG: After deduplication:", deduplicated.length, "items");
      deduplicated.forEach((item, i) => console.log(`  Dedup ${i}:`, item.substring(0, 100)));
      
      // Step 4: Build labeled narrative
      const labeledNarrative = buildLabeledNarrative(
        deduplicated.filter(text => !credentials.includes(text)),
        credentials
      );
      console.log("DEBUG: Labeled narrative sections:", labeledNarrative.length);
      labeledNarrative.forEach((item, i) => console.log(`  Label ${i}:`, item.substring(0, 150)));
      
      // Step 5: Format output
      if (labeledNarrative.length >= 3) {
        return labeledNarrative.join('\n');
      }
      
      // Step 6: Fallback if insufficient content
      if (labeledNarrative.length < 3) {
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const ogDesc = $('meta[property="og:description"]').attr('content') || '';
        console.log("DEBUG: Using fallback - metaDesc:", metaDesc?.substring(0, 100));
        console.log("DEBUG: Using fallback - ogDesc:", ogDesc?.substring(0, 100));
        
        labeledNarrative.push(`IDENTITY: ${metaDesc}`);
        if (ogDesc && ogDesc !== metaDesc) {
          labeledNarrative.push(`MISSION: ${ogDesc}`);
        }
      }
      
      // Return labeled story (max 2500 chars)
      const finalResult = labeledNarrative
        .filter(line => line.split(': ')[1]?.length > 10) // Ensure content after label
        .slice(0, 8) // Max 8 labeled sections
        .join('\n')
        .substring(0, 2500);
      
      console.log("DEBUG: Final result length:", finalResult.length);
      return finalResult;
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
    
    // Debug logging for environment comparison
    logger.info("BRAND_STORY_DEBUG: OpenAI Request", {
      environment: process.env.NODE_ENV,
      url: context.websiteUrl,
      contentLength: storyContent.length,
      contentPreview: storyContent.substring(0, 200),
      promptSource: effectivenessPrompt ? 'database' : 'fallback',
      openaiModel: config.openai.model,
      openaiTemp: config.openai.temperature,
      systemPrompt: effectivenessPrompt.systemPrompt.substring(0, 100)
    });
    
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

    // Debug logging for response comparison
    logger.info("BRAND_STORY_DEBUG: OpenAI Response", {
      environment: process.env.NODE_ENV,
      url: context.websiteUrl,
      rawResponse: analysisText,
      responseLength: analysisText.length,
      hasMarkdownWrapper: analysisText.includes('```json')
    });

    let analysis;
    try {
      // Extract JSON from markdown code blocks if present
      const cleanJsonText = analysisText.replace(/^```json\s*|\s*```$/g, '').trim();
      analysis = JSON.parse(cleanJsonText);
      
      // Debug logging for parsed analysis comparison
      logger.info("BRAND_STORY_DEBUG: Parsed Analysis", {
        environment: process.env.NODE_ENV,
        url: context.websiteUrl,
        contentQuality: analysis.content_quality,
        confidence: analysis.confidence,
        povPresent: analysis.pov_present,
        mechanismNamed: analysis.mechanism_named,
        outcomesStated: analysis.outcomes_stated,
        proofElements: analysis.proof_elements
      });
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

    // Handle additional database template fields gracefully
    const contentQuality = analysis.content_quality || 'complete';
    const extractionIssues = analysis.extraction_issues || [];
    
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

    // Adjust score based on content quality if provided
    if (contentQuality === 'fragment' || contentQuality === 'invalid') {
      score *= 0.75; // Reduce score for poor content quality
    } else if (contentQuality === 'partial') {
      score *= 0.9;
    }
    
    // Debug logging for score calculation comparison
    const contentQualityMultiplier = contentQuality === 'fragment' || contentQuality === 'invalid' ? 0.75 : 
                                    contentQuality === 'partial' ? 0.9 : 1.0;
    const confidenceFactor = analysis.confidence || 0.75;
    
    logger.info("BRAND_STORY_DEBUG: Score Calculation", {
      environment: process.env.NODE_ENV,
      url: context.websiteUrl,
      baseScore: score,
      bonusPoints: bonusPoints,
      contentQuality: contentQuality,
      contentQualityMultiplier: contentQualityMultiplier,
      confidence: confidenceFactor,
      scoreBeforeConfidence: score + bonusPoints,
      finalScoreBeforeClamp: (score + bonusPoints) * confidenceFactor
    });
    
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
          contentQuality,
          extractionIssues,
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