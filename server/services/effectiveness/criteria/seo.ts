/**
 * SEO Criterion Scorer
 * 
 * Evaluates SEO fundamentals: title, meta description, H1 uniqueness, canonical, robots
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreSEO(
  context: ScoringContext,
  config: ScoringConfig
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);
    
    // Title tag analysis
    const titleElement = $('title').first();
    const title = titleElement.text().trim();
    const hasTitle = title.length > 0;
    const titleLength = title.length;
    const hasTitleLength = titleLength >= 30 && titleLength <= 60; // SEO best practice

    // Meta description analysis
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const hasMetaDescription = metaDescription.length > 0;
    const metaDescLength = metaDescription.length;
    const hasMetaDescLength = metaDescLength >= 120 && metaDescLength <= 160;

    // H1 analysis
    const h1Elements = $('h1');
    const h1Count = h1Elements.length;
    const h1Text = h1Elements.first().text().trim();
    const hasUniqueH1 = h1Count === 1 && h1Text.length > 0;
    const h1TitleMatch = title && h1Text && 
      (title.toLowerCase().includes(h1Text.toLowerCase()) || 
       h1Text.toLowerCase().includes(title.toLowerCase()));

    // Canonical URL
    const canonicalLink = $('link[rel="canonical"]').attr('href');
    const hasCanonical = !!canonicalLink;
    const canonicalMatchesURL = canonicalLink && 
      (canonicalLink === context.websiteUrl || 
       canonicalLink.replace(/\/$/, '') === context.websiteUrl.replace(/\/$/, ''));

    // Robots meta
    const robotsMeta = $('meta[name="robots"]').attr('content')?.toLowerCase();
    const hasRobotsMeta = !!robotsMeta;
    const robotsAllowsIndexing = !robotsMeta || 
      (!robotsMeta.includes('noindex') && !robotsMeta.includes('none'));

    // Open Graph tags
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const hasOpenGraph = !!(ogTitle && ogDescription);

    // Twitter Card tags
    const twitterCard = $('meta[name="twitter:card"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const hasTwitterCards = !!(twitterCard && twitterTitle);

    // Schema.org structured data
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const hasStructuredData = jsonLdScripts.length > 0;
    
    // Sitemap reference
    const sitemapLink = $('link[rel="sitemap"]').attr('href') || 
                       context.html.includes('sitemap.xml');
    const hasSitemapReference = !!sitemapLink;

    // Image SEO
    const images = $('img');
    const imagesWithAlt = $('img[alt]');
    const imageAltRatio = images.length === 0 ? 1 : imagesWithAlt.length / images.length;

    // Internal linking
    const internalLinks = $('a[href^="/"], a[href*="' + 
      context.websiteUrl.replace(/https?:\/\//, '').split('/')[0] + '"]');
    const hasInternalLinking = internalLinks.length >= 5;

    // URL structure (check if current URL is SEO-friendly)
    const url = new URL(context.websiteUrl);
    const hasCleanURL = !url.search && !url.pathname.includes('?') && 
                       !url.pathname.includes('&') && url.pathname.split('/').length <= 4;

    // Calculate score
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = { passed: [], failed: [] };

    // Title optimization (15% of score - 1.5 points)
    if (hasTitle && hasTitleLength) {
      score += 1.5;
      passes.passed.push('optimized_title');
    } else if (hasTitle) {
      score += 1.0;
      passes.passed.push('title_present');
    } else {
      passes.failed.push('no_title');
    }

    // Meta description (15% of score - 1.5 points)
    if (hasMetaDescription && hasMetaDescLength) {
      score += 1.5;
      passes.passed.push('optimized_meta_description');
    } else if (hasMetaDescription) {
      score += 1.0;
      passes.passed.push('meta_description_present');
    } else {
      passes.failed.push('no_meta_description');
    }

    // H1 optimization (15% of score - 1.5 points)
    if (hasUniqueH1 && h1TitleMatch) {
      score += 1.5;
      passes.passed.push('optimized_h1');
    } else if (hasUniqueH1) {
      score += 1.0;
      passes.passed.push('unique_h1');
    } else {
      passes.failed.push('poor_h1_structure');
    }

    // Technical SEO (20% of score - 2 points)
    let technicalScore = 0;
    if (hasCanonical) {
      technicalScore += 0.5;
      passes.passed.push('canonical_present');
    } else {
      passes.failed.push('no_canonical');
    }
    
    if (robotsAllowsIndexing) {
      technicalScore += 0.5;
      passes.passed.push('allows_indexing');
    } else {
      passes.failed.push('blocks_indexing');
    }
    
    if (hasCleanURL) {
      technicalScore += 0.5;
      passes.passed.push('clean_url_structure');
    } else {
      passes.failed.push('poor_url_structure');
    }
    
    if (hasSitemapReference) {
      technicalScore += 0.5;
      passes.passed.push('sitemap_present');
    } else {
      passes.failed.push('no_sitemap');
    }
    
    score += technicalScore;

    // Social media optimization (10% of score - 1 point)
    if (hasOpenGraph && hasTwitterCards) {
      score += 1.0;
      passes.passed.push('full_social_optimization');
    } else if (hasOpenGraph || hasTwitterCards) {
      score += 0.5;
      passes.passed.push('partial_social_optimization');
    } else {
      passes.failed.push('no_social_optimization');
    }

    // Structured data (10% of score - 1 point)
    if (hasStructuredData) {
      score += 1.0;
      passes.passed.push('structured_data_present');
    } else {
      passes.failed.push('no_structured_data');
    }

    // Content optimization (10% of score - 1 point)
    if (imageAltRatio >= 0.9 && hasInternalLinking) {
      score += 1.0;
      passes.passed.push('content_optimized');
    } else if (imageAltRatio >= 0.7 || hasInternalLinking) {
      score += 0.5;
      passes.passed.push('partial_content_optimization');
    } else {
      passes.failed.push('poor_content_optimization');
    }

    // Page structure (5% of score - 0.5 points)
    const hasGoodStructure = $('header, nav, main, footer').length >= 3;
    if (hasGoodStructure) {
      score += 0.5;
      passes.passed.push('good_page_structure');
    } else {
      passes.failed.push('poor_page_structure');
    }

    score = Math.min(10, Math.max(0, score));

    logger.info("Completed SEO analysis", {
      url: context.websiteUrl,
      score,
      titleLength,
      metaDescLength,
      h1Count,
      hasCanonical,
      hasOpenGraph,
      hasStructuredData,
      imageAltRatio: Math.round(imageAltRatio * 100)
    });

    return {
      criterion: 'seo',
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `SEO analysis: ${titleLength}ch title, ${metaDescLength}ch meta desc, ${h1Count} H1s, ${Math.round(imageAltRatio * 100)}% image alt coverage`,
        details: {
          title: title.substring(0, 60),
          titleLength,
          metaDescription: metaDescription.substring(0, 100),
          metaDescLength,
          h1Count,
          h1Text: h1Text.substring(0, 60),
          hasCanonical,
          canonicalURL: canonicalLink,
          robotsMeta,
          robotsAllowsIndexing,
          hasOpenGraph,
          hasTwitterCards,
          hasStructuredData,
          jsonLdCount: jsonLdScripts.length,
          imageAltRatio: Math.round(imageAltRatio * 100),
          internalLinksCount: internalLinks.length,
          hasCleanURL
        },
        reasoning: `Score based on title optimization (${hasTitleLength ? 'optimal' : hasTitle ? 'present' : 'missing'}), meta description (${hasMetaDescLength ? 'optimal' : hasMetaDescription ? 'present' : 'missing'}), H1 structure (${hasUniqueH1 ? 'unique' : 'poor'}), technical SEO (canonical: ${hasCanonical}, indexable: ${robotsAllowsIndexing}), social tags (${hasOpenGraph && hasTwitterCards ? 'complete' : hasOpenGraph || hasTwitterCards ? 'partial' : 'missing'}), and structured data (${hasStructuredData ? 'present' : 'missing'})`
      },
      passes
    };

  } catch (error) {
    logger.error('Error in SEO analysis', {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error)
    });

    return {
      criterion: 'seo',
      score: 0,
      evidence: {
        description: 'Error analyzing SEO',
        details: { error: error instanceof Error ? error.message : String(error) },
        reasoning: 'Failed to complete SEO analysis due to technical error'
      },
      passes: {
        passed: [],
        failed: ['analysis_failed']
      }
    };
  }
}