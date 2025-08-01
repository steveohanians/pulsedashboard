import OpenAI from "openai";

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
    console.error("Error generating AI insights:", error);
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
