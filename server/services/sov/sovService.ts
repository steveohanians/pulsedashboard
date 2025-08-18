import OpenAI from 'openai';
import { db } from '../../db';
import logger from '../../utils/logging/logger';
import { EventEmitter } from 'events';

interface BrandInput {
  name: string;
  url: string;
}

interface SovAnalysisInput {
  brand: BrandInput;
  competitors: BrandInput[];
  vertical: string;
  clientId?: number;
  userId?: number;
}

interface BrandMention {
  brand: string;
  count: number;
  firstMentionIndex?: number;
}

interface QuestionResult {
  question: string;
  stage: string;
  type: 'organic' | 'prompted';
  responses: Record<string, string>;
  mentions: Record<string, BrandMention>;
  sov: Record<string, number>;
}

export class SovService extends EventEmitter {
  private openai: OpenAI;
  
  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Main entry point for SoV analysis
   */
  async analyzeShareOfVoice(input: SovAnalysisInput, analysisId?: string): Promise<any> {
    try {
      logger.info('Starting SoV analysis', { brand: input.brand.name, analysisId });
      
      // Step 1: Understand the brands
      const brandContext = await this.researchBrands(input);
      logger.info('Brand research complete', { brandContext: brandContext.substring(0, 200) });
      
      // Step 2: Generate intelligent questions that will elicit brand mentions
      const questions = await this.generateQuestions(brandContext, input);
      logger.info('Generated questions', { count: questions.length, sample: questions[0] });
      
      // Step 3: Query AI platforms with questions
      const results = await this.queryAIPlatforms(questions, input);
      
      // Step 4: Calculate Share of Voice
      const sovMetrics = this.calculateSoV(results, input);
      
      logger.info('SoV analysis complete', { 
        brand: input.brand.name, 
        overallSoV: sovMetrics.metrics.overallSoV,
        totalQuestions: sovMetrics.summary.totalQuestions 
      });
      
      return sovMetrics;
      
    } catch (error) {
      logger.error('SoV analysis failed', { error, brand: input.brand.name });
      throw error;
    }
  }

  /**
   * Research what each brand actually does
   */
  private async researchBrands(input: SovAnalysisInput): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: `Research these brands in the ${input.vertical} industry and provide a brief summary of what each does:
        - ${input.brand.name} (${input.brand.url})
        - ${input.competitors.map(c => `${c.name} (${c.url})`).join('\n- ')}
        
        Format: Brief 1-2 sentence description for each, focusing on their specific offerings and differentiators.`
      }],
      temperature: 0.3
    });
    
    return response.choices[0].message.content || '';
  }

  /**
   * Generate questions that will encourage mentioning specific brands
   */
  private async generateQuestions(
    brandContext: string, 
    input: SovAnalysisInput
  ): Promise<Array<{ question: string; type: 'organic' | 'prompted' }>> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'You are an expert at creating questions that potential buyers would ask when researching solutions.'
      }, {
        role: 'user',
        content: `Based on these competing brands in the ${input.vertical} industry:
${brandContext}

Generate 15 questions following these guidelines:

AWARENESS STAGE (5 questions):
- 4 ORGANIC questions (brand-agnostic): Focus on categories, problems, outcomes
- 1 PROMPTED question: Can mention category leaders or "top providers"
- Examples: "What is the best tool for...", "How do companies handle...", "What solutions exist for..."

CONSIDERATION STAGE (5 questions):
- 3 ORGANIC questions: Feature comparisons without brand names
- 2 PROMPTED questions: Direct brand comparisons
- Vary formats: "Which platforms offer...", "How to choose between...", "Compare features of..."

DECISION STAGE (5 questions):
- 2 ORGANIC questions: Implementation and pricing concerns
- 3 PROMPTED questions: Head-to-head brand comparisons using these specific brands: ${input.brand.name}, ${input.competitors.map(c => c.name).join(', ')}
- Examples: "${input.brand.name} vs ${input.competitors[0]?.name} for...", "Is ${input.brand.name} better than ${input.competitors[1]?.name}..."

Requirements:
- Use natural buyer language
- Cover multiple angles: features, cost, scalability, integration, ease of use, support, results
- Vary question structures (avoid repetitive patterns)
- Tag each question as [ORGANIC] or [PROMPTED]

Output as numbered list with tags:
1. [ORGANIC] Question here
2. [PROMPTED] Question here
etc.`
      }],
      temperature: 0.7
    });
    
    const questionsText = response.choices[0].message.content || '';
    return questionsText
      .split('\n')
      .filter(q => q.match(/^\d/))
      .map(q => {
        const isPrompted = q.includes('[PROMPTED]');
        const cleanQuestion = q.replace(/^\d+\.\s*(?:\[.*?\]\s*)?/, '');
        return {
          question: cleanQuestion,
          type: isPrompted ? 'prompted' : 'organic'
        };
      });
  }

  /**
   * Query AI platforms with questions
   */
  private async queryAIPlatforms(
    questions: Array<{ question: string; type: 'organic' | 'prompted' }>, 
    input: SovAnalysisInput
  ): Promise<QuestionResult[]> {
    const results: QuestionResult[] = [];
    const allBrands = [input.brand.name, ...input.competitors.map(c => c.name)];
    const allUrls = [input.brand.url, ...input.competitors.map(c => c.url)];
    
    logger.info('Starting to query AI with questions', { 
      questionCount: questions.length,
      brands: allBrands 
    });
    
    for (let index = 0; index < questions.length; index++) {
      const { question, type } = questions[index];
      const stage = index < 5 ? 'awareness' : index < 10 ? 'consideration' : 'decision';
      
      // Log question type for analysis
      logger.info(`AI query ${index + 1}`, {
        question: question.substring(0, 100),
        type,
        stage
      });
      
      // Query OpenAI with context about the industry
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `You are a helpful assistant answering questions about ${input.vertical} solutions. 
                   When discussing vendors, be specific and mention company names when relevant.
                   Consider various providers in the market and compare their offerings.`
        }, {
          role: 'user',
          content: question
        }],
        temperature: 0.5
      });
      
      const responseText = response.choices[0].message.content || '';
      
      // Log first 200 chars of each response for debugging
      logger.info(`AI response for question ${index + 1}`, {
        question: question.substring(0, 100),
        response: responseText.substring(0, 200),
        stage
      });
      
      // Detect mentions with improved logic
      const mentions = this.detectMentions(responseText, allBrands, allUrls, input.vertical);
      
      // Calculate SoV for this question
      const sov = this.calculateQuestionSoV(mentions);
      
      results.push({
        question,
        stage,
        type,
        responses: { openai: responseText },
        mentions,
        sov
      });
      
      // Add small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  /**
   * Improved mention detection with flexible matching
   */
  private detectMentions(
    text: string, 
    brands: string[],
    urls: string[],
    vertical: string
  ): Record<string, BrandMention> {
    const mentions: Record<string, BrandMention> = {};
    const lowerText = text.toLowerCase();
    
    // Check each brand with flexible matching
    brands.forEach((brand, index) => {
      let count = 0;
      let firstIndex: number | undefined;
      
      // Try multiple matching strategies
      const brandVariations = [
        brand, // Exact name
        brand.toLowerCase(), // Lowercase
        brand.replace(/\s+/g, ''), // No spaces
        brand.replace(/\s+/g, '-'), // Hyphenated
      ];
      
      // Also check for domain mentions
      const domain = urls[index];
      const domainVariations = [
        domain,
        domain.replace(/^https?:\/\//, ''),
        domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
        domain.split('.')[0] // Just the domain name part
      ];
      
      // Check all variations
      [...brandVariations, ...domainVariations].forEach(variation => {
        const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const matches = Array.from(text.matchAll(regex));
        
        if (matches.length > 0) {
          count += matches.length;
          if (firstIndex === undefined) {
            firstIndex = matches[0].index;
          }
        }
      });
      
      if (count > 0) {
        mentions[brand] = {
          brand,
          count,
          firstMentionIndex: firstIndex
        };
      }
    });
    
    // Detect other brands based on context
    const otherBrands = this.detectOtherBrands(text, brands, vertical);
    
    // ALWAYS add "Others" if we found other brands OR if no specific brands were mentioned
    if (otherBrands.length > 0 || Object.keys(mentions).length === 0) {
      // If no brands mentioned at all, count generic terms
      let othersCount = otherBrands.length;
      
      if (Object.keys(mentions).length === 0) {
        // Count generic business terms (vertical-agnostic)
        const genericTerms = [
          'company', 'companies',
          'provider', 'providers',
          'vendor', 'vendors',
          'solution', 'solutions',
          'platform', 'platforms',
          'service', 'services',
          'firm', 'firms',
          'business', 'businesses',
          'organization', 'organizations',
          'enterprise', 'enterprises',
          'brand', 'brands',
          'supplier', 'suppliers',
          'partner', 'partners'
        ];
        
        genericTerms.forEach(term => {
          const regex = new RegExp(`\\b${term}\\b`, 'gi');
          const matches = text.match(regex);
          if (matches) {
            othersCount += matches.length;
          }
        });
        
        // Ensure at least 1 "Others" mention if response exists
        if (othersCount === 0 && text.length > 50) {
          othersCount = 1;
        }
      }
      
      if (othersCount > 0) {
        mentions['Others'] = {
          brand: 'Others',
          count: othersCount
        };
      }
    }
    
    logger.info('Mentions detected', { 
      questionSnippet: text.substring(0, 50),
      mentions: Object.keys(mentions),
      counts: Object.fromEntries(Object.entries(mentions).map(([k, v]) => [k, v.count]))
    });
    
    return mentions;
  }

  /**
   * Detect other brands (vertical-agnostic)
   */
  private detectOtherBrands(text: string, knownBrands: string[], vertical: string): string[] {
    const otherBrands: string[] = [];
    
    // Generic pattern to detect company names (works for any industry)
    // Looks for capitalized words followed by business indicators
    const patterns = [
      // Company with descriptor: "Acme Corporation", "Nike Inc", "Apple Technologies"
      /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:Inc|Corp|Corporation|Company|Co|LLC|Ltd|Limited|Group|Partners|Technologies|Systems|Solutions|Services|Enterprises|Industries|Holdings|International|Global)\b/g,
      
      // Product or brand names in specific contexts
      /\b(?:using|with|by|from|via|through|at)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/g,
      
      // Comparison context: "like Nike", "such as Apple", "including Microsoft"
      /\b(?:like|such as|including|especially|particularly)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const potential = match[1];
        // Filter out common words and known brands
        if (!knownBrands.some(b => b.toLowerCase() === potential.toLowerCase()) && 
            potential.length > 2 && 
            !['The', 'This', 'That', 'These', 'Those', 'And', 'But', 'For', 'With', 'From'].includes(potential) &&
            !otherBrands.includes(potential)) {
          otherBrands.push(potential);
        }
      }
    });
    
    return Array.from(new Set(otherBrands));
  }

  /**
   * Calculate SoV for a single question
   */
  private calculateQuestionSoV(
    mentions: Record<string, BrandMention>
  ): Record<string, number> {
    const totalMentions = Object.values(mentions)
      .reduce((sum, m) => sum + m.count, 0);
    
    if (totalMentions === 0) return {};
    
    const sov: Record<string, number> = {};
    for (const [brand, mention] of Object.entries(mentions)) {
      sov[brand] = Number(((mention.count / totalMentions) * 100).toFixed(1));
    }
    
    return sov;
  }

  /**
   * Calculate overall SoV metrics with strategic insights
   */
  private calculateSoV(
    results: QuestionResult[], 
    input: SovAnalysisInput
  ): any {
    const overallMentions: Record<string, number> = {};
    const questionCoverage: Record<string, number> = {};
    
    // Initialize with all brands including Others
    const allBrands = [input.brand.name, ...input.competitors.map(c => c.name), 'Others'];
    allBrands.forEach(brand => {
      overallMentions[brand] = 0;
      questionCoverage[brand] = 0;
    });
    
    // Aggregate mentions across all questions
    for (const result of results) {
      for (const [brand, mention] of Object.entries(result.mentions)) {
        overallMentions[brand] = (overallMentions[brand] || 0) + mention.count;
        questionCoverage[brand] = (questionCoverage[brand] || 0) + 1;
      }
    }
    
    // Calculate overall SoV
    const totalMentions = Object.values(overallMentions).reduce((a, b) => a + b, 0);
    const overallSoV: Record<string, number> = {};
    
    // Only include brands that have mentions
    for (const [brand, count] of Object.entries(overallMentions)) {
      if (count > 0) {
        overallSoV[brand] = Number(((count / totalMentions) * 100).toFixed(1));
      }
    }
    
    // Calculate coverage percentages
    const coveragePercentages: Record<string, number> = {};
    for (const [brand, count] of Object.entries(questionCoverage)) {
      if (count > 0) {
        coveragePercentages[brand] = Number(((count / results.length) * 100).toFixed(1));
      }
    }
    
    // Generate strategic insights using archetype analysis
    const strategicInsights = this.generateStrategicInsights(results, input, overallSoV);
    
    // Log final metrics
    logger.info('Final SoV metrics calculated', {
      overallSoV,
      totalMentions: overallMentions,
      questionCoverage: coveragePercentages
    });
    
    return {
      summary: {
        brand: input.brand.name,
        competitors: input.competitors.map(c => c.name),
        totalQuestions: results.length,
        timestamp: new Date().toISOString(),
        strategicInsights
      },
      metrics: {
        overallSoV,
        totalMentions: overallMentions,
        questionCoverage: coveragePercentages
      },
      questionResults: results.map(r => ({
        question: r.question,
        stage: r.stage,
        sov: r.sov
      }))
    };
  }

  /**
   * Generate strategic insights using archetype-based analysis
   */
  private generateStrategicInsights(
    results: QuestionResult[],
    input: SovAnalysisInput,
    overallSoV: Record<string, number>
  ): string {
    const brandName = input.brand.name;
    const competitorNames = input.competitors.map(c => c.name);
    
    // Calculate stage-specific metrics
    const stageMetrics = this.calculateStageMetrics(results, brandName, competitorNames);
    
    // Apply archetype logic to determine strategic insights
    const insights = this.applyArchetypeLogic(stageMetrics, brandName, overallSoV);
    
    return insights;
  }

  /**
   * Calculate performance metrics by buyer journey stage
   */
  private calculateStageMetrics(
    results: QuestionResult[],
    brandName: string,
    competitorNames: string[]
  ) {
    const stages = ['awareness', 'consideration', 'decision'];
    const stageData: Record<string, any> = {};
    
    stages.forEach(stage => {
      const stageResults = results.filter(r => r.stage === stage);
      const stageQuestions = stageResults.length;
      
      // Calculate brand SoV for this stage
      let brandSoV = 0;
      let brandPresence = 0;
      let competitorSoVs: number[] = [];
      let othersTotal = 0;
      
      stageResults.forEach(result => {
        const brandValue = result.sov[brandName] || 0;
        brandSoV += brandValue;
        if (brandValue > 0) brandPresence++;
        
        // Collect competitor SoVs (excluding Others)
        competitorNames.forEach(comp => {
          const compValue = result.sov[comp] || 0;
          competitorSoVs.push(compValue);
        });
        
        othersTotal += result.sov['Others'] || 0;
      });
      
      // Calculate averages
      const avgBrandSoV = stageQuestions > 0 ? brandSoV / stageQuestions : 0;
      const avgCompetitorSoV = competitorSoVs.length > 0 ? 
        competitorSoVs.reduce((a, b) => a + b, 0) / competitorSoVs.length : 0;
      const avgOthers = stageQuestions > 0 ? othersTotal / stageQuestions : 0;
      
      stageData[stage] = {
        questions: stageQuestions,
        brandSoV: Number(avgBrandSoV.toFixed(1)),
        competitorAvg: Number(avgCompetitorSoV.toFixed(1)),
        othersAvg: Number(avgOthers.toFixed(1)),
        brandPresence: brandPresence,
        presenceRate: stageQuestions > 0 ? Number(((brandPresence / stageQuestions) * 100).toFixed(1)) : 0
      };
    });
    
    return stageData;
  }

  /**
   * Apply the 14 archetype patterns to generate strategic insights
   */
  private applyArchetypeLogic(
    stageMetrics: Record<string, any>,
    brandName: string,
    overallSoV: Record<string, number>
  ): string {
    const insights: string[] = [];
    const usedArchetypes: Set<string> = new Set();
    const stages = ['awareness', 'consideration', 'decision'];
    
    // Find priority gaps (largest positive gap = competitor avg - brand SoV)
    const gaps = stages.map(stage => ({
      stage,
      gap: stageMetrics[stage].competitorAvg - stageMetrics[stage].brandSoV,
      data: stageMetrics[stage]
    })).sort((a, b) => b.gap - a.gap);
    
    // Apply archetype triggers in priority order (max 5, no repeats)
    gaps.forEach(({ stage, gap, data }) => {
      // Stop if we already have 5 insights
      if (insights.length >= 5) return;
      
      const brandSoV = data.brandSoV;
      const competitorAvg = data.competitorAvg;
      const othersAvg = data.othersAvg;
      const questions = data.questions;
      
      // Skip if insufficient data
      if (questions < 3) {
        const archetype = 'Insufficient Data';
        if (!usedArchetypes.has(archetype)) {
          usedArchetypes.add(archetype);
          insights.push(`Insufficient ${stage.charAt(0).toUpperCase() + stage.slice(1)} Data\n${brandName} analyzed across ${questions} ${stage} question(s). Minimum 3 questions needed for reliable insights.\nAction: Expand question set for comprehensive ${stage} analysis.\nDeliverables: Brand Strategy & Messaging; Content development; Market research expansion.`);
        }
        return;
      }
      
      // Apply thresholds and archetype triggers
      if (brandSoV === 0) {
        // Absent = 0% presence
        if (stage === 'awareness') {
          const archetype = 'Crack the Visibility Lists';
          if (!usedArchetypes.has(archetype)) {
            usedArchetypes.add(archetype);
            insights.push(`Crack the Visibility Lists\n${brandName} at 0% vs competitor avg ${competitorAvg}% across ${questions} ${stage} question(s). Currently invisible in category discussions.\nAction: Earn inclusion in category roundups/directories and publish cite-able explainers.\nDeliverables: Brand Strategy & Messaging; Visual Identity refresh & guidelines; Educational content hub.`);
          }
        } else if (stage === 'consideration') {
          const archetype = 'Close the Shortlist Gap';
          if (!usedArchetypes.has(archetype)) {
            usedArchetypes.add(archetype);
            insights.push(`Close the Shortlist Gap\n${brandName} at 0% vs competitor avg ${competitorAvg}% across ${questions} ${stage} question(s). Missing from buyer shortlists entirely.\nAction: Build comparison pages, evaluator checklists, "why us" proof.\nDeliverables: Web design & development; UX/UI; Messaging frameworks; Landing pages.`);
          }
        }
      } else if (brandSoV + 5 < competitorAvg) {
        // Underperforming = brandSoV + 5pp < competitor avg
        if (stage === 'awareness') {
          const archetype = 'Own the Category Narrative';
          if (!usedArchetypes.has(archetype)) {
            usedArchetypes.add(archetype);
            insights.push(`Own the Category Narrative\n${brandName} at ${brandSoV}% vs competitor avg ${competitorAvg}% across ${questions} ${stage} question(s). Underperforming in early-stage visibility.\nAction: Publish POV frameworks, definitions, and comparison primers AI can quote.\nDeliverables: Brand Platform/Messaging; Content development; Campaign creative.`);
          }
        } else if (stage === 'decision') {
          const archetype = 'Prove Measurable Outcomes';
          if (!usedArchetypes.has(archetype)) {
            usedArchetypes.add(archetype);
            insights.push(`Prove Measurable Outcomes\n${brandName} at ${brandSoV}% vs competitor avg ${competitorAvg}% across ${questions} ${stage} question(s). Failing to demonstrate clear ROI/impact.\nAction: Quantified case studies; before/after KPIs; outcome dashboards.\nDeliverables: KPI analysis, conversion tracking, engagement analytics; Analytics dashboards.`);
          }
        }
      } else if (brandSoV >= competitorAvg - 5) {
        // Strong = brandSoV ≥ competitor avg - 5pp
        const archetype = 'Scale Market Momentum';
        if (!usedArchetypes.has(archetype)) {
          usedArchetypes.add(archetype);
          insights.push(`Scale Market Momentum\n${brandName} at ${brandSoV}% vs competitor avg ${competitorAvg}% across ${questions} ${stage} question(s). Strong performance to amplify.\nAction: Amplify what's working across paid/earned/owned; expand formats.\nDeliverables: Media service plans (paid search/social, programmatic, video/audio); SEO monthly program; Campaign creative/motion.`);
        }
      }
      
      // Check for fragmented market control
      if (othersAvg >= Math.max(competitorAvg, 20)) {
        const archetype = 'Control the Fragmented Space';
        if (!usedArchetypes.has(archetype) && insights.length < 5) {
          usedArchetypes.add(archetype);
          insights.push(`Control the Fragmented Space\n"Others" at ${othersAvg}% vs competitor avg ${competitorAvg}% in ${stage}. Market highly fragmented.\nAction: Publish authoritative, comprehensive category resources to consolidate scattered mentions.\nDeliverables: Authoritative content hubs; Comparison matrices; Information architecture updates.`);
        }
      }
    });
    
    // If no specific insights triggered, add generic recommendations
    if (insights.length === 0) {
      insights.push(`Differentiate with Signature Strengths\n${brandName} shows presence but lacks distinctive positioning vs competitors. Generic associations detected.\nAction: Name/seed distinctive features, verticals, methods across site & content.\nDeliverables: Positioning + product messaging; Industry/vertical landing pages; Motion/visual stories.`);
    }
    
    return insights.join('\n\n');
  }
}

// Export singleton instance
export const sovService = new SovService();