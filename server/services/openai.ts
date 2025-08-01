import OpenAI from "openai";
import logger from "../utils/logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
});

interface MetricAnalysis {
  context: string;
  insight: string;
  recommendation: string;
}

export async function generateMetricInsights(
  metricName: string,
  clientValue: number,
  cdAverage: number,
  industryAverage: number,
  competitorValues: number[],
  industryVertical: string,
  businessSize: string
): Promise<MetricAnalysis> {
  try {
    const prompt = `You are an expert digital marketing analyst. Analyze the following web analytics metric and provide insights:

Metric: ${metricName}
Client Value: ${clientValue}
Clear Digital Average: ${cdAverage}
Industry Average: ${industryAverage}
Competitor Values: ${competitorValues.join(', ')}
Industry: ${industryVertical}
Business Size: ${businessSize}

Provide a comprehensive analysis in JSON format with exactly these three fields:
1. "context" - Explain what this metric performance means relative to benchmarks
2. "insight" - Provide analytical interpretation of why this performance might be occurring
3. "recommendation" - Give specific, actionable advice to improve or maintain this metric

Keep each section concise but informative (2-3 sentences each). Focus on practical business implications.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a digital marketing analytics expert. Analyze metrics and provide actionable insights in JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      context: result.context || "Unable to generate context analysis.",
      insight: result.insight || "Unable to generate insights.",
      recommendation: result.recommendation || "Unable to generate recommendations."
    };
  } catch (error) {
    logger.error("Error generating AI insights", { error: (error as Error).message, metricName, clientValue });
    return {
      context: "Unable to generate AI analysis at this time.",
      insight: "Please try again later or contact support.",
      recommendation: "Continue monitoring this metric manually."
    };
  }
}

export async function generateBulkInsights(
  clientId: string,
  timePeriod: string,
  metricsData: Array<{
    metricName: string;
    clientValue: number;
    cdAverage: number;
    industryAverage: number;
    competitorValues: number[];
  }>,
  clientInfo: {
    industryVertical: string;
    businessSize: string;
  }
): Promise<Array<{
  metricName: string;
  context: string;
  insight: string;
  recommendation: string;
}>> {
  const insights = [];
  
  for (const metric of metricsData) {
    const analysis = await generateMetricInsights(
      metric.metricName,
      metric.clientValue,
      metric.cdAverage,
      metric.industryAverage,
      metric.competitorValues,
      clientInfo.industryVertical,
      clientInfo.businessSize
    );
    
    insights.push({
      metricName: metric.metricName,
      ...analysis
    });
  }
  
  return insights;
}

/**
 * Generate comprehensive dashboard insights from aggregated context
 */
export async function generateComprehensiveInsights(
  context: any // InsightGenerationContext
): Promise<{
  dashboardSummary: {
    context: string;
    insight: string;
    recommendation: string;
  };
  metricInsights: Array<{
    metricName: string;
    context: string;
    insight: string;
    recommendation: string;
  }>;
}> {
  try {
    // Generate overall dashboard summary
    const summaryPrompt = `You are a senior digital marketing consultant analyzing a comprehensive dashboard for ${context.client.name}, a ${context.client.businessSize} company in the ${context.client.industryVertical} industry.

DASHBOARD OVERVIEW:
- Analysis Period: ${context.period} (vs. previous period ${context.previousPeriod})
- Total Competitors Tracked: ${context.totalCompetitors}
- Industry Benchmarks Available: ${context.hasIndustryData ? 'Yes' : 'No'}
- Clear Digital Portfolio Data: ${context.hasCdPortfolioData ? 'Yes' : 'No'}

KEY METRICS SUMMARY:
${context.metrics.map((m: any) => `
- ${m.metricName}: ${m.clientValue || 'N/A'} (${m.trendDirection} ${m.percentageChange ? Math.abs(m.percentageChange).toFixed(1) + '%' : ''} vs. last period)
  vs. CD Avg: ${m.cdAverage || 'N/A'} | Industry: ${m.industryAverage || 'N/A'}
  Competitors: ${m.competitorValues.length > 0 ? m.competitorValues.join(', ') : 'None'}
`).join('')}

Provide a strategic overview in JSON format with:
1. "context" - High-level performance summary across all metrics (2-3 sentences)
2. "insight" - Strategic analysis of overall digital marketing effectiveness (2-3 sentences)  
3. "recommendation" - Top 2-3 strategic priorities for the next period (2-3 sentences)

Focus on business impact and strategic direction rather than individual metric details.`;

    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior digital marketing consultant providing strategic dashboard analysis in JSON format."
        },
        {
          role: "user",
          content: summaryPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 600
    });

    const summaryResult = JSON.parse(summaryResponse.choices[0].message.content || '{}');

    // Generate individual metric insights with enhanced context
    const metricInsights = [];
    for (const metric of context.metrics) {
      if (metric.clientValue !== null) {
        const analysis = await generateEnhancedMetricInsights(metric, context);
        metricInsights.push({
          metricName: metric.metricName,
          ...analysis
        });
      }
    }

    return {
      dashboardSummary: {
        context: summaryResult.context || "Dashboard analysis in progress.",
        insight: summaryResult.insight || "Strategic insights being generated.",
        recommendation: summaryResult.recommendation || "Recommendations will be available shortly."
      },
      metricInsights
    };

  } catch (error) {
    logger.error("Error generating comprehensive insights", { 
      error: (error as Error).message,
      clientId: context.client.id,
      period: context.period 
    });
    
    return {
      dashboardSummary: {
        context: "Unable to generate comprehensive analysis at this time.",
        insight: "Please try again or contact support for assistance.",
        recommendation: "Continue monitoring metrics manually in the meantime."
      },
      metricInsights: []
    };
  }
}

/**
 * Generate enhanced metric insights with trend and competitive context
 */
async function generateEnhancedMetricInsights(
  metric: any, // AggregatedMetricData
  context: any // InsightGenerationContext
): Promise<{
  context: string;
  insight: string;
  recommendation: string;
}> {
  try {
    const trendText = metric.percentageChange 
      ? `${metric.trendDirection} ${Math.abs(metric.percentageChange).toFixed(1)}% from last period`
      : `${metric.trendDirection} trend`;

    const competitiveContext = metric.competitorValues.length > 0
      ? `Competitors average: ${(metric.competitorValues.reduce((a: number, b: number) => a + b, 0) / metric.competitorValues.length).toFixed(1)}`
      : 'No competitor data available';

    const prompt = `Analyze this web analytics metric for ${context.client.name} (${context.client.businessSize}, ${context.client.industryVertical}):

METRIC PERFORMANCE:
- ${metric.metricName}: ${metric.clientValue} (${trendText})
- Previous Period: ${metric.previousPeriodValue || 'N/A'}
- Clear Digital Average: ${metric.cdAverage || 'N/A'}
- Industry Average: ${metric.industryAverage || 'N/A'}
- ${competitiveContext}

COMPETITIVE LANDSCAPE:
${metric.competitorNames.length > 0 ? 
  metric.competitorNames.map((name: string, i: number) => 
    `- ${name}: ${metric.competitorValues[i]}`
  ).join('\n') : 
  'No competitor data available'
}

Provide analysis in JSON format:
1. "context" - Performance interpretation with trend and competitive positioning (2 sentences)
2. "insight" - Why this performance is occurring and business implications (2 sentences)
3. "recommendation" - Specific, actionable next steps for this metric (2 sentences)

Focus on practical business impact and competitive advantage.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a digital marketing analytics expert providing metric-specific insights in JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 400
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      context: result.context || "Metric analysis in progress.",
      insight: result.insight || "Insights being generated.",
      recommendation: result.recommendation || "Recommendations will be available shortly."
    };

  } catch (error) {
    logger.error("Error generating enhanced metric insights", { 
      error: (error as Error).message,
      metricName: metric.metricName 
    });
    
    return {
      context: "Unable to analyze this metric at the moment.",
      insight: "Analysis temporarily unavailable.",
      recommendation: "Monitor this metric manually and try again later."
    };
  }
}

// Generate insights for a specific metric
export async function generateMetricSpecificInsights(metricName: string, metricData: any, clientId: string) {
  const prompt = `As an expert web analytics consultant, analyze this specific metric and provide insights:

METRIC: ${metricName}
CLIENT DATA: ${JSON.stringify(metricData)}

Provide a JSON response with exactly this structure:
{
  "context": "Brief explanation of what this metric measures and why it matters (2-3 sentences)",
  "insights": "Analysis of the current performance, comparing to benchmarks when available (2-3 sentences)", 
  "recommendations": "Specific, actionable recommendations for improvement (2-3 sentences)"
}

Keep each section concise and professional. Focus on actionable insights that a business owner can understand and implement.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert web analytics consultant. Provide clear, actionable insights in the exact JSON format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    logger.info('Raw OpenAI response', { response: response.substring(0, 200) });

    // Clean the response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    
    // Remove ```json at the start and ``` at the end
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.replace(/^```json\s*/, '');
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.replace(/\s*```$/, '');
    }
    
    logger.info('Cleaned response', { cleanResponse: cleanResponse.substring(0, 200) });
    
    const insights = JSON.parse(cleanResponse);
    
    return {
      context: insights.context,
      insights: insights.insights,
      recommendations: insights.recommendations
    };

  } catch (error) {
    logger.error('Error generating metric-specific insights with OpenAI', { 
      error: (error as Error).message,
      metricName,
      clientId
    });
    
    // Fallback insights
    return {
      context: `${metricName} is a key performance indicator that helps measure website effectiveness and user engagement.`,
      insights: `Your current ${metricName} performance shows opportunities for optimization based on industry standards.`,
      recommendations: `Focus on improving ${metricName} through targeted optimization strategies and regular monitoring.`
    };
  }
}
