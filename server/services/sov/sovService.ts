import OpenAI from 'openai';
import { db } from '../../db';
import logger from '../../utils/logging/logger';

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
  responses: Record<string, string>;
  mentions: Record<string, BrandMention>;
  sov: Record<string, number>;
}

export class SovService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Main entry point for SoV analysis
   */
  async analyzeShareOfVoice(input: SovAnalysisInput): Promise<any> {
    try {
      logger.info('Starting SoV analysis', { brand: input.brand.name });
      
      // Step 1: Understand the brands
      const brandContext = await this.researchBrands(input);
      
      // Step 2: Generate intelligent questions
      const questions = await this.generateQuestions(brandContext, input);
      
      // Step 3: Query AI platforms with questions
      const results = await this.queryAIPlatforms(questions, input);
      
      // Step 4: Calculate Share of Voice
      const sovMetrics = this.calculateSoV(results, input);
      
      logger.info('SoV analysis complete', { brand: input.brand.name });
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
        content: `Research these brands and provide a brief summary of what each does:
        - ${input.brand.name} (${input.brand.url})
        - ${input.competitors.map(c => `${c.name} (${c.url})`).join('\n- ')}
        
        Format: Brief 1-2 sentence description for each.`
      }],
      temperature: 0.3
    });
    
    return response.choices[0].message.content || '';
  }

  /**
   * Generate questions based on brand understanding
   */
  private async generateQuestions(
    brandContext: string, 
    input: SovAnalysisInput
  ): Promise<string[]> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: 'You are an expert at creating vendor-neutral questions that potential buyers would ask when researching solutions.'
      }, {
        role: 'user',
        content: `Based on these competing brands and what they do:
${brandContext}

Generate 15 non-branded, vendor-neutral questions that someone evaluating these types of tools would search for.

Requirements:
- NO brand names in questions
- Questions a real buyer would ask about these SPECIFIC capabilities
- Mix of question types:
  * 5 Awareness stage (understanding the problem/solution)
  * 5 Consideration stage (comparing approaches)
  * 5 Decision stage (implementation specifics)
- Use varied formats: "how to", "best", "what is", "which", comparisons

Output as a numbered list.`
      }],
      temperature: 0.7
    });
    
    const questionsText = response.choices[0].message.content || '';
    return questionsText
      .split('\n')
      .filter(q => q.match(/^\d/))
      .map(q => q.replace(/^\d+\.\s*(?:\[.*?\]\s*)?/, ''));
  }

  /**
   * Query AI platforms with questions
   */
  private async queryAIPlatforms(
    questions: string[], 
    input: SovAnalysisInput
  ): Promise<QuestionResult[]> {
    const results: QuestionResult[] = [];
    const allBrands = [input.brand.name, ...input.competitors.map(c => c.name)];
    
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];
      // Determine stage based on index
      const stage = index < 5 ? 'awareness' : index < 10 ? 'consideration' : 'decision';
      
      // Query OpenAI (in production, query multiple platforms)
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are a helpful assistant answering questions about software tools. Provide balanced, informative answers that mention relevant tools when appropriate.'
        }, {
          role: 'user',
          content: question
        }],
        temperature: 0.5
      });
      
      const responseText = response.choices[0].message.content || '';
      
      // Detect mentions
      const mentions = this.detectMentions(responseText, allBrands);
      
      // Calculate SoV for this question
      const sov = this.calculateQuestionSoV(mentions);
      
      results.push({
        question,
        stage,
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
   * Detect brand mentions in text
   */
  private detectMentions(
    text: string, 
    brands: string[]
  ): Record<string, BrandMention> {
    const mentions: Record<string, BrandMention> = {};
    
    for (const brand of brands) {
      const regex = new RegExp(`\\b${brand}\\b`, 'gi');
      const matches = Array.from(text.matchAll(regex));
      
      if (matches.length > 0) {
        mentions[brand] = {
          brand,
          count: matches.length,
          firstMentionIndex: matches[0].index
        };
      }
    }
    
    // Detect other brands (simplified for now)
    const otherBrands = this.detectOtherBrands(text, brands);
    if (otherBrands.length > 0) {
      mentions['Others'] = {
        brand: 'Others',
        count: otherBrands.length
      };
    }
    
    return mentions;
  }

  /**
   * Detect other brands not in our list
   */
  private detectOtherBrands(text: string, knownBrands: string[]): string[] {
    const otherBrands: string[] = [];
    const pattern = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\b(?=\s+(?:is|offers|provides|has|features))/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const brand = match[1];
      if (!knownBrands.includes(brand) && brand.length > 3) {
        otherBrands.push(brand);
      }
    }
    
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
   * Calculate overall SoV metrics
   */
  private calculateSoV(
    results: QuestionResult[], 
    input: SovAnalysisInput
  ): any {
    const overallMentions: Record<string, number> = {};
    const questionCoverage: Record<string, number> = {};
    
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
    
    for (const [brand, count] of Object.entries(overallMentions)) {
      overallSoV[brand] = Number(((count / totalMentions) * 100).toFixed(1));
    }
    
    // Calculate coverage percentages
    const coveragePercentages: Record<string, number> = {};
    for (const [brand, count] of Object.entries(questionCoverage)) {
      coveragePercentages[brand] = Number(((count / results.length) * 100).toFixed(1));
    }
    
    return {
      summary: {
        brand: input.brand.name,
        competitors: input.competitors.map(c => c.name),
        totalQuestions: results.length,
        timestamp: new Date().toISOString()
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
}

// Export singleton instance
export const sovService = new SovService();