/**
 * Trust Criterion Scorer
 *
 * Evaluates trust signals: customer logos, third-party proof, recent proof, case studies
 */

import { CriterionResult, ScoringContext, ScoringConfig } from "../types";
import * as cheerio from "cheerio";
import logger from "../../../utils/logging/logger";

export async function scoreTrust(
  context: ScoringContext,
  config: ScoringConfig,
): Promise<CriterionResult> {
  try {
    const $ = cheerio.load(context.html);

    // ---------- Helpers ----------
    const cfg = {
      mediaOutlets: (config as any)?.mediaOutlets ?? [
        "forbes",
        "wsj",
        "wall street journal",
        "techcrunch",
        "cnbc",
        "venturebeat",
        "wired",
        "the verge",
        "zdnet",
        "bloomberg",
        "reuters",
        "bbc",
        "new york times",
        "nyt",
        "ft",
        "financial times",
        "guardian",
      ],
    };
    const normalizeUrl = (u: string) =>
      (u || "")
        .toLowerCase()
        .replace(/[#?].*$/, "")
        .replace(/\s+/g, "");
    const normKey = (
      alt: string | undefined,
      src: string | undefined,
      title?: string,
    ) =>
      (alt || "").toLowerCase().trim() +
      "|" +
      normalizeUrl(src || "") +
      "|" +
      (title || "").toLowerCase().trim();
    const nearestSectionId = (el: cheerio.Element) => {
      const sec = $(el).closest(
        'section, div[class*="section"], div[class*="container"]',
      )[0];
      return sec ? (sec as any) : el; // use node ref as key
    };
    const collectSrcset = (el: cheerio.Cheerio) =>
      (el.attr("srcset") || "")
        .split(",")
        .map((s) => s.trim().split(" ")[0])
        .filter(Boolean);
    const bgImageUrls = (node: cheerio.Cheerio) => {
      const style = (node.attr("style") || "").toLowerCase();
      const m = style.match(/background(-image)?:\s*url\(([^)]+)\)/);
      return m ? [m[2].replace(/['"]/g, "")] : [];
    };

    // Enhanced logo detection with modern HTML structures
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[src*="logo" i]',
      'img[class*="logo" i]',
      ".customer-logo img",
      ".client-logo img",
      ".partner-logo img",
    ];

    const modernLogoSelectors = [
      ...logoSelectors,
      // Context-based detection
      "section img", // All images in sections
      'div[class*="grid"] img', // Grid layouts
      'div[class*="flex"] img', // Flexbox layouts
      "ul li img", // List-based logo displays
      // Additional modern patterns
      "picture source[srcset]",
      'svg[class*="logo" i], [class*="logo"] svg',
      '[class*="logo"], [class*="client-logos"], [class*="logos"]',
    ];

    // Analyze images in context for trust indicators
    const potentialLogos = $(modernLogoSelectors.join(","));
    const validLogos = potentialLogos.filter((i, el) => {
      const img = $(el);
      const parent = img.closest('section, div[class*="container"]');
      const parentText = parent.text().toLowerCase();

      // Check if image is in a trust context
      return /featured|trusted|client|partner|works with|used by/.test(
        parentText,
      );
    });

    // --- De-duped logo counting across img/picture/srcset/SVG/bg ---
    const seen = new Set<string>();
    const seenPerSection = new Set<string>();
    const addKey = (
      el: cheerio.Element,
      alt?: string,
      src?: string,
      title?: string,
    ) => {
      const sec = nearestSectionId(el);
      const key = normKey(alt, src, title);
      if (!key.trim()) return;
      const sectionKey = String(sec) + "|" + key;
      if (!seen.has(key)) seen.add(key);
      if (!seenPerSection.has(sectionKey)) seenPerSection.add(sectionKey);
    };

    // <img>
    $("img").each((_, el) =>
      addKey(el, $(el).attr("alt"), $(el).attr("src"), $(el).attr("title")),
    );
    // <picture><source srcset>
    $("picture source[srcset]").each((_, el) => {
      collectSrcset($(el)).forEach((u) => addKey(el, undefined, u));
    });
    // Inline SVGs labeled as logos
    $('svg[class*="logo" i], [class*="logo"] svg').each((_, el) =>
      addKey(el, "svg-logo", "inline:svg"),
    );
    // Background images on known logo containers
    $('[class*="logo"], [class*="client-logos"], [class*="logos"]').each(
      (_, el) => {
        bgImageUrls($(el)).forEach((u) => addKey(el, undefined, u));
      },
    );

    // Start with explicit "logo" selectors, fallback to context-valid sections
    let customerLogos = Math.max(
      $(logoSelectors.join(",")).length,
      validLogos.length,
      seenPerSection.size > 0 ? seenPerSection.size : 0,
    );

    // "Featured In" detection with higher scoring weight
    const featuredInSections = $("section, div").filter((i, el) => {
      const text = $(el).find("h1, h2, h3, h4, p").text().toLowerCase();
      const hasFeatureText = /featured in|as seen on|in the press|media/.test(
        text,
      );
      const hasImages = $(el).find("img").length >= 2;
      return hasFeatureText && hasImages;
    });

    const featuredLogos = featuredInSections.find("img");

    // Detect major media outlets
    const majorMediaOutlets = cfg.mediaOutlets;
    const hasMajorMedia =
      featuredLogos.filter((i, el) => {
        const imgAttrs =
          ($(el).attr("alt") || "") +
          " " +
          ($(el).attr("src") || "") +
          " " +
          ($(el).attr("title") || "");
        const lower = imgAttrs.toLowerCase();
        // also check filename parts and parent anchors
        const parentText = $(el)
          .closest("a, section, div")
          .text()
          .toLowerCase();
        return majorMediaOutlets.some(
          (outlet) =>
            lower.includes(outlet) ||
            parentText.includes(outlet) ||
            normalizeUrl(lower).includes(`/${outlet}-`),
        );
      }).length > 0;

    // Identify trust sections by structure, not just keywords
    const trustSections = $('section, div[class*="section"]').filter(
      (i, el) => {
        const section = $(el);
        const hasMultipleImages = section.find("img").length >= 3;
        const hasGrid =
          section.find('[class*="grid"], [class*="flex"]').length > 0;
        const hasCompanyNames =
          /forbes|google|microsoft|amazon|deloitte|accenture|ibm|oracle|salesforce/i.test(
            section.text(),
          );

        return (hasMultipleImages && hasGrid) || hasCompanyNames;
      },
    );

    // Smart fallback when specific selectors fail
    if (customerLogos === 0) {
      // Look for any section with 3+ images
      const imageSections = $("section, div").filter(
        (i, el) => $(el).find("img").length >= 3,
      );

      if (imageSections.length > 0) {
        customerLogos = imageSections.first().find("img").length;
        logger.debug("Used fallback logo detection", { customerLogos });
      }
    }

    const testimonialSelectors = [
      ".testimonial",
      ".review",
      ".quote",
      '[class*="testimonial"]',
      '[class*="review"]',
    ];

    const caseStudySelectors = [
      // Existing
      'a[href*="case-study" i]',
      'a[href*="case-studies" i]',
      'a[href*="success-story" i]',
      ".case-study",
      ".success-story",
      // New CMS/common slugs & patterns
      'a[href*="/customer-story" i]',
      'a[href*="/customer-stories" i]',
      'a[href*="/customers/" i]',
      'a[href*="/work/" i]',
      'a[href*="/stories" i]',
      'a[href*="/reference" i]',
      'a[href*="/resources/case-studies" i]',
      // Headings/blocks that label case content
      'h2:contains("Case Study"), h3:contains("Case Study")',
      '[class*="case"] [class*="card"] a',
    ];

    const certificationSelectors = [
      'img[alt*="certified" i]',
      'img[alt*="badge" i]',
      'img[alt*="award" i]',
      ".certification",
      ".badge",
      ".award",
    ];
    // Common text-only/SVG badge phrases to catch
    const certificationTextPhrases = [
      "iso 27001",
      "iso/iec 27001",
      "soc 2",
      "soc 2 type ii",
      "hipaa",
      "pci dss",
      "gdpr",
      "g2 leader",
      "gartner",
      "forrester",
      "gartner peer insights",
    ];

    // Look for specific trust indicators in text
    const pageText = $("body").text().toLowerCase();
    
    // Count trust elements
    let certifications = $(certificationSelectors.join(",")).length;
    const textBadges = certificationTextPhrases.reduce(
      (n, k) => n + (pageText.includes(k) ? 1 : 0),
      0,
    );
    certifications += textBadges;
    const caseStudies = $(caseStudySelectors.join(",")).length;

    const trustKeywords = [
      "customers",
      "clients served",
      "companies trust us",
      "trusted by",
      "years of experience",
      "since",
      "founded",
      "established",
      "award",
      "certified",
      "accredited",
      "recognized",
      "testimonial",
      "review",
      "rating",
    ];

    const trustKeywordCount = trustKeywords.reduce((count, keyword) => {
      return count + (pageText.includes(keyword) ? 1 : 0);
    }, 0);

    // Check for recent proof (within threshold months)
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2]; // Last 3 years
    const hasRecentDates = recentYears.some((year) =>
      pageText.includes(year.toString()),
    );

    // Improved number extraction for business metrics
    const metricsPattern =
      /(\d{1,6}[,.]?\d{0,3})\+?\s*(%|percent|campaigns|projects|years|customers|clients|companies|users|countries|offices|team|employees|solutions|implementations|satisfied|completed|delivered|roi|increase|growth)/gi;
    const numberMatches = pageText.match(metricsPattern) || [];

    // Also look for standalone impressive numbers in headings
    const headingNumbers =
      $("h1, h2, h3")
        .text()
        .match(/\d{3,}/g) || [];
    const hasScaleIndicators =
      numberMatches.length > 0 || headingNumbers.length > 0;

    // Calculate score with adjusted weights (logos + case stories emphasized)
    let score = 0;
    const passes: { passed: string[]; failed: string[] } = {
      passed: [],
      failed: [],
    };
    // Featured In/Media (now lower weight)
    // Major media 10%, any media 5%
    if (featuredInSections.length > 0 && hasMajorMedia) {
      score += 1.0;

      passes.passed.push("major_media_coverage");
    } else if (featuredInSections.length > 0) {
      score += 0.5;
      passes.passed.push("media_coverage");
    } else {
      passes.failed.push("no_media_coverage");
    }

    // Customer logos (20% of score - reduced from 25%)
    if (customerLogos >= 5) {
      score += 3.0;
      passes.passed.push("sufficient_logos");
    } else if (customerLogos >= 3) {
      score += 1.8;
      passes.passed.push("some_logos");
    } else {
      passes.failed.push("insufficient_logos");
    }

    /// Third-party proof - certifications, awards (still 15%)
    if (certifications >= 2) {
      score += 1.5;
      passes.passed.push("third_party_proof");
    } else if (certifications >= 1) {
      score += 0.8;
      passes.passed.push("some_third_party_proof");
    } else {
      passes.failed.push("no_third_party_proof");
    }

    // Recent proof (15%)
    if (hasRecentDates) {
      score += 1.5;
      passes.passed.push("recent_proof");
    } else {
      passes.failed.push("no_recent_proof");
    }

    // Case studies/testimonials (15% of score - reduced from 25%)
    const testimonialScore = testimonials + caseStudies;
    if (testimonialScore >= 3) {
      score += 3.0;
      passes.passed.push("multiple_case_stories");
    } else if (testimonialScore >= 1) {
      score += 1.8;
      passes.passed.push("some_case_stories");
    } else {
      passes.failed.push("no_case_stories");
    }

    // Trust keywords and scale indicators (5%)
    if (trustKeywordCount >= 5 && hasScaleIndicators) {
      score += 0.5;
      passes.passed.push("trust_language");
    } else if (trustKeywordCount >= 3) {
      score += 0.25;
      passes.passed.push("some_trust_language");
    } else {
      passes.failed.push("weak_trust_language");
    }

    score = Math.min(10, Math.max(0, score));

    // Debug logging for analysis insights
    logger.debug("Trust detection analysis", {
      totalImages: $("img").length,
      detectedLogos: customerLogos,
      potentialLogoSections: $("section:has(img)").length,
      featuredInFound: featuredInSections.length > 0,
      hasMajorMedia,
      headingsWithNumbers: headingNumbers,
      trustSectionCount: trustSections.length,
      validLogosCount: validLogos.length,
      metricsFound: numberMatches.length,
      textBadgeHits: textBadges,
      uniqueLogoKeys: seen.size,
    });

    logger.info("Completed trust analysis", {
      url: context.websiteUrl,
      score,
      customerLogos,
      testimonials,
      caseStudies,
      certifications,
      trustKeywordCount,
      hasRecentDates,
      hasScaleIndicators,
      featuredInSections: featuredInSections.length,
      hasMajorMedia,
    });

    // Enhanced description including media coverage
    const descriptionParts = [];
    if (featuredInSections.length > 0) {
      descriptionParts.push(
        `${hasMajorMedia ? "major media coverage" : "media mentions"}`,
      );
    }
    descriptionParts.push(
      `${customerLogos} logos`,
      `${testimonials} testimonials`,
      `${caseStudies} case studies`,
      `${certifications} certifications`,
    );

    return {
      criterion: "trust",
      score: Math.round(score * 10) / 10,
      evidence: {
        description: `Trust analysis: ${descriptionParts.join(", ")}`,
        details: {
          customerLogos,
          testimonials,
          caseStudies,
          certifications,
          trustKeywordCount,
          hasRecentDates,
          hasScaleIndicators,
          numberMatches: numberMatches.slice(0, 3), // First 3 examples
          recentYears,
          featuredInSections: featuredInSections.length,
          hasMajorMedia,
          trustSections: trustSections.length,
          headingNumbers: headingNumbers.slice(0, 3), // First 3 examples
        },
        reasoning: `Score based on ${hasMajorMedia ? "major media coverage, " : featuredInSections.length > 0 ? "media mentions, " : ""}customer logos (${customerLogos >= 5 ? "sufficient" : customerLogos >= 3 ? "some" : "insufficient"}), third-party proof (${certifications >= 2 ? "strong" : certifications >= 1 ? "some" : "none"}), recent proof (${hasRecentDates ? "present" : "absent"}), and case stories (${testimonials + caseStudies >= 3 ? "multiple" : testimonials + caseStudies >= 1 ? "some" : "none"})`,
      },
      passes,
    };
  } catch (error) {
    logger.error("Error in trust analysis", {
      url: context.websiteUrl,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      criterion: "trust",
      score: 0,
      evidence: {
        description: "Error analyzing trust signals",
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        reasoning: "Failed to complete trust analysis due to technical error",
      },
      passes: {
        passed: [],
        failed: ["analysis_failed"],
      },
    };
  }
}
