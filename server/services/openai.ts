import OpenAI from "openai";
import logger from "../utils/logging/logger";
import { storage } from "../storage";
import type { MetricPrompt } from "@shared/schema";

// Centralized formatting instructions for all OpenAI responses
const FORMATTING_INSTRUCTIONS = `

FORMATTING REQUIREMENTS:
- Use **bold text** for key metrics, percentages, and critical insights
- Format recommendations as numbered list (1. 2. 3.)
- Bold important phrases like **notable advantage**, **meaningful improvement**, **competitive positioning**
- Do NOT bold random words, company names, or first words of sentences

MANDATORY numbered lists in this exact format:
1. First recommendation text
2. Second recommendation text  
3. Third recommendation text

CRITICAL: Do NOT use paragraph format for recommendations. Use ONLY numbered list format (1., 2., 3.).`;

// To switch models, set OPENAI_MODEL in .env (e.g., OPENAI_MODEL=gpt-5)
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY!
});

interface MetricAnalysis {
  context: string;
  insight: string;
  recommendation: string;
  status: 'success' | 'needs_improvement' | 'warning';
}

// Type definitions for metric values
interface DeviceDistribution {
  device: string;
  percentage: number;
  sessions?: number;
}

interface TrafficChannel {
  channel: string;
  percentage: number;
}

type MetricValue = number | DeviceDistribution[] | TrafficChannel[];
type CompetitorValue = number | DeviceDistribution[] | TrafficChannel[];

async function generateInsightsWithCustomPrompt(
  customPrompt: MetricPrompt,
  metricName: string,
  clientValue: MetricValue,
  cdAverage: number,
  industryAverage: number,
  competitorValues: CompetitorValue[],
  industryVertical: string,
  businessSize: string,
  clientName: string,
  competitorNames?: string[]
): Promise<MetricAnalysis> {
  try {
    // Get global prompt template
    const { storage } = await import("../storage");
    const globalTemplate = await storage.getGlobalPromptTemplate();
    
    if (!globalTemplate) {
      logger.error("No global prompt template found");
      throw new Error("Global prompt template not available");
    }

    // Format competitors data properly with actual names
    const competitorsText = competitorValues.length > 0 
      ? competitorValues.map((val, idx) => {
          const name = competitorNames?.[idx] || `Competitor ${idx + 1}`;
          // Handle distribution data for competitors
          if (metricName === 'Device Distribution' && Array.isArray(val)) {
            const formatted = val.map((d: any) => `${d.device}: ${d.percentage}%`).join(', ');
            return `${name}: ${formatted}`;
          } else if (metricName === 'Traffic Channels' && Array.isArray(val)) {
            const formatted = val.map((c: any) => `${c.channel}: ${c.percentage}%`).join(', ');
            return `${name}: ${formatted}`;
          }
          return `${name}: ${val}`;
        }).join('; ')
      : 'No competitor data available';

    // Handle special formatting for different metric types
    let formattedClientValue: string;
    let formattedCdAverage = cdAverage.toString();
    let formattedIndustryAverage = industryAverage.toString();
    let formattedCompetitorsText = competitorsText;
    let metricDisplayName = metricName;
    
    // Special handling for CD portfolio average in Traffic Channels
    if (metricName === 'Traffic Channels' && Array.isArray(cdAverage)) {
      formattedCdAverage = cdAverage.map((channel: any) => 
        `${channel.channel}: ${channel.percentage}%`
      ).join(', ');
      logger.info('CD Portfolio Traffic Channels formatted for AI prompt', {
        originalData: cdAverage,
        formattedValue: formattedCdAverage
      });
    }
    
    // Special handling for Device Distribution
    if (metricName === 'Device Distribution' && Array.isArray(clientValue)) {
      formattedClientValue = clientValue.map((device: any) => 
        `${device.device}: ${device.percentage}% (${device.sessions} sessions)`
      ).join(', ');
      logger.info('Device Distribution formatted for AI prompt', {
        originalData: clientValue,
        formattedValue: formattedClientValue
      });
    }
    // Special handling for Traffic Channels
    else if (metricName === 'Traffic Channels' && Array.isArray(clientValue)) {
      formattedClientValue = clientValue.map((channel: any) => 
        `${channel.channel}: ${channel.percentage}%`
      ).join(', ');
      logger.info('Traffic Channels formatted for AI prompt', {
        originalData: clientValue,
        formattedValue: formattedClientValue
      });
    }
    else {
      formattedClientValue = clientValue.toString();
    }
    
    if (metricName === 'Session Duration') {
      // Type guard: Session Duration should always be numeric
      const numericClientValue = typeof clientValue === 'number' ? clientValue : 0;
      const clientMinutes = Math.floor(numericClientValue / 60);
      const clientSeconds = Math.round(numericClientValue % 60);
      const cdMinutes = Math.floor(cdAverage / 60);
      const cdSecondsRem = Math.round(cdAverage % 60);
      const industryMinutes = Math.floor(industryAverage / 60);
      const industrySecondsRem = Math.round(industryAverage % 60);
      
      formattedClientValue = `${numericClientValue} seconds (${clientMinutes}m ${clientSeconds}s)`;
      formattedCdAverage = `${cdAverage} seconds (${cdMinutes}m ${cdSecondsRem}s)`;
      formattedIndustryAverage = `${industryAverage} seconds (${industryMinutes}m ${industrySecondsRem}s)`;
      
      // Format competitor values with time display
      if (competitorValues.length > 0) {
        formattedCompetitorsText = competitorValues.map((val, idx) => {
          const name = competitorNames?.[idx] || `Competitor ${idx + 1}`;
          // Type guard: Competitor values for Session Duration should be numeric
          const numericVal = typeof val === 'number' ? val : 0;
          const minutes = Math.floor(numericVal / 60);
          const seconds = Math.round(numericVal % 60);
          return `${name}: ${numericVal} seconds (${minutes}m ${seconds}s)`;
        }).join(', ');
      }
    }
    
    // Note: Traffic Channels special handling is now done at the API route level
    // to avoid clientId/clientName parameter issues
    
    // Merge global template with metric-specific prompt
    let processedPrompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, customPrompt.promptTemplate)
      .replace(/\{\{CONTEXT_INSTRUCTIONS\}\}/g, customPrompt.promptTemplate.includes('CONTEXT ANALYSIS:') 
        ? customPrompt.promptTemplate.split('CONTEXT ANALYSIS:')[1]?.split('\n')[0]?.trim() || 'Assess metric performance and competitive positioning.'
        : 'Assess metric performance and competitive positioning.')
      .replace(/\{\{COMPETITIVE_INSTRUCTIONS\}\}/g, customPrompt.promptTemplate.includes('COMPETITIVE INTELLIGENCE:') 
        ? customPrompt.promptTemplate.split('COMPETITIVE INTELLIGENCE:')[1]?.split('\n')[0]?.trim() || 'Compare performance against industry and competitors.'
        : 'Compare performance against industry and competitors.')
      .replace(/\{\{clientName\}\}/g, clientName || 'Current Client')
      .replace(/\{\{industry\}\}/g, industryVertical)
      .replace(/\{\{businessSize\}\}/g, businessSize)
      .replace(/\{\{clientValue\}\}/g, formattedClientValue)
      .replace(/\{\{industryAverage\}\}/g, formattedIndustryAverage)
      .replace(/\{\{cdPortfolioAverage\}\}/g, formattedCdAverage)
      .replace(/\{\{competitors\}\}/g, formattedCompetitorsText)
      .replace(/\{\{metricDisplayName\}\}/g, metricDisplayName);

    // Add specific output format instruction for JSON compatibility
    processedPrompt += `

IMPORTANT: Provide your response in JSON format with exactly these four fields:
- "context": Your Context analysis section (use **bold** formatting for key insights)
- "insight": Your Competitive Intelligence section (use **bold** formatting for critical findings)
- "recommendation": Your Action Plan section formatted as: "1. First recommendation\n2. Second recommendation\n3. Third recommendation"
- "status": Overall assessment - choose exactly one of: "success", "needs_improvement", or "warning"

STATUS ASSESSMENT GUIDELINES:
- "success": Performance is strong/above average compared to industry and competitors (green indicator)
- "needs_improvement": Performance is average or slightly below, with clear improvement opportunities (orange indicator)  
- "warning": Performance is significantly below benchmarks, requiring urgent attention (red indicator)

CRITICAL FORMATTING REQUIREMENTS:
- Use ONLY the formatted time values provided above (e.g., "310 seconds (5m 10s)" not just "310 seconds")
- Include **bold** formatting around key insights and strategic recommendations
- Focus on strategic analysis rather than repeating basic calculations
- NEVER repeat the section names in your response (don't start with "Context:", "Insight:", or "Recommendation:")
- NEVER suggest specific percentage improvements or exact performance increases - use qualitative language like "meaningful improvement", "significant enhancement", or "substantial optimization"`;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
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

    // Safe JSON parsing with error handling
    let result;
    try {
      result = JSON.parse(response.choices[0].message.content || '{}');
    } catch (parseError) {
      logger.error('Failed to parse OpenAI response JSON', {
        error: (parseError as Error).message,
        responseContent: response.choices[0].message.content,
        metricName,
        customPromptId: customPrompt.metricName
      });
      
      // Return warning object instead of throwing
      return {
        context: "Unable to generate context analysis due to response format error.",
        insight: "Unable to generate insights due to response format error.",
        recommendation: "1. Please try regenerating insights\n2. Contact support if the issue persists\n3. Review metric data for any unusual formatting",
        status: "warning"
      };
    }
    
    // Calculate proper status based on performance
    const calculatedStatus = determineMetricStatus(
      metricName,
      clientValue,
      industryAverage,
      cdAverage,
      competitorValues
    );
    
    // Use AI-provided status if available and valid, otherwise use calculated status
    const finalStatus = (result.status && ['success', 'warning', 'needs_improvement'].includes(result.status)) 
      ? result.status 
      : calculatedStatus;
    
    logger.info('Regular insights status determination', {
      metricName,
      clientValue,
      industryAverage,
      cdAverage,
      competitorValues,
      calculatedStatus,
      aiStatus: result.status,
      finalStatus
    });
    
    return {
      context: result.context || "Unable to generate context analysis.",
      insight: result.insight || "Unable to generate insights.",
      recommendation: result.recommendation || "Unable to generate recommendations.",
      status: finalStatus
    };
  } catch (error) {
    logger.error("Error generating custom prompt insights", { 
      error: (error as Error).message, 
      metricName, 
      promptId: customPrompt.metricName 
    });
    throw error; // Throw error to be handled by caller - NO FALLBACKS
  }
}

export async function generateMetricInsights(
  metricName: string,
  clientValue: number,
  cdAverage: number,
  industryAverage: number,
  competitorValues: number[],
  industryVertical: string,
  businessSize: string,
  clientName?: string
): Promise<MetricAnalysis> {
  const { storage } = await import("../storage");
  
  // Get custom prompt for this metric - REQUIRED, no fallbacks
  const customPrompt = await storage.getMetricPrompt(metricName);
  
  if (!customPrompt) {
    const error = `No custom prompt template found for metric: ${metricName}`;
    logger.error("Custom prompt template missing", { metricName });
    throw new Error(error);
  }
  
  if (!customPrompt.isActive) {
    const error = `Custom prompt template for ${metricName} is inactive`;
    logger.error("Custom prompt template inactive", { metricName, promptId: customPrompt.id });
    throw new Error(error);
  }
  
  logger.info('Using custom prompt template (no fallbacks)', { 
    metricName, 
    isActive: customPrompt.isActive
  });
  
  // Use custom prompt - this is the ONLY path
  return await generateInsightsWithCustomPrompt(
    customPrompt,
    metricName,
    clientValue,
    cdAverage,
    industryAverage,
    competitorValues,
    industryVertical,
    businessSize,
    clientName || 'Current Client'
  );
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
      clientInfo.businessSize,
      'Current Client' // TODO: Pass actual client name when available
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
interface InsightGenerationContext {
  client: { name: string; industryVertical: string; businessSize: string };
  period: string;
  previousPeriod: string;
  totalCompetitors: number;
  hasIndustryData: boolean;
  metrics: Array<{
    metricName: string;
    clientValue: number | null;
    trendDirection: string;
    percentageChange?: number;
    cdAverage: number | null;
    industryAverage: number | null;
    competitorValues: number[];
  }>;
}

export async function generateComprehensiveInsights(
  context: InsightGenerationContext
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
    // Get global prompt template for comprehensive insights too
    const { storage } = await import("../storage");
    const globalTemplate = await storage.getGlobalPromptTemplate();
    
    if (!globalTemplate) {
      logger.error("No global prompt template found for comprehensive insights");
      throw new Error("Global prompt template not available");
    }

    // Generate overall dashboard summary using global template
    const dashboardAnalysis = `COMPREHENSIVE DASHBOARD ANALYSIS:
Provide strategic overview across all metrics for ${context.client.name}. Assess overall digital marketing effectiveness and competitive positioning.

DASHBOARD OVERVIEW:
- Analysis Period: ${context.period} (vs. previous period ${context.previousPeriod})
- Total Competitors Tracked: ${context.totalCompetitors}
- Industry Benchmarks Available: ${context.hasIndustryData ? 'Yes' : 'No'}

KEY METRICS SUMMARY:
${context.metrics.map((m: { metricName: string; clientValue: number | null; industryAverage: number | null; cdAverage: number | null }) => `
- ${m.metricName}: ${m.clientValue || 'N/A'}
  vs. CD Avg: ${m.cdAverage || 'N/A'} | Industry: ${m.industryAverage || 'N/A'}
`).join('')}

OPTIMIZATION PRIORITIES:
Focus on strategic direction and business impact across all digital marketing channels.`;

    let summaryPrompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, dashboardAnalysis)
      .replace(/\{\{clientName\}\}/g, context.client.name)
      .replace(/\{\{industry\}\}/g, context.client.industryVertical)
      .replace(/\{\{businessSize\}\}/g, context.client.businessSize)
      .replace(/\{\{clientValue\}\}/g, 'Multi-metric Performance')
      .replace(/\{\{industryAverage\}\}/g, 'Industry Benchmarks')
      .replace(/\{\{cdPortfolioAverage\}\}/g, 'CD Portfolio Averages')
      .replace(/\{\{competitors\}\}/g, `${context.totalCompetitors} competitors tracked`)
      .replace(/\{\{metricDisplayName\}\}/g, 'Dashboard Overview');

    summaryPrompt += `\n\nProvide strategic overview in JSON format with fields: context, insight, recommendation.${FORMATTING_INSTRUCTIONS}`;

    const summaryResponse = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
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
      clientName: context.client.name,
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
 * Determine metric status based on performance vs benchmarks
 */
function determineMetricStatus(
  metricName: string,
  clientValue: any, // Changed to handle both numbers and arrays
  industryAverage?: number,
  cdPortfolioAverage?: number,
  competitorValues?: any[]
): string {
  // Handle special cases for distribution metrics (Traffic Channels, Device Distribution)
  if (metricName === 'Device Distribution' && Array.isArray(clientValue)) {
    // For Device Distribution, analyze based on desktop vs mobile balance
    const desktopData = clientValue.find((d: any) => d.device === 'Desktop');
    const mobileData = clientValue.find((d: any) => d.device === 'Mobile');
    
    if (desktopData && desktopData.percentage) {
      const desktopPercentage = desktopData.percentage;
      // Good desktop engagement: 60-90% desktop usage
      // Strong desktop dominance: >90% (could indicate mobile optimization issues)
      // Balanced usage: 50-70% desktop
      if (desktopPercentage >= 70 && desktopPercentage <= 90) {
        return 'success'; // Good desktop engagement
      } else if (desktopPercentage >= 50) {
        return 'warning'; // Balanced but could optimize
      } else {
        return 'needs_improvement'; // Mobile-heavy, may need desktop optimization
      }
    }
    return 'warning'; // Default if data structure is unexpected
  }
  
  if (metricName === 'Traffic Channels' && Array.isArray(clientValue)) {
    // For Traffic Channels, analyze based on organic search percentage
    const organicData = clientValue.find((c: any) => 
      c.channel === 'Organic Search' || c.channel === 'organic'
    );
    
    if (organicData && organicData.percentage) {
      const organicPercentage = organicData.percentage;
      // Good organic performance: >40% organic traffic
      // Excellent: >60% organic traffic
      // Needs improvement: <25% organic traffic
      if (organicPercentage >= 60) {
        return 'success';
      } else if (organicPercentage >= 40) {
        return 'warning';
      } else {
        return 'needs_improvement';
      }
    }
    return 'warning'; // Default if no organic data found
  }
  
  // Handle case where client value is null/undefined/0
  if (!clientValue || clientValue === 0) {
    return 'needs_improvement';
  }
  
  // Determine if lower is better for this metric
  const isLowerBetter = metricName.includes('Bounce Rate');
  
  // For most metrics, higher is better (Sessions per User, Pages per Session, Session Duration, etc.)
  // Only Bounce Rate is lower-is-better
  
  // Get comparison values, prioritizing industry average
  const primaryBenchmark = industryAverage || cdPortfolioAverage;
  const allCompetitorValues = competitorValues || [];
  
  if (!primaryBenchmark && allCompetitorValues.length === 0) {
    // No benchmarks available
    return 'needs_improvement';
  }
  
  // Calculate performance thresholds
  let excellent: number, good: number;
  
  if (isLowerBetter) {
    // For bounce rate: lower is better
    // Excellent: 20% better than benchmark (lower)
    // Good: 10% better than benchmark (lower)
    const benchmark = primaryBenchmark || Math.min(...allCompetitorValues);
    excellent = benchmark * 0.8; // 20% lower than benchmark
    good = benchmark * 0.9; // 10% lower than benchmark
    
    if (clientValue <= excellent) return 'success';
    if (clientValue <= good) return 'warning';
    return 'needs_improvement';
  } else {
    // For other metrics: higher is better
    const benchmark = primaryBenchmark || Math.max(...allCompetitorValues);
    excellent = benchmark * 1.2; // 20% higher than benchmark
    good = benchmark * 1.1; // 10% higher than benchmark
    
    if (clientValue >= excellent) return 'success';
    if (clientValue >= good) return 'warning';
    return 'needs_improvement';
  }
}

/**
 * Generate metric-specific insights with user-provided context
 */
export async function generateMetricSpecificInsightsWithContext(
  metricName: string,
  enrichedData: {
    metric: { clientValue: number | null };
    benchmarks?: {
      competitors?: Array<{ value: number; name: string }>;
      industryAverage?: number;
      cdPortfolioAverage?: number;
    };
    client?: { name?: string; industry?: string; businessSize?: string };
  },
  clientId: string,
  userContext: string
): Promise<any> {
  try {
    // First try to use custom prompt templates from the admin panel
    const customPrompt = await storage.getMetricPrompt(metricName);
    
    if (customPrompt && customPrompt.isActive) {
      logger.info('Using custom prompt template with user context', { 
        metricName, 
        hasUserContext: !!userContext
      });
      
      // Use the existing custom prompt system with user context appended
      const competitorValues = enrichedData.benchmarks?.competitors?.map((c: { value: number }) => c.value) || [];
      const competitorNames = enrichedData.benchmarks?.competitors?.map((c: { name: string }) => c.name) || [];
      
      return await generateInsightsWithCustomPromptAndContext(
        customPrompt,
        metricName,
        enrichedData.metric?.clientValue || 0,
        competitorValues,
        competitorNames,
        enrichedData.benchmarks?.industryAverage || 0,
        enrichedData.benchmarks?.cdPortfolioAverage || 0,
        enrichedData.client?.name || 'Client',
        enrichedData.client?.industry || 'General',
        enrichedData.client?.businessSize || 'Medium',
        userContext
      );
    }
    
    // Fallback to default generation with context if no custom prompt
    return await generateDefaultInsightsWithContext(metricName, enrichedData, userContext);
    
  } catch (error) {
    logger.error("Error in generateMetricSpecificInsightsWithContext", { 
      error: (error as Error).message,
      metricName,
      clientId
    });
    throw error;
  }
}

/**
 * Generate insights using custom prompt template with user context
 */
async function generateInsightsWithCustomPromptAndContext(
  customPrompt: { promptTemplate: string; isActive: boolean },
  metricName: string,
  clientValue: number,
  competitorValues: number[],
  competitorNames: string[],
  industryAverage: number,
  cdPortfolioAverage: number,
  clientName: string,
  industry: string,
  businessSize: string,
  userContext: string
): Promise<any> {
  try {
    // Get global prompt template
    const { storage } = await import("../storage");
    const globalTemplate = await storage.getGlobalPromptTemplate();
    
    if (!globalTemplate) {
      logger.error("No global prompt template found for context generation");
      throw new Error("Global prompt template not available");
    }

    // Build competitor string for prompt
    const competitorString = competitorNames.length > 0 
      ? competitorNames.map((name, i) => `${name}: ${competitorValues[i]}`).join(', ')
      : 'No competitor data available';

    // Merge global template with metric-specific prompt
    let processedPrompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, customPrompt.promptTemplate)
      .replace(/\{\{clientName\}\}/g, clientName || 'Current Client')
      .replace(/\{\{industry\}\}/g, industry || 'Unknown')
      .replace(/\{\{businessSize\}\}/g, businessSize || 'Unknown')
      .replace(/\{\{clientValue\}\}/g, String(clientValue))
      .replace(/\{\{industryAverage\}\}/g, String(industryAverage || 'N/A'))
      .replace(/\{\{cdPortfolioAverage\}\}/g, String(cdPortfolioAverage || 'N/A'))
      .replace(/\{\{competitors\}\}/g, competitorString)
      .replace(/\{\{metricDisplayName\}\}/g, metricName);

    // Add JSON requirement and formatting instructions
    processedPrompt += `\n\nPlease provide your response in JSON format with the required fields.${FORMATTING_INSTRUCTIONS}`;

    // Append user context to the prompt with clear instructions
    if (userContext && userContext.trim()) {
      processedPrompt += `\n\nIMPORTANT - User-provided business context:\n${userContext.trim()}\n\nPlease incorporate this specific context into your analysis and recommendations. Reference the user's situation directly in your insights.\n\nABSOLUTE REQUIREMENT: The action_plan field MUST be formatted as:\n1. First recommendation text\n2. Second recommendation text\n3. Third recommendation text\n\nDo NOT provide recommendations in paragraph format. Each recommendation must start with a number followed by a period.`;
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: processedPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 800
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    logger.info('Generated insights with custom prompt and user context', { 
      metricName,
      hasUserContext: !!userContext,
      responseFields: Object.keys(result)
    });

    // Helper function to parse nested JSON strings while preserving markdown formatting
    const parseNestedJson = (value: unknown): string => {
      if (!value) return '';
      
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (typeof parsed === 'object' && parsed !== null) {
            // Recursively extract all string values from nested objects while preserving formatting
            const extractText = (obj: any): string[] => {
              const texts: string[] = [];
              for (const val of Object.values(obj)) {
                if (typeof val === 'string') {
                  texts.push(val);
                } else if (typeof val === 'object' && val !== null) {
                  texts.push(...extractText(val));
                }
              }
              return texts;
            };
            const extractedTexts = extractText(parsed);
            // Join with proper spacing and preserve formatting
            const result = extractedTexts.join(' ').trim();
            logger.info('Parsed JSON content', { originalLength: value.length, parsedLength: result.length });
            return result;
          }
          return String(parsed);
        } catch {
          // If it's not JSON, return as-is to preserve original formatting
          return value;
        }
      }
      
      if (typeof value === 'object' && value !== null) {
        // Handle direct objects (not stringified JSON) while preserving formatting
        const extractText = (obj: any): string[] => {
          const texts: string[] = [];
          for (const val of Object.values(obj)) {
            if (typeof val === 'string') {
              texts.push(val);
            } else if (typeof val === 'object' && val !== null) {
              texts.push(...extractText(val));
            }
          }
          return texts;
        };
        const extractedTexts = extractText(value);
        return extractedTexts.join(' ').trim();
      }
      
      return String(value);
    };

    const parsedContext = parseNestedJson(result.context || result.context_analysis || result.contextAnalysis);
    const parsedInsight = parseNestedJson(result.insight || result.competitive_intelligence || result.competitiveIntelligence || result.analysis || result.insight_analysis);
    const parsedRecommendation = parseNestedJson(result.recommendation || result.action_plan || result.actionPlan || result.recommendations);

    // Debug the raw recommendation to see formatting
    logger.info('🔍 Raw recommendation debug', {
      metricName,
      rawRecommendation: result.action_plan || result.recommendation || 'NOT_FOUND',
      hasNumberedFormat: (parsedRecommendation || '').includes('1.'),
      parsedLength: parsedRecommendation?.length || 0
    });

    logger.info('✅ Content parsing results', {
      metricName,
      hasContext: !!parsedContext,
      hasInsight: !!parsedInsight,
      hasRecommendation: !!parsedRecommendation,
      contextLength: parsedContext?.length || 0,
      insightLength: parsedInsight?.length || 0,
      recommendationLength: parsedRecommendation?.length || 0
    });

    // Calculate proper status based on performance
    const calculatedStatus = determineMetricStatus(
      metricName,
      clientValue,
      industryAverage,
      cdPortfolioAverage,
      competitorValues
    );
    
    // Use AI-provided status if available and valid, otherwise use calculated status
    const finalStatus = (result.status && ['success', 'warning', 'needs_improvement'].includes(result.status)) 
      ? result.status 
      : calculatedStatus;
    
    logger.info('Status determination debug', {
      metricName,
      clientValue,
      industryAverage,
      cdPortfolioAverage,
      competitorValues,
      calculatedStatus,
      aiStatus: result.status,
      finalStatus
    });

    return {
      context: parsedContext || "Analysis in progress.",
      insight: parsedInsight || "Insights being generated.",
      recommendation: parsedRecommendation || "Recommendations will be available shortly.",
      status: finalStatus
    };

  } catch (error) {
    logger.error("Error generating insights with custom prompt and context", { 
      error: (error as Error).message,
      metricName,
      hasCustomPrompt: true
    });
    throw error;
  }
}

/**
 * Generate default insights with user context (fallback)
 */
async function generateDefaultInsightsWithContext(
  metricName: string,
  enrichedData: any,
  userContext: string
): Promise<any> {
  try {
    // Get global prompt template - this function should use the global template too
    const { storage } = await import("../storage");
    const globalTemplate = await storage.getGlobalPromptTemplate();
    
    if (!globalTemplate) {
      logger.error("No global prompt template found for default context generation");
      throw new Error("Global prompt template not available");
    }

    const competitiveContext = enrichedData.benchmarks?.competitors?.length > 0
      ? `${enrichedData.benchmarks.competitors.map((c: any) => `${c.name}: ${c.value}`).join(', ')}`
      : 'No competitor data available';

    // Use global template with fallback metric analysis
    const fallbackMetricAnalysis = `METRIC ANALYSIS:
Assess ${metricName} performance and competitive positioning. Evaluate current performance level and identify optimization opportunities.

COMPETITIVE INTELLIGENCE:
Compare performance against industry standards and competitors. Identify specific factors driving performance differences.

OPTIMIZATION PRIORITIES:
Focus on highest-impact improvements that enhance metric performance and business outcomes.`;

    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, fallbackMetricAnalysis)
      .replace(/\{\{clientName\}\}/g, enrichedData.client?.name || 'Current Client')
      .replace(/\{\{industry\}\}/g, enrichedData.client?.industry || 'Unknown')
      .replace(/\{\{businessSize\}\}/g, enrichedData.client?.businessSize || 'Unknown')
      .replace(/\{\{clientValue\}\}/g, String(enrichedData.metric.clientValue))
      .replace(/\{\{industryAverage\}\}/g, String(enrichedData.benchmarks?.industryAverage || 'N/A'))
      .replace(/\{\{cdPortfolioAverage\}\}/g, String(enrichedData.benchmarks?.cdPortfolioAverage || 'N/A'))
      .replace(/\{\{competitors\}\}/g, competitiveContext)
      .replace(/\{\{metricDisplayName\}\}/g, metricName);

    // Add JSON requirement
    prompt += `\n\nProvide analysis in JSON format with fields: context, insight, recommendation, status.${FORMATTING_INSTRUCTIONS}`;

    // Append user context if provided with formatting reminder
    if (userContext && userContext.trim()) {
      prompt += `\n\nUser-provided context:\n${userContext.trim()}\n\nREMINDER: Format all recommendations as numbered lists (1. 2. 3.) - do NOT use paragraph format.`;
    }

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 600
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      context: result.context || "Metric analysis in progress.",
      insight: result.insight || "Insights being generated.",
      recommendation: result.recommendation || "Recommendations will be available shortly.",
      status: result.status || 'needs_improvement'
    };

  } catch (error) {
    logger.error("Error generating default insights with context", { 
      error: (error as Error).message,
      metricName
    });
    throw error;
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
    // Get global prompt template for enhanced insights too
    const { storage } = await import("../storage");
    const globalTemplate = await storage.getGlobalPromptTemplate();
    
    if (!globalTemplate) {
      logger.error("No global prompt template found for enhanced metric insights");
      throw new Error("Global prompt template not available");
    }

    const trendText = metric.percentageChange 
      ? `${metric.trendDirection} ${Math.abs(metric.percentageChange).toFixed(1)}% from last period`
      : `${metric.trendDirection} trend`;

    const competitiveContext = metric.competitorValues.length > 0
      ? `${metric.competitorNames.map((name: string, i: number) => `${name}: ${metric.competitorValues[i]}`).join(', ')}`
      : 'No competitor data available';

    // Enhanced metric analysis for comprehensive insights
    const enhancedMetricAnalysis = `ENHANCED METRIC ANALYSIS:
Provide comprehensive analysis of ${metric.metricName} performance with trend analysis and competitive intelligence.

METRIC PERFORMANCE:
- ${metric.metricName}: ${metric.clientValue} (${trendText})
- Previous Period: ${metric.previousPeriodValue || 'N/A'}
- Clear Digital Average: ${metric.cdAverage || 'N/A'}
- Industry Average: ${metric.industryAverage || 'N/A'}

COMPETITIVE LANDSCAPE:
${metric.competitorNames.length > 0 ? 
  metric.competitorNames.map((name: string, i: number) => 
    `- ${name}: ${metric.competitorValues[i]}`
  ).join('\n') : 
  'No competitor data available'
}

TREND ANALYSIS & OPTIMIZATION:
Focus on trend implications, competitive positioning, and strategic optimization opportunities.`;

    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, enhancedMetricAnalysis)
      .replace(/\{\{clientName\}\}/g, context.client.name)
      .replace(/\{\{industry\}\}/g, context.client.industryVertical)
      .replace(/\{\{businessSize\}\}/g, context.client.businessSize)
      .replace(/\{\{clientValue\}\}/g, String(metric.clientValue))
      .replace(/\{\{industryAverage\}\}/g, String(metric.industryAverage || 'N/A'))
      .replace(/\{\{cdPortfolioAverage\}\}/g, String(metric.cdAverage || 'N/A'))
      .replace(/\{\{competitors\}\}/g, competitiveContext)
      .replace(/\{\{metricDisplayName\}\}/g, metric.metricName);

    prompt += `\n\nProvide analysis in JSON format with fields: context, insight, recommendation.${FORMATTING_INSTRUCTIONS}`;

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
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
export async function generateMetricSpecificInsights(
  metricName: string, 
  enrichedData: {
    metric?: { clientValue: number };
    benchmarks?: {
      competitors?: Array<{ value: number; name: string }>;
      industryAverage?: number;
      cdPortfolioAverage?: number;
    };
    client?: { name?: string; industry?: string; businessSize?: string };
  }, 
  clientId: string
) {
  logger.info('🚀 STARTING AI INSIGHT GENERATION', { 
    metricName, 
    clientId,
    hasMetric: !!enrichedData.metric,
    hasBenchmarks: !!enrichedData.benchmarks,
    hasClient: !!enrichedData.client
  });

  const { storage } = await import("../storage");
  
  // First try to use custom prompt templates from the admin panel
  try {
    const customPrompt = await storage.getMetricPrompt(metricName);
    
    logger.info('🎯 CUSTOM PROMPT LOOKUP', { 
      metricName, 
      promptExists: !!customPrompt,
      isActive: customPrompt?.isActive,
      promptId: customPrompt?.id
    });
    
    if (customPrompt && customPrompt.isActive) {
      logger.info('Using custom prompt template', { 
        metricName, 
        promptPreview: customPrompt.promptTemplate.substring(0, 150) + '...'
      });
      
      // Use the existing custom prompt system with the enhanced data
      const competitorValues = enrichedData.benchmarks?.competitors?.map((c: { value: number }) => c.value) || [];
      const competitorNames = enrichedData.benchmarks?.competitors?.map((c: { name: string }) => c.name) || [];
      
      logger.info('Calling generateInsightsWithCustomPrompt', {
        metricName,
        clientValue: enrichedData.metric?.clientValue,
        cdAverage: enrichedData.benchmarks?.cdPortfolioAverage,
        industryAverage: enrichedData.benchmarks?.industryAverage,
        competitorCount: competitorValues.length
      });
      
      const result = await generateInsightsWithCustomPrompt(
        customPrompt,
        metricName,
        enrichedData.metric?.clientValue || 0,
        enrichedData.benchmarks?.cdPortfolioAverage || 0,
        enrichedData.benchmarks?.industryAverage || 0,
        competitorValues,
        enrichedData.client?.industry || 'Technology',
        enrichedData.client?.businessSize || 'Medium Business',
        enrichedData.client?.name || 'Current Client',
        competitorNames
      );
      
      logger.info('AI insight generated successfully', {
        metricName,
        hasContext: !!result.context,
        hasInsight: !!result.insight,
        hasRecommendation: !!result.recommendation,
        status: result.status
      });
      
      return result;
    } else {
      logger.warn('❌ NO ACTIVE CUSTOM PROMPT FOUND', { 
        metricName, 
        customPromptExists: !!customPrompt,
        isActive: customPrompt?.isActive 
      });
    }
  } catch (error) {
    logger.error("❌ FAILED TO USE CUSTOM PROMPT", { 
      metricName, 
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    throw error; // Don't use fallback, throw the error
  }
  
  // Use global template for fallback instead of hardcoded prompts
  logger.warn('⚠️ USING GLOBAL TEMPLATE FALLBACK (NO CUSTOM PROMPT FOUND)', { metricName });
  
  // Get global prompt template for fallback too
  const globalTemplate = await storage.getGlobalPromptTemplate();
  
  if (!globalTemplate) {
    logger.error("No global prompt template found for generateMetricSpecificInsights fallback");
    throw new Error("Global prompt template not available");
  }

  // Use generateDefaultInsightsWithContext which already has global template integration
  return await generateDefaultInsightsWithContext(metricName, enrichedData, '');

  // Alternative: if we wanted to build this fallback inline, we'd use global template:
  /*
  const fallbackAnalysis = `LEGACY FALLBACK ANALYSIS:
Provide analysis for ${metricName} when no custom prompt template is available. Assess performance, competitive positioning, and optimization opportunities.`;

  const competitorValues = enrichedData.benchmarks?.competitors?.map((c: any) => c.value) || [];
  const competitorNames = enrichedData.benchmarks?.competitors?.map((c: any) => c.name) || [];
  
  const prompt = globalTemplate.promptTemplate
    .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, fallbackAnalysis)
    .replace(/\{\{clientName\}\}/g, enrichedData.client?.name || 'Current Client')
    .replace(/\{\{industry\}\}/g, enrichedData.client?.industry || 'Unknown')
    .replace(/\{\{businessSize\}\}/g, enrichedData.client?.businessSize || 'Unknown')
    .replace(/\{\{clientValue\}\}/g, String(enrichedData.metric?.clientValue))
    .replace(/\{\{industryAverage\}\}/g, String(enrichedData.benchmarks?.industryAverage || 'N/A'))
    .replace(/\{\{cdPortfolioAverage\}\}/g, String(enrichedData.benchmarks?.cdPortfolioAverage || 'N/A'))
    .replace(/\{\{competitors\}\}/g, competitorNames.map((name, i) => `${name}: ${competitorValues[i]}`).join(', ') || 'No competitor data')
    .replace(/\{\{metricDisplayName\}\}/g, metricName);

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "user",
        content: prompt + `\n\nProvide JSON response with fields: context, insights, recommendations.${FORMATTING_INSTRUCTIONS}`
      }
    ],*/
}
