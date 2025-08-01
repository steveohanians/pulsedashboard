import OpenAI from "openai";
import logger from "../utils/logger";
import type { MetricPrompt } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
});

interface MetricAnalysis {
  context: string;
  insight: string;
  recommendation: string;
}

async function generateInsightsWithCustomPrompt(
  customPrompt: MetricPrompt,
  metricName: string,
  clientValue: number,
  cdAverage: number,
  industryAverage: number,
  competitorValues: number[],
  industryVertical: string,
  businessSize: string
): Promise<MetricAnalysis> {
  try {
    // Format competitors data properly
    const competitorsText = competitorValues.length > 0 
      ? competitorValues.map((val, idx) => `Competitor ${idx + 1}: ${val}`).join(', ')
      : 'No competitor data available';

    // Handle special formatting for Session Duration
    let formattedClientValue = clientValue.toString();
    let formattedCdAverage = cdAverage.toString();
    let formattedIndustryAverage = industryAverage.toString();
    
    if (metricName === 'Session Duration') {
      const clientMinutes = Math.floor(clientValue / 60);
      const clientSeconds = Math.round(clientValue % 60);
      const cdMinutes = Math.floor(cdAverage / 60);
      const cdSecondsRem = Math.round(cdAverage % 60);
      const industryMinutes = Math.floor(industryAverage / 60);
      const industrySecondsRem = Math.round(industryAverage % 60);
      
      formattedClientValue = `${clientValue} seconds (${clientMinutes}m ${clientSeconds}s)`;
      formattedCdAverage = `${cdAverage} seconds (${cdMinutes}m ${cdSecondsRem}s)`;
      formattedIndustryAverage = `${industryAverage} seconds (${industryMinutes}m ${industrySecondsRem}s)`;
    }
    
    // Special handling for Traffic Channels - get actual channel distribution
    if (metricName === 'Traffic Channels') {
      try {
        const { storage } = await import("../storage");
        const getCurrentPeriod = () => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        };
        const currentPeriod = getCurrentPeriod();
        
        // Get channel distribution data for client, industry, and CD averages
        const clientChannels = await storage.getMetricsByNameAndPeriod('demo-client-id', 'Traffic Channels', currentPeriod, 'Client');
        const industryChannels = await storage.getMetricsByNameAndPeriod('demo-client-id', 'Traffic Channels', currentPeriod, 'Industry_Avg');
        const cdChannels = await storage.getMetricsByNameAndPeriod('demo-client-id', 'Traffic Channels', currentPeriod, 'CD_Avg');
        
        const formatChannelData = (channels: any[]) => {
          if (!channels.length) return 'No data available';
          return channels.map(c => `${c.channel}: ${c.value}%`).join(', ');
        };
        
        formattedClientValue = formatChannelData(clientChannels);
        formattedIndustryAverage = formatChannelData(industryChannels);
        formattedCdAverage = formatChannelData(cdChannels);
      } catch (error) {
        logger.warn('Failed to get traffic channel distribution data', { error: (error as Error).message });
      }
    }
    
    // Replace template variables in the custom prompt
    let processedPrompt = customPrompt.promptTemplate
      .replace(/\{\{clientName\}\}/g, 'Current Client')
      .replace(/\{\{industry\}\}/g, industryVertical)
      .replace(/\{\{businessSize\}\}/g, businessSize)
      .replace(/\{\{clientValue\}\}/g, formattedClientValue)
      .replace(/\{\{industryAverage\}\}/g, formattedIndustryAverage)
      .replace(/\{\{cdPortfolioAverage\}\}/g, formattedCdAverage)
      .replace(/\{\{competitors\}\}/g, competitorsText);

    // Add specific output format instruction for JSON compatibility
    processedPrompt += `

IMPORTANT: Provide your response in JSON format with exactly these three fields:
- "context": Your Context analysis section (use **bold** formatting for key insights)
- "insight": Your Competitive Intelligence section (use **bold** formatting for critical findings)
- "recommendation": Your Action Plan section formatted as: "1. First recommendation\n2. Second recommendation\n3. Third recommendation"

CRITICAL FORMATTING REQUIREMENTS:
- Use ONLY the formatted time values provided above (e.g., "310 seconds (5m 10s)" not just "310 seconds")
- Include **bold** formatting around key insights and strategic recommendations
- For Session Duration improvements, use natural time increments (30-60 seconds, 1-2 minutes) rather than exact seconds
- Focus on the strategic analysis rather than repeating basic time calculations
- NEVER repeat the section names in your response (don't start with "Context:", "Insight:", or "Recommendation:")`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: processedPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 600
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      context: result.context || "Unable to generate context analysis.",
      insight: result.insight || "Unable to generate insights.",
      recommendation: result.recommendation || "Unable to generate recommendations."
    };
  } catch (error) {
    logger.error("Error generating custom prompt insights", { 
      error: (error as Error).message, 
      metricName, 
      promptId: customPrompt.metricName 
    });
    throw error; // Re-throw to fall back to default
  }
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
  const { storage } = await import("../storage");
  
  try {
    // Try to get custom prompt for this metric
    const customPrompt = await storage.getMetricPrompt(metricName);
    
    if (customPrompt && customPrompt.isActive) {
      return await generateInsightsWithCustomPrompt(
        customPrompt,
        metricName,
        clientValue,
        cdAverage,
        industryAverage,
        competitorValues,
        industryVertical,
        businessSize
      );
    }
  } catch (error) {
    logger.warn("Failed to fetch or use custom prompt, using default", { 
      metricName, 
      error: (error as Error).message 
    });
  }
  
  // Fall back to default prompt logic
  try {
    const prompt = `STRATEGIC PERFORMANCE ANALYSIS for ${metricName}:

COMPETITIVE BENCHMARKING:
• Client Performance: ${clientValue}
• Clear Digital Portfolio: ${cdAverage}
• Industry Standard: ${industryAverage}
• Direct Competitors: ${competitorValues.join(', ')}
• Industry: ${industryVertical}
• Business Size: ${businessSize}

Provide strategic analysis in JSON format with exactly these three fields:
1. "context" - Strategic positioning analysis with competitive landscape assessment (2-3 sentences)
2. "insight" - Competitive intelligence insights explaining performance gaps and opportunities (2-3 sentences)
3. "recommendation" - Specific action plan with projected ROI and timeline for ${businessSize} companies (2-3 sentences)

Focus on competitive advantages, strategic opportunities, and measurable business impact.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a senior digital strategy consultant with 15+ years experience in competitive intelligence and data-driven growth optimization. Your insights drive measurable business results. Always provide specific, actionable recommendations with projected performance improvements. Focus on competitive advantages and strategic opportunities."
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

// Get metric unit/type and convert values for proper formatting
function getMetricDisplayInfo(metricName: string, value: any): { unit: string; displayValue: string; rawUnit: string } {
  const metricConfig: Record<string, { unit: string; rawUnit: string; converter?: (val: number) => number }> = {
    'Bounce Rate': { unit: '%', rawUnit: '%' },
    'Session Duration': { 
      unit: 'minutes and seconds', 
      rawUnit: 'seconds',
      converter: (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return parseFloat(`${minutes}.${remainingSeconds.toString().padStart(2, '0')}`);
      }
    },
    'Pages per Session': { unit: 'pages', rawUnit: 'pages' },
    'Sessions': { unit: 'sessions', rawUnit: 'sessions' },
    'Sessions per User': { unit: 'sessions', rawUnit: 'sessions' },
    'Page Views': { unit: 'views', rawUnit: 'views' },
    'Users': { unit: 'users', rawUnit: 'users' },
    'New Users': { unit: 'users', rawUnit: 'users' },
    'Conversion Rate': { unit: '%', rawUnit: '%' },
    'Click-Through Rate': { unit: '%', rawUnit: '%' },
    'Exit Rate': { unit: '%', rawUnit: '%' },
    'Load Time': { unit: 'seconds', rawUnit: 'seconds' },
    'Revenue': { unit: '$', rawUnit: '$' },
    'Traffic Channels': { unit: 'channels', rawUnit: 'channels' }
  };

  const config = metricConfig[metricName] || { unit: 'units', rawUnit: 'units' };
  
  if (config.converter && typeof value === 'number') {
    const convertedValue = config.converter(value);
    return {
      unit: config.unit,
      displayValue: convertedValue.toString(),
      rawUnit: config.rawUnit
    };
  }
  
  return {
    unit: config.unit,
    displayValue: value?.toString() || '0',
    rawUnit: config.rawUnit
  };
}

// Generate insights for a specific metric
export async function generateMetricSpecificInsights(metricName: string, enrichedData: any, clientId: string) {
  const { storage } = await import("../storage");
  
  // First try to use custom prompt templates from the admin panel
  try {
    const customPrompt = await storage.getMetricPrompt(metricName);
    
    if (customPrompt && customPrompt.isActive) {
      logger.info('✅ USING CUSTOM PROMPT TEMPLATE', { 
        metricName, 
        promptId: customPrompt.id,
        promptPreview: customPrompt.promptTemplate.substring(0, 150) + '...'
      });
      
      // Use the existing custom prompt system with the enhanced data
      const competitorValues = enrichedData.benchmarks?.competitors?.map((c: any) => c.value) || [];
      
      return await generateInsightsWithCustomPrompt(
        customPrompt,
        metricName,
        enrichedData.metric?.clientValue || 0,
        enrichedData.benchmarks?.cdPortfolioAverage || 0,
        enrichedData.benchmarks?.industryAverage || 0,
        competitorValues,
        enrichedData.client?.industry || 'Technology',
        enrichedData.client?.businessSize || 'Medium Business'
      );
    } else {
      logger.warn('❌ NO ACTIVE CUSTOM PROMPT FOUND', { 
        metricName, 
        customPromptExists: !!customPrompt,
        isActive: customPrompt?.isActive 
      });
    }
  } catch (error) {
    logger.error("❌ FAILED TO USE CUSTOM PROMPT - FALLING BACK TO HARDCODED", { 
      metricName, 
      error: (error as Error).message 
    });
  }
  
  // ⚠️ FALLBACK: Using hardcoded prompts (should rarely execute)
  logger.warn('⚠️ USING HARDCODED FALLBACK PROMPT', { metricName });
  const clientInfo = getMetricDisplayInfo(metricName, enrichedData.metric?.clientValue);
  const industryInfo = getMetricDisplayInfo(metricName, enrichedData.benchmarks?.industryAverage);
  const cdInfo = getMetricDisplayInfo(metricName, enrichedData.benchmarks?.cdPortfolioAverage);
  
  // Special handling for Traffic Channels - get actual channel distribution
  let trafficChannelData = '';
  if (metricName === 'Traffic Channels') {
    try {
      const { storage } = await import("../storage");
      const currentPeriod = enrichedData.metric?.timePeriod || 'Last Month';
      
      // Get channel distribution data for client, industry, and CD averages
      const clientChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', currentPeriod, 'Client');
      const industryChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', currentPeriod, 'Industry_Avg');
      const cdChannels = await storage.getMetricsByNameAndPeriod(clientId, 'Traffic Channels', currentPeriod, 'CD_Avg');
      
      const formatChannelData = (channels: any[], label: string) => {
        if (!channels.length) return `${label}: No data available`;
        const channelList = channels.map(c => `${c.channel}: ${c.value}%`).join(', ');
        return `${label}: ${channelList}`;
      };
      
      trafficChannelData = `
TRAFFIC CHANNEL DISTRIBUTION:
- ${formatChannelData(clientChannels, 'Client')}
- ${formatChannelData(industryChannels, 'Industry Average')}
- ${formatChannelData(cdChannels, 'CD Portfolio Average')}`;
    } catch (error) {
      logger.warn('Failed to get traffic channel distribution data', { error: (error as Error).message });
      trafficChannelData = 'Traffic channel distribution data temporarily unavailable.';
    }
  }
  
  // Convert competitor values too
  const competitorText = enrichedData.benchmarks?.competitors?.map((c: any) => {
    const compInfo = getMetricDisplayInfo(metricName, c.value);
    if (metricName === 'Session Duration') {
      const seconds = c.value;
      const minutes = Math.floor(seconds / 60);
      const remainingSecs = seconds % 60;
      return `${c.name} (${minutes}m ${remainingSecs}s)`;
    }
    return `${c.name} (${compInfo.displayValue}${compInfo.unit})`;
  }).join(', ') || 'No competitor data available';
  
  const prompt = `As an expert web analytics consultant, analyze this specific metric and provide insights:

METRIC ANALYSIS REQUEST:
- Metric: ${metricName} (stored as ${clientInfo.rawUnit}, displayed as ${clientInfo.unit})
- Client: ${enrichedData.client?.name} (${enrichedData.client?.industry}, ${enrichedData.client?.businessSize})
- Current Value: ${metricName === 'Session Duration' ? 
    `${Math.floor(enrichedData.metric?.clientValue / 60)}m ${enrichedData.metric?.clientValue % 60}s` : 
    `${clientInfo.displayValue}${clientInfo.unit}`}
- Time Period: ${enrichedData.metric?.timePeriod}

BENCHMARK COMPARISON:
- Industry Average: ${metricName === 'Session Duration' ? 
    `${Math.floor(enrichedData.benchmarks?.industryAverage / 60)}m ${enrichedData.benchmarks?.industryAverage % 60}s` : 
    `${industryInfo.displayValue}${industryInfo.unit}`}
- CD Portfolio Average: ${metricName === 'Session Duration' ? 
    `${Math.floor(enrichedData.benchmarks?.cdPortfolioAverage / 60)}m ${enrichedData.benchmarks?.cdPortfolioAverage % 60}s` : 
    `${cdInfo.displayValue}${cdInfo.unit}`}
- Competitors: ${competitorText}
${metricName === 'Traffic Channels' ? trafficChannelData : ''}

FULL CONTEXT: ${enrichedData.context}

Provide a JSON response with exactly this structure. Use **bold formatting** strategically for emphasis:
{
  "context": "Brief explanation of what this metric measures and why it matters for this business. ${metricName === 'Session Duration' ? 'Use minutes and seconds format (e.g., 5m 12s)' : metricName === 'Traffic Channels' ? 'Explain that this measures traffic source diversification and the effectiveness of different acquisition channels, NOT just counting channels. Focus on channel utilization and distribution quality.' : `Include the metric unit (${clientInfo.unit})`} in your explanation (2-3 sentences)",
  "insights": "Detailed analysis comparing the client's performance to benchmarks. Use **bold** to emphasize the key insight or competitive advantage (e.g., **significantly outperforming competitors** or **lagging behind industry standards**). Include specific numbers but bold the interpretation, not just the numbers. ${metricName === 'Session Duration' ? 'Use format like 5m 12s for time values and describe differences meaningfully' : metricName === 'Traffic Channels' ? 'Focus on channel mix effectiveness, over-reliance on specific channels, or opportunities for diversification. Analyze the percentage distribution, not just the count.' : `Always use ${clientInfo.unit} as the unit`} (2-3 sentences)", 
  "recommendations": "Specific, actionable recommendations with **bold** emphasis on the key action or improvement strategy (e.g., **focus on content optimization** or **implement exit-intent popups**). Include specific targets but bold the strategic recommendation. ${metricName === 'Session Duration' ? 'Use practical time targets and improvement strategies' : metricName === 'Traffic Channels' ? 'Recommend specific channel optimization strategies, targeting underutilized channels like increasing organic search to X% or reducing over-dependence on direct traffic.' : `Include specific ${clientInfo.unit} targets where relevant`} (2-3 sentences)"
}

IMPORTANT: Always use ${clientInfo.unit} as the unit in your response, not ${clientInfo.rawUnit}. The values provided are already converted to the proper display format.`;

  logger.info('OpenAI Prompt Details', { 
    metricName,
    clientName: enrichedData.client?.name,
    clientValue: enrichedData.metric?.clientValue,
    industryAvg: enrichedData.benchmarks?.industryAverage,
    cdAvg: enrichedData.benchmarks?.cdPortfolioAverage,
    competitorCount: enrichedData.benchmarks?.competitors?.length || 0,
    fullPrompt: prompt.substring(0, 500)
  });

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
