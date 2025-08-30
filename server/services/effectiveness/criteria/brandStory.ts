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

    // Filter function - More permissive
    function isBrandStoryContent(text: string): boolean {
      // Exclude if matches non-story patterns
      if (notBrandStory.some(pattern => pattern.test(text))) {
        return false;
      }
      // Include if matches story patterns OR is substantial content
      return brandStoryIndicators.some(pattern => pattern.test(text)) ||
             (text.length > 30 && text.length < 500); // More permissive length
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
      
      // Priority 6: Comprehensive text scanning - Always run
      $('h1, h2, h3, h4, h5, h6, p').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Skip if in navigation or footer
        if ($el.closest('nav, header, footer, aside, .nav, .header, .footer').length) return;
        
        // Check if it's brand story content and not already included
        if (text.length > 20 && text.length < 600 && !brandStoryContent.includes(text)) {
          if (isBrandStoryContent(text) || 
              /digital|agency|brand|website|experience|results|success|clients?|years?|silicon valley/i.test(text)) {
            brandStoryContent.push(text);
          }
        }
      });
      
      return brandStoryContent;
    }

    // Smart Deduplication - Less aggressive
    function deduplicateContent(content: string[]): string[] {
      const cleaned: string[] = [];
      const seen = new Set<string>();
      
      content.forEach(text => {
        if (!text || text.length < 20) return;
        
        // Create a normalized version for comparison
        const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
        
        // Skip exact duplicates
        if (seen.has(normalized)) return;
        
        // Check for substantial overlap (80% or more)
        const isDuplicateContent = cleaned.some(existing => {
          const existingNorm = existing.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          
          // If one is completely contained in the other and they're similar length
          if (existingNorm.includes(normalized) || normalized.includes(existingNorm)) {
            const lengthRatio = Math.min(normalized.length, existingNorm.length) / Math.max(normalized.length, existingNorm.length);
            return lengthRatio > 0.8;
          }
          
          return false;
        });
        
        if (!isDuplicateContent) {
          seen.add(normalized);
          cleaned.push(text);
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
      
      // Categorize content with comprehensive patterns - ONE CATEGORY PER TEXT
      contentPieces.forEach(text => {
        const lowerText = text.toLowerCase();
        let categorized = false;
        
        // Foundation - company history/establishment (highest priority for years/founding)
        if (/\b(founded|established|began|started|since|years?\s+(of|in)\s+(business|experience|success))\b/i.test(text) && !categorized) {
          narrative.FOUNDATION.push(text);
          categorized = true;
        }
        
        // Identity - who we are statements (specific patterns only)
        if (!categorized && /(we are|we're|as a|digital agency|based|silicon valley|team)/i.test(text)) {
          narrative.IDENTITY.push(text);
          categorized = true;
        }
        
        // Mission - purpose and goals
        if (!categorized && /(our mission|we exist|purpose|dedicated to|committed to|vision|goal)/i.test(text)) {
          narrative.MISSION.push(text);
          categorized = true;
        }
        
        // Approach - how we work
        if (!categorized && /(our approach|how we|process|method|framework|strategy|methodology)/i.test(text)) {
          narrative.APPROACH.push(text);
          categorized = true;
        }
        
        // Values - beliefs and principles
        if (!categorized && /(we believe|our values|philosophy|principles|culture|passionate)/i.test(text)) {
          narrative.VALUES.push(text);
          categorized = true;
        }
        
        // Differentiators - what makes us unique
        if (!categorized && /(unlike|different|unique|sets us apart|why choose|advantage|award.?winning|leading)/i.test(text)) {
          narrative.DIFFERENTIATORS.push(text);
          categorized = true;
        }
        
        // Outcomes - specific metrics and results
        if (!categorized && /(\d+[%xX]|\d+\s*fold|generated|saved|increased|improved by|clients?|projects?)/i.test(text)) {
          narrative.OUTCOMES.push(text);
          categorized = true;
        }
        
        // Impact - results we deliver
        if (!categorized && /(results|outcomes|impact|achieve|deliver|help|success|drive|accelerate)/i.test(text)) {
          narrative.IMPACT.push(text);
          categorized = true;
        }
        
        // Default categorization for uncategorized content
        if (!categorized) {
          if (/(website|digital|brand|experience|design)/i.test(text)) {
            narrative.IDENTITY.push(text);
          } else if (text.length > 100) {
            narrative.APPROACH.push(text);
          } else {
            narrative.VALUES.push(text);
          }
        }
      });
      
      // Build labeled output - Include ALL content, not just best
      const labeledStory: string[] = [];
      
      Object.entries(narrative).forEach(([label, content]) => {
        if (content.length > 0) {
          // Use ALL content from each category, not just the best one
          content
            .filter(text => text && text.length > 20)
            .forEach(text => {
              labeledStory.push(`${label}: ${text}`);
            });
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
    
    let analysisText: string;
    
    // Try vision-enhanced analysis first if full-page screenshot is available
    if (context.fullPageScreenshot) {
      try {
        logger.info("Using vision-enhanced brand story analysis", {
          url: context.websiteUrl,
          screenshotPath: context.fullPageScreenshot
        });
        
        analysisText = await callOpenAIWithVision(
          storyContent,
          context.fullPageScreenshot,
          prompt,
          effectivenessPrompt.systemPrompt,
          openai,
          500 // Increased tokens for 5-criteria analysis
        );
        
        logger.info("Vision-enhanced brand story analysis completed", {
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
      logger.info("Using text-only brand story analysis (no screenshot)", {
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

    // Brand Story Scoring Logic - Updated for 5-criteria system
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

    // Handle additional database template fields gracefully
    const contentQuality = analysis.content_quality || 'complete';
    const extractionIssues = analysis.extraction_issues || [];
    
    // Adjust score based on content quality if provided
    if (contentQuality === 'fragment' || contentQuality === 'invalid') {
      score *= 0.75; // Reduce score for poor content quality
    } else if (contentQuality === 'partial') {
      score *= 0.9;
    }
    
    // Apply confidence factor from AI analysis
    const confidenceFactor = analysis.confidence || 1.0;
    score = score * confidenceFactor;
    
    // Ensure score is within bounds
    score = Math.min(10, Math.max(0, score));
    
    logger.info("BRAND_STORY_DEBUG: Score Calculation", {
      environment: process.env.NODE_ENV,
      url: context.websiteUrl,
      baseScore: score / confidenceFactor,
      contentQuality: contentQuality,
      confidence: confidenceFactor,
      finalScore: score
    });

    logger.info("Completed brand story analysis", {
      url: context.websiteUrl,
      score,
      hasQuantifiedOutcomes,
      quantifiedResults: quantifiedResults.length,
      hasProofElements,
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
          hasQuantifiedOutcomes,
          quantifiedResults: quantifiedResults.slice(0, 3),
          hasProofElements,
          contentQuality,
          extractionIssues,
          ...evidenceDetails // Include extracted evidence
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