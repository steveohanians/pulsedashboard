import { OpenAI } from 'openai';
const logger = console;

// Using GPT-4o for compatibility
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
});

interface EffectivenessInsightsInput {
  clientName: string;
  websiteUrl: string;
  overallScore: number;
  criterionScores: {
    criterion: string;
    score: number;
    evidence: {
      description: string;
      details: any;
      reasoning: string;
    };
    passes: {
      passed: string[];
      failed: string[];
    };
  }[];
}

interface EffectivenessInsightsResult {
  insight: string;
  recommendations: string[];
  confidence: number;
  key_pattern: string;
}

export class EffectivenessInsightsService {
  /**
   * Generate personalized AI insights based on effectiveness analysis results
   */
  async generateInsights(input: EffectivenessInsightsInput): Promise<EffectivenessInsightsResult> {
    try {
      logger.info('Generating effectiveness insights', { 
        clientName: input.clientName, 
        overallScore: input.overallScore,
        criteriaCount: input.criterionScores.length 
      });

      // Get the insights prompt template
      const { storage } = await import('../../storage');
      const template = await storage.getEffectivenessPromptTemplate('insights');
      
      if (!template) {
        throw new Error('Insights prompt template not found');
      }

      // Format criterion data for the prompt
      const criteriaData = input.criterionScores.map(c => 
        `${c.criterion}: ${c.score}/10 (${c.passes.passed.length} passed, ${c.passes.failed.length} failed)`
      ).join('\n');

      // Create evidence summary focusing on gaps and patterns
      const evidenceSummary = input.criterionScores
        .filter(c => c.passes.failed.length > 0)
        .map(c => {
          const failedChecks = c.passes.failed.join(', ');
          return `${c.criterion} gaps: ${failedChecks}`;
        }).join('\n');

      // Replace template variables
      let prompt = template.promptTemplate
        .replace(/{clientName}/g, input.clientName)
        .replace(/{websiteUrl}/g, input.websiteUrl)
        .replace(/{overallScore}/g, input.overallScore.toString())
        .replace(/{criteriaData}/g, criteriaData)
        .replace(/{evidenceSummary}/g, evidenceSummary || 'No specific gaps identified');

      console.log('Calling OpenAI for effectiveness insights', { 
        promptLength: prompt.length,
        model: 'gpt-4o'
      });

      let response;
      try {
        response = await openai.chat.completions.create({
          model: 'gpt-4o',
          temperature: 0.3,
          messages: [
            { role: 'system', content: template.systemPrompt },
            { role: 'user', content: prompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 800
        });
        console.log('OpenAI call successful', {
          id: response.id,
          choices: response.choices?.length,
          usage: response.usage
        });
      } catch (apiError: any) {
        console.error('OpenAI API error:', {
          message: apiError.message,
          status: apiError.status,
          type: apiError.type
        });
        throw apiError;
      }

      const result = response.choices[0]?.message?.content?.trim();
      
      console.log('OpenAI response:', {
        choices: response.choices?.length || 0,
        hasContent: !!response.choices?.[0]?.message?.content,
        contentLength: response.choices?.[0]?.message?.content?.length || 0,
        result: result?.substring(0, 200) + '...'
      });
      
      if (!result) {
        throw new Error('Empty response from OpenAI');
      }

      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(result);
      } catch (parseError) {
        console.log('Failed to parse OpenAI response', { result, error: parseError });
        throw new Error('Invalid JSON response from OpenAI');
      }

      // Handle the response structure that OpenAI naturally returns
      let parsedResult: EffectivenessInsightsResult;
      
      console.log('Parsing response structure', { 
        keys: Object.keys(parsedResponse),
        responseType: typeof parsedResponse
      });
      
      // Check if it's using the natural structure with client name as key
      const clientKey = Object.keys(parsedResponse).find(key => key.includes('Insight'));
      const recommendationsKey = Object.keys(parsedResponse).find(key => key.includes('opportunity'));
      
      console.log('Key detection:', { clientKey, recommendationsKey });
      
      if (clientKey && parsedResponse[clientKey] && recommendationsKey && parsedResponse[recommendationsKey]) {
        console.log('Using natural structure parser');
        parsedResult = {
          insight: parsedResponse[clientKey],
          recommendations: Array.isArray(parsedResponse[recommendationsKey]) ? parsedResponse[recommendationsKey] : [],
          confidence: 0.85, // Default confidence since it's not in the response
          key_pattern: 'effectiveness_gaps'
        };
      } else {
        console.log('Fallback to expected structure');
        // Fallback to expected structure
        if (!parsedResponse.insight || !Array.isArray(parsedResponse.recommendations)) {
          console.log('Invalid response structure from OpenAI', { parsedResponse });
          throw new Error('Invalid response structure from OpenAI');
        }
        parsedResult = parsedResponse;
      }

      logger.info('Successfully generated effectiveness insights', {
        clientName: input.clientName,
        recommendationsCount: parsedResult.recommendations.length,
        confidence: parsedResult.confidence
      });

      return parsedResult;

    } catch (error) {
      logger.error('Error generating effectiveness insights', { 
        error: (error as Error).message,
        clientName: input.clientName,
        overallScore: input.overallScore
      });
      throw error;
    }
  }
}

export const effectivenessInsightsService = new EffectivenessInsightsService();