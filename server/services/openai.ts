import OpenAI from "openai";
import logger from "../utils/logging/logger";
import { storage } from "../storage";
import type { MetricPrompt } from "@shared/schema";

/**
 * Centralized formatting & schema instructions that must be appended LAST.
 * If earlier instructions conflict, these win.
 */
const FORMATTING_INSTRUCTIONS = `

FINAL / OVERRIDING INSTRUCTIONS (win on conflict):
- Respond as **valid JSON** only (no prose outside JSON).
- Use **bold text** for key metrics, percentages, and critical insights.
- The "recommendation" field must be a SINGLE STRING containing numbered recommendations with line breaks like this format:
"1. First recommendation text\\n2. Second recommendation text\\n3. Third recommendation text"
- Bold important phrases like **notable advantage**, **meaningful improvement**, **competitive positioning**.
- Do NOT bold random words, company names, or first words of sentences.
- Do NOT provide recommendations as an array or in paragraph format.
` as const;

// To switch models, set OPENAI_MODEL in .env (e.g., OPENAI_MODEL=gpt-5)
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/** Normalize OpenAI completion options so the same call works across models. */
function normalizeCompletionOptions<T extends Record<string, any>>(
  opts: T,
  model: string,
): T {
  const out: any = { ...opts };
  const isGpt5 = model.toLowerCase().startsWith("gpt-5");
  
  if (isGpt5) {
    // GPT-5 requires max_completion_tokens instead of max_tokens
    if (typeof out.max_tokens === "number") {
      out.max_completion_tokens = out.max_tokens;
      delete out.max_tokens;

      if (process.env.NODE_ENV !== "production") {
        logger.debug(
          `Translated max_tokens → max_completion_tokens for model ${model} (value=${out.max_completion_tokens})`
        );
      }
    }

    // GPT-5 does not allow explicit temperature settings - only supports default temperature: 1
    if (typeof out.temperature === "number") {
      delete out.temperature;

      if (process.env.NODE_ENV !== "production") {
        logger.debug(
          `Removed temperature parameter for model ${model} (GPT-5 only supports default temperature: 1)`
        );
      }
    }
  }
  
  return out as T;
}

// ---------- Types ----------
export interface MetricAnalysis {
  context: string;
  insight: string;
  recommendation: string;
  status: "success" | "needs_improvement" | "warning";
}

export interface DeviceDistribution {
  device: string;
  percentage: number;
  sessions?: number;
}

export interface TrafficChannel {
  channel: string;
  percentage: number;
}

type MetricValue = number | DeviceDistribution[] | TrafficChannel[];

/** Kinds make branching explicit and type-safe */
type MetricKind =
  | "numeric" // generic numeric (higher is better)
  | "duration_seconds" // numeric seconds displayed as mm:ss
  | "percentage" // numeric 0-100
  | "device_distribution" // array of DeviceDistribution
  | "traffic_channels"; // array of TrafficChannel

function getMetricKind(metricName: string): MetricKind {
  switch (metricName) {
    case "Session Duration":
      return "duration_seconds";
    case "Bounce Rate":
    case "Conversion Rate":
    case "Click-Through Rate":
    case "Exit Rate":
      return "percentage";
    case "Device Distribution":
      return "device_distribution";
    case "Traffic Channels":
      return "traffic_channels";
    default:
      return "numeric";
  }
}

// ---------- Prompt helpers ----------
function appendJsonContract(base: string, extraStatusRules?: boolean): string {
  const statusGuidelines = extraStatusRules
    ? `\n\nSTATUS ASSESSMENT GUIDELINES:\n- "success": Performance is strong/above average versus industry/competitors (green)\n- "needs_improvement": Average/slightly below with clear opportunities (orange)\n- "warning": Significantly below benchmarks; urgent attention (red)`
    : "";

  return (
    base +
    `\n\nIMPORTANT: Provide your response as JSON with exactly these fields:\n- "context": Narrative context (use **bold** for key insights)\n- "insight": Competitive intelligence (use **bold** for critical findings)\n- "recommendation": Action plan formatted exactly as:\n1. First recommendation\n2. Second recommendation\n3. Third recommendation\n- "status": One of "success" | "needs_improvement" | "warning"` +
    statusGuidelines +
    FORMATTING_INSTRUCTIONS
  );
}

// Preserve newlines when flattening nested JSON-like strings.
function parseNestedText(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        const parts: string[] = [];
        const walk = (obj: any) => {
          for (const v of Object.values(obj)) {
            if (typeof v === "string") parts.push(v);
            else if (v && typeof v === "object") walk(v);
          }
        };
        walk(parsed);
        return parts.join("\n").trim();
      }
    } catch {
      // not JSON, return as-is
    }
    return value;
  }

  if (typeof value === "object") {
    const parts: string[] = [];
    const walk = (obj: any) => {
      for (const v of Object.values(obj)) {
        if (typeof v === "string") parts.push(v);
        else if (v && typeof v === "object") walk(v);
      }
    };
    walk(value as any);
    return parts.join("\n").trim();
  }

  return String(value);
}

// ---------- Core formatting for values ----------
function fmtDeviceDistribution(list: DeviceDistribution[]): string {
  return list
    .map((d) =>
      d.sessions != null
        ? `${d.device}: ${d.percentage}% (${d.sessions} sessions)`
        : `${d.device}: ${d.percentage}%`,
    )
    .join(", ");
}

function fmtTrafficChannels(list: TrafficChannel[]): string {
  return list.map((c) => `${c.channel}: ${c.percentage}%`).join(", ");
}

function formatClientValue(metricName: string, value: MetricValue): string {
  const kind = getMetricKind(metricName);
  if (kind === "device_distribution" && Array.isArray(value))
    return fmtDeviceDistribution(value as DeviceDistribution[]);
  if (kind === "traffic_channels" && Array.isArray(value))
    return fmtTrafficChannels(value as TrafficChannel[]);
  if (kind === "duration_seconds" && typeof value === "number") {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return `${value} seconds (${minutes}m ${seconds}s)`;
  }
  return String(value);
}

// ---------- Status determination ----------
function determineMetricStatus(
  metricName: string,
  clientValue: MetricValue,
  industryAverage?: number,
  cdPortfolioAverage?: number,
  competitorValues?: Array<number | DeviceDistribution[] | TrafficChannel[]>,
): "success" | "needs_improvement" | "warning" {
  const kind = getMetricKind(metricName);

  // No data
  if (
    clientValue == null ||
    (typeof clientValue === "number" && Number.isNaN(clientValue)) ||
    (Array.isArray(clientValue) && clientValue.length === 0)
  ) {
    return "warning"; // missing/insufficient data
  }

  // Device mix heuristic (keep light; ideally driven by benchmarks)
  if (kind === "device_distribution" && Array.isArray(clientValue)) {
    const desktop = (clientValue as DeviceDistribution[]).find(
      (d) => d.device === "Desktop",
    );
    if (desktop && typeof desktop.percentage === "number") {
      if (desktop.percentage >= 70 && desktop.percentage <= 90)
        return "success";
      if (desktop.percentage >= 50) return "warning";
      return "needs_improvement";
    }
    return "warning";
  }

  // Organic share heuristic
  if (kind === "traffic_channels" && Array.isArray(clientValue)) {
    const organic = (clientValue as TrafficChannel[]).find((c) =>
      /^(organic|organic search)$/i.test(c.channel),
    );
    if (organic) {
      if (organic.percentage >= 60) return "success";
      if (organic.percentage >= 40) return "warning";
      return "needs_improvement";
    }
    return "warning";
  }

  // Generic numeric (and percentage/duration treated as numeric vs benchmark)
  if (typeof clientValue === "number") {
    const isLowerBetter = metricName.includes("Bounce Rate");
    const comp =
      competitorValues?.filter((v): v is number => typeof v === "number") ?? [];
    const primary = industryAverage ?? cdPortfolioAverage;

    if (primary == null && comp.length === 0) return "needs_improvement"; // no benchmark

    if (isLowerBetter) {
      const benchmark =
        primary ?? (comp.length ? Math.min(...comp) : clientValue);
      if (clientValue <= benchmark * 0.8) return "success";
      if (clientValue <= benchmark * 0.9) return "warning";
      return "needs_improvement";
    } else {
      const benchmark =
        primary ?? (comp.length ? Math.max(...comp) : clientValue);
      if (clientValue >= benchmark * 1.2) return "success";
      if (clientValue >= benchmark * 1.1) return "warning";
      return "needs_improvement";
    }
  }

  return "warning"; // default conservative
}

// ---------- Core generators ----------
async function generateInsightsWithCustomPrompt(
  customPrompt: MetricPrompt,
  metricName: string,
  clientValue: MetricValue,
  cdAverage: number,
  industryAverage: number,
  competitorValues: Array<number | DeviceDistribution[] | TrafficChannel[]>,
  industryVertical: string,
  businessSize: string,
  clientName: string,
  competitorNames?: string[],
): Promise<MetricAnalysis> {
  try {
    const globalTemplate = await storage.getGlobalPromptTemplate();
    if (!globalTemplate) {
      logger.error("No global prompt template found");
      throw new Error("Global prompt template not available");
    }

    // Competitors block (support arrays for specific kinds)
    const kind = getMetricKind(metricName);
    const competitorsText =
      competitorValues && competitorValues.length
        ? competitorValues
            .map((val, idx) => {
              const name = competitorNames?.[idx] ?? `Competitor ${idx + 1}`;
              if (kind === "device_distribution" && Array.isArray(val)) {
                return `${name}: ${fmtDeviceDistribution(val as DeviceDistribution[])}`;
              }
              if (kind === "traffic_channels" && Array.isArray(val)) {
                return `${name}: ${fmtTrafficChannels(val as TrafficChannel[])}`;
              }
              return `${name}: ${val}`;
            })
            .join("; ")
        : "No competitor data available";

    // Format client & benchmarks
    let formattedClientValue = formatClientValue(metricName, clientValue);
    let formattedCdAverage = String(cdAverage);
    let formattedIndustryAverage = String(industryAverage);
    let formattedCompetitorsText = competitorsText;

    if (getMetricKind(metricName) === "duration_seconds") {
      const numClient = typeof clientValue === "number" ? clientValue : 0;
      const cm = Math.floor(numClient / 60),
        cs = Math.round(numClient % 60);
      const cdm = Math.floor(cdAverage / 60),
        cds = Math.round(cdAverage % 60);
      const im = Math.floor(industryAverage / 60),
        is = Math.round(industryAverage % 60);
      formattedClientValue = `${numClient} seconds (${cm}m ${cs}s)`;
      formattedCdAverage = `${cdAverage} seconds (${cdm}m ${cds}s)`;
      formattedIndustryAverage = `${industryAverage} seconds (${im}m ${is}s)`;

      if (competitorValues?.length) {
        formattedCompetitorsText = competitorValues
          .map((v, idx) => {
            const name = competitorNames?.[idx] ?? `Competitor ${idx + 1}`;
            const n = typeof v === "number" ? v : 0;
            const m = Math.floor(n / 60),
              s = Math.round(n % 60);
            return `${name}: ${n} seconds (${m}m ${s}s)`;
          })
          .join(", ");
      }
    }

    // Merge template
    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, customPrompt.promptTemplate)
      .replace(/\{\{clientName\}\}/g, clientName || "Current Client")
      .replace(/\{\{industry\}\}/g, industryVertical)
      .replace(/\{\{businessSize\}\}/g, businessSize)
      .replace(/\{\{clientValue\}\}/g, formattedClientValue)
      .replace(/\{\{industryAverage\}\}/g, formattedIndustryAverage)
      .replace(/\{\{cdPortfolioAverage\}\}/g, formattedCdAverage)
      .replace(/\{\{competitors\}\}/g, formattedCompetitorsText)
      .replace(/\{\{metricDisplayName\}\}/g, metricName);

    prompt = appendJsonContract(prompt, true);

    const baseOpts = {
      response_format: { type: "json_object" } as const,
      temperature: 0.7,
      max_tokens: 600,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const compatOpts = normalizeCompletionOptions(baseOpts, OPENAI_MODEL);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      ...compatOpts,
    });

    let json: any;
    try {
      json = JSON.parse(response.choices[0].message.content || "{}");
    } catch (e) {
      logger.error("Failed to parse OpenAI response JSON", {
        error: (e as Error).message,
        responseContent: response.choices[0].message.content,
        metricName,
        customPromptId: (customPrompt as any).metricName,
      });
      return {
        context:
          "Unable to generate context analysis due to response format error.",
        insight: "Unable to generate insights due to response format error.",
        recommendation:
          "1. Please try regenerating insights\n2. Contact support if the issue persists\n3. Review metric data for any unusual formatting",
        status: "warning",
      };
    }

    const calculatedStatus = determineMetricStatus(
      metricName,
      clientValue,
      industryAverage,
      cdAverage,
      competitorValues,
    );

    const finalStatus =
      json.status &&
      ["success", "warning", "needs_improvement"].includes(json.status)
        ? (json.status as MetricAnalysis["status"])
        : calculatedStatus;

    return {
      context: json.context || "Unable to generate context analysis.",
      insight: json.insight || "Unable to generate insights.",
      recommendation:
        json.recommendation || "Unable to generate recommendations.",
      status: finalStatus,
    };
  } catch (error) {
    logger.error("Error generating custom prompt insights", {
      error: (error as Error).message,
      metricName,
      promptId: (customPrompt as any).metricName,
    });
    throw error; // public fn chooses to throw; callers decide policy
  }
}

// ---------- Public APIs ----------
export async function generateMetricInsights(
  metricName: string,
  clientValue: number,
  cdAverage: number,
  industryAverage: number,
  competitorValues: number[],
  industryVertical: string,
  businessSize: string,
  clientName?: string,
): Promise<MetricAnalysis> {
  // Strict path: requires active custom prompt; throws on absence/inactive
  const customPrompt = await storage.getMetricPrompt(metricName);
  if (!customPrompt) {
    const error = `No custom prompt template found for metric: ${metricName}`;
    logger.error("Custom prompt template missing", { metricName });
    throw new Error(error);
  }
  if (!customPrompt.isActive) {
    const error = `Custom prompt template for ${metricName} is inactive`;
    logger.error("Custom prompt template inactive", {
      metricName,
      promptId: customPrompt.id,
    });
    throw new Error(error);
  }

  logger.info("Using custom prompt template (no fallbacks)", {
    metricName,
    isActive: customPrompt.isActive,
  });

  return generateInsightsWithCustomPrompt(
    customPrompt,
    metricName,
    clientValue,
    cdAverage,
    industryAverage,
    competitorValues,
    industryVertical,
    businessSize,
    clientName || "Current Client",
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
  clientInfo: { industryVertical: string; businessSize: string },
): Promise<
  Array<{
    metricName: string;
    context: string;
    insight: string;
    recommendation: string;
  }>
> {
  // Run with small concurrency to improve throughput without hammering
  const limit = 4;
  const out: Array<{
    metricName: string;
    context: string;
    insight: string;
    recommendation: string;
  }> = [];
  let i = 0;

  while (i < metricsData.length) {
    const batch = metricsData.slice(i, i + limit);
    // Execute in parallel per batch
    const res = await Promise.all(
      batch.map(async (metric) => {
        try {
          const analysis = await generateMetricInsights(
            metric.metricName,
            metric.clientValue,
            metric.cdAverage,
            metric.industryAverage,
            metric.competitorValues,
            clientInfo.industryVertical,
            clientInfo.businessSize,
            "Current Client",
          );
          return { metricName: metric.metricName, ...analysis };
        } catch (e) {
          logger.error("Bulk insight error", {
            metricName: metric.metricName,
            error: (e as Error).message,
          });
          return {
            metricName: metric.metricName,
            context: "Unable to generate analysis for this metric.",
            insight: "Error during generation.",
            recommendation:
              "1. Retry later\n2. Verify prompt configuration\n3. Check metric inputs",
          };
        }
      }),
    );
    out.push(...res);
    i += limit;
  }

  return out;
}

// ---------- Comprehensive Insights ----------
export interface InsightGenerationContext {
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
    competitorValues: number[]; // numeric competitors here
    competitorNames?: string[]; // added to match usage
    previousPeriodValue?: number; // added to match usage
  }>;
}

export async function generateComprehensiveInsights(
  context: InsightGenerationContext,
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
    const globalTemplate = await storage.getGlobalPromptTemplate();
    if (!globalTemplate) {
      logger.error(
        "No global prompt template found for comprehensive insights",
      );
      throw new Error("Global prompt template not available");
    }

    const dashboardAnalysis = `COMPREHENSIVE DASHBOARD ANALYSIS:\nProvide strategic overview across all metrics for ${context.client.name}. Assess overall digital marketing effectiveness and competitive positioning.\n\nDASHBOARD OVERVIEW:\n- Analysis Period: ${context.period} (vs. ${context.previousPeriod})\n- Total Competitors Tracked: ${context.totalCompetitors}\n- Industry Benchmarks Available: ${context.hasIndustryData ? "Yes" : "No"}\n\nKEY METRICS SUMMARY:\n${context.metrics
      .map(
        (m) =>
          `- ${m.metricName}: ${m.clientValue ?? "N/A"}\n  vs. CD Avg: ${m.cdAverage ?? "N/A"} | Industry: ${m.industryAverage ?? "N/A"}`,
      )
      .join(
        "\n",
      )}\n\nOPTIMIZATION PRIORITIES:\nFocus on strategic direction and business impact across all digital marketing channels.`;

    let summaryPrompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, dashboardAnalysis)
      .replace(/\{\{clientName\}\}/g, context.client.name)
      .replace(/\{\{industry\}\}/g, context.client.industryVertical)
      .replace(/\{\{businessSize\}\}/g, context.client.businessSize)
      .replace(/\{\{clientValue\}\}/g, "Multi-metric Performance")
      .replace(/\{\{industryAverage\}\}/g, "Industry Benchmarks")
      .replace(/\{\{cdPortfolioAverage\}\}/g, "CD Portfolio Averages")
      .replace(
        /\{\{competitors\}\}/g,
        `${context.totalCompetitors} competitors tracked`,
      )
      .replace(/\{\{metricDisplayName\}\}/g, "Dashboard Overview");

    summaryPrompt = appendJsonContract(summaryPrompt);

    const summaryBaseOpts = {
      response_format: { type: "json_object" } as const,
      temperature: 0.7,
      max_tokens: 600,
      messages: [{ role: "user" as const, content: summaryPrompt }],
    };
    const summaryCompatOpts = normalizeCompletionOptions(
      summaryBaseOpts,
      OPENAI_MODEL,
    );
    const summaryResponse = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      ...summaryCompatOpts,
    });
    const summaryResult = JSON.parse(
      summaryResponse.choices[0].message.content || "{}",
    );

    // Per-metric (small concurrency)
    const limit = 5;
    const metricInsights: Array<{
      metricName: string;
      context: string;
      insight: string;
      recommendation: string;
    }> = [];
    let idx = 0;
    while (idx < context.metrics.length) {
      const slice = context.metrics.slice(idx, idx + limit);
      const res = await Promise.all(
        slice.map((m) =>
          m.clientValue == null
            ? null
            : generateEnhancedMetricInsights(m, context),
        ),
      );
      res.forEach((r, i2) => {
        if (r) metricInsights.push({ metricName: slice[i2]!.metricName, ...r });
      });
      idx += limit;
    }

    return {
      dashboardSummary: {
        context: summaryResult.context || "Dashboard analysis in progress.",
        insight: summaryResult.insight || "Strategic insights being generated.",
        recommendation:
          summaryResult.recommendation ||
          "1. Prioritize quick wins\n2. Address core gaps\n3. Leverage competitive strengths",
      },
      metricInsights,
    };
  } catch (error) {
    logger.error("Error generating comprehensive insights", {
      error: (error as Error).message,
      clientName: context.client.name,
      period: context.period,
    });

    return {
      dashboardSummary: {
        context: "Unable to generate comprehensive analysis at this time.",
        insight: "Please try again or contact support for assistance.",
        recommendation:
          "1. Monitor key metrics\n2. Validate data sources\n3. Retry insights generation",
      },
      metricInsights: [],
    };
  }
}

// ---------- Enhanced metric insights ----------
async function generateEnhancedMetricInsights(
  metric: {
    metricName: string;
    clientValue: number | null;
    trendDirection: string;
    percentageChange?: number;
    cdAverage: number | null;
    industryAverage: number | null;
    competitorValues: number[];
    competitorNames?: string[];
    previousPeriodValue?: number;
  },
  context: InsightGenerationContext,
): Promise<{ context: string; insight: string; recommendation: string }> {
  try {
    const globalTemplate = await storage.getGlobalPromptTemplate();
    if (!globalTemplate) {
      logger.error(
        "No global prompt template found for enhanced metric insights",
      );
      throw new Error("Global prompt template not available");
    }

    const trendText =
      metric.percentageChange != null
        ? `${metric.trendDirection} ${Math.abs(metric.percentageChange).toFixed(1)}% from last period`
        : `${metric.trendDirection} trend`;

    const competitiveContext = metric.competitorNames?.length
      ? metric.competitorNames
          .map((name, i) => `${name}: ${metric.competitorValues[i]}`)
          .join(", ")
      : metric.competitorValues.length
        ? metric.competitorValues
            .map((v, i) => `Competitor ${i + 1}: ${v}`)
            .join(", ")
        : "No competitor data available";

    const enhancedMetricAnalysis = `ENHANCED METRIC ANALYSIS:\nProvide comprehensive analysis of ${metric.metricName} performance with trend analysis and competitive intelligence.\n\nMETRIC PERFORMANCE:\n- ${metric.metricName}: ${metric.clientValue} (${trendText})\n- Previous Period: ${metric.previousPeriodValue ?? "N/A"}\n- Clear Digital Average: ${metric.cdAverage ?? "N/A"}\n- Industry Average: ${metric.industryAverage ?? "N/A"}\n\nCOMPETITIVE LANDSCAPE:\n${competitiveContext}\n\nTREND ANALYSIS & OPTIMIZATION:\nFocus on trend implications, competitive positioning, and strategic optimization opportunities.`;

    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, enhancedMetricAnalysis)
      .replace(/\{\{clientName\}\}/g, context.client.name)
      .replace(/\{\{industry\}\}/g, context.client.industryVertical)
      .replace(/\{\{businessSize\}\}/g, context.client.businessSize)
      .replace(/\{\{clientValue\}\}/g, String(metric.clientValue))
      .replace(
        /\{\{industryAverage\}\}/g,
        String(metric.industryAverage ?? "N/A"),
      )
      .replace(/\{\{cdPortfolioAverage\}\}/g, String(metric.cdAverage ?? "N/A"))
      .replace(/\{\{competitors\}\}/g, competitiveContext)
      .replace(/\{\{metricDisplayName\}\}/g, metric.metricName);

    prompt = appendJsonContract(prompt);

    const baseOpts = {
      response_format: { type: "json_object" } as const,
      temperature: 0.7,
      max_tokens: 400,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const compatOpts = normalizeCompletionOptions(baseOpts, OPENAI_MODEL);
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      ...compatOpts,
    });
    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      context:
        parseNestedText(result.context) || "Metric analysis in progress.",
      insight: parseNestedText(result.insight) || "Insights being generated.",
      recommendation:
        parseNestedText(result.recommendation) ||
        "1. Prioritize quick wins\n2. Address core gaps\n3. Leverage strengths",
    };
  } catch (error) {
    logger.error("Error generating enhanced metric insights", {
      error: (error as Error).message,
      metricName: metric.metricName,
    });
    return {
      context: "Unable to analyze this metric at the moment.",
      insight: "Analysis temporarily unavailable.",
      recommendation:
        "1. Monitor this metric\n2. Validate data\n3. Retry analysis",
    };
  }
}

// ---------- Context-aware generation (custom or default) ----------
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
  userContext: string,
): Promise<MetricAnalysis> {
  try {
    const customPrompt = await storage.getMetricPrompt(metricName);

    if (customPrompt && customPrompt.isActive) {
      logger.info("Using custom prompt template with user context", {
        metricName,
        hasUserContext: !!userContext,
      });

      const competitorValues =
        enrichedData.benchmarks?.competitors?.map((c) => c.value) || [];
      const competitorNames =
        enrichedData.benchmarks?.competitors?.map((c) => c.name) || [];

      return generateInsightsWithCustomPromptAndContext(
        customPrompt,
        metricName,
        enrichedData.metric?.clientValue ?? 0,
        competitorValues,
        competitorNames,
        enrichedData.benchmarks?.industryAverage ?? 0,
        enrichedData.benchmarks?.cdPortfolioAverage ?? 0,
        enrichedData.client?.name || "Client",
        enrichedData.client?.industry || "General",
        enrichedData.client?.businessSize || "Medium",
        userContext,
      );
    }

    return generateDefaultInsightsWithContext(
      metricName,
      enrichedData,
      userContext,
    );
  } catch (error) {
    logger.error("Error in generateMetricSpecificInsightsWithContext", {
      error: (error as Error).message,
      metricName,
      clientId,
    });
    // graceful fallback
    return {
      context: "Unable to generate analysis with context.",
      insight: "Contextual generation failed.",
      recommendation:
        "1. Retry later\n2. Check prompt settings\n3. Verify inputs",
      status: "warning",
    };
  }
}

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
  userContext: string,
): Promise<MetricAnalysis> {
  try {
    const globalTemplate = await storage.getGlobalPromptTemplate();
    if (!globalTemplate) {
      logger.error("No global prompt template found for context generation");
      throw new Error("Global prompt template not available");
    }

    const competitorString = competitorNames.length
      ? competitorNames
          .map((name, i) => `${name}: ${competitorValues[i]}`)
          .join(", ")
      : "No competitor data available";

    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, customPrompt.promptTemplate)
      .replace(/\{\{clientName\}\}/g, clientName || "Current Client")
      .replace(/\{\{industry\}\}/g, industry || "Unknown")
      .replace(/\{\{businessSize\}\}/g, businessSize || "Unknown")
      .replace(/\{\{clientValue\}\}/g, String(clientValue))
      .replace(/\{\{industryAverage\}\}/g, String(industryAverage || "N/A"))
      .replace(
        /\{\{cdPortfolioAverage\}\}/g,
        String(cdPortfolioAverage || "N/A"),
      )
      .replace(/\{\{competitors\}\}/g, competitorString)
      .replace(/\{\{metricDisplayName\}\}/g, metricName);

    // Append user context with explicit fence, then JSON contract
    if (userContext && userContext.trim()) {
      prompt += `\n\n[USER-CONTEXT]\n${userContext.trim()}\n[/USER-CONTEXT]\n`;
    }
    prompt = appendJsonContract(prompt, true);

    const baseOpts = {
      response_format: { type: "json_object" } as const,
      temperature: 0.7,
      max_tokens: 800,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const compatOpts = normalizeCompletionOptions(baseOpts, OPENAI_MODEL);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      ...compatOpts,
    });
    const result = JSON.parse(response.choices[0].message.content || "{}");

    const calculatedStatus = determineMetricStatus(
      metricName,
      clientValue,
      industryAverage,
      cdPortfolioAverage,
      competitorValues,
    );

    const finalStatus =
      result.status &&
      ["success", "warning", "needs_improvement"].includes(result.status)
        ? (result.status as MetricAnalysis["status"])
        : calculatedStatus;

    const contextText = parseNestedText(
      result.context || result.context_analysis || result.contextAnalysis,
    );
    const insightText = parseNestedText(
      result.insight ||
        result.competitive_intelligence ||
        result.competitiveIntelligence ||
        result.analysis ||
        result.insight_analysis,
    );
    const recText = parseNestedText(
      result.recommendation ||
        result.action_plan ||
        result.actionPlan ||
        result.recommendations,
    );

    return {
      context: contextText || "Analysis in progress.",
      insight: insightText || "Insights being generated.",
      recommendation:
        recText ||
        "1. Prioritize quick wins\n2. Address core gaps\n3. Leverage strengths",
      status: finalStatus,
    };
  } catch (error) {
    logger.error("Error generating insights with custom prompt and context", {
      error: (error as Error).message,
      metricName,
      hasCustomPrompt: true,
    });
    return {
      context: "Unable to generate insights with context at this time.",
      insight: "Please retry contextual analysis.",
      recommendation:
        "1. Retry later\n2. Validate prompt configuration\n3. Check inputs",
      status: "warning",
    };
  }
}

async function generateDefaultInsightsWithContext(
  metricName: string,
  enrichedData: any,
  userContext: string,
): Promise<MetricAnalysis> {
  try {
    const globalTemplate = await storage.getGlobalPromptTemplate();
    if (!globalTemplate) {
      logger.error(
        "No global prompt template found for default context generation",
      );
      throw new Error("Global prompt template not available");
    }

    const competitiveContext = enrichedData.benchmarks?.competitors?.length
      ? enrichedData.benchmarks.competitors
          .map((c: any) => `${c.name}: ${c.value}`)
          .join(", ")
      : "No competitor data available";

    const fallbackMetricAnalysis = `METRIC ANALYSIS:\nAssess ${metricName} performance and competitive positioning. Evaluate current performance level and identify optimization opportunities.\n\nCOMPETITIVE INTELLIGENCE:\nCompare performance against industry standards and competitors. Identify specific factors driving performance differences.\n\nOPTIMIZATION PRIORITIES:\nFocus on highest-impact improvements that enhance metric performance and business outcomes.`;

    let prompt = globalTemplate.promptTemplate
      .replace(/\{\{METRIC_SPECIFIC_ANALYSIS\}\}/g, fallbackMetricAnalysis)
      .replace(
        /\{\{clientName\}\}/g,
        enrichedData.client?.name || "Current Client",
      )
      .replace(/\{\{industry\}\}/g, enrichedData.client?.industry || "Unknown")
      .replace(
        /\{\{businessSize\}\}/g,
        enrichedData.client?.businessSize || "Unknown",
      )
      .replace(/\{\{clientValue\}\}/g, String(enrichedData.metric.clientValue))
      .replace(
        /\{\{industryAverage\}\}/g,
        String(enrichedData.benchmarks?.industryAverage || "N/A"),
      )
      .replace(
        /\{\{cdPortfolioAverage\}\}/g,
        String(enrichedData.benchmarks?.cdPortfolioAverage || "N/A"),
      )
      .replace(/\{\{competitors\}\}/g, competitiveContext)
      .replace(/\{\{metricDisplayName\}\}/g, metricName);

    if (userContext && userContext.trim()) {
      prompt += `\n\n[USER-CONTEXT]\n${userContext.trim()}\n[/USER-CONTEXT]`;
    }

    prompt = appendJsonContract(prompt, true);

    const baseOpts = {
      response_format: { type: "json_object" } as const,
      temperature: 0.7,
      max_tokens: 600,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const compatOpts = normalizeCompletionOptions(baseOpts, OPENAI_MODEL);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      ...compatOpts,
    });
    const result = JSON.parse(response.choices[0].message.content || "{}");

    const status = determineMetricStatus(
      metricName,
      enrichedData.metric?.clientValue,
      enrichedData.benchmarks?.industryAverage,
      enrichedData.benchmarks?.cdPortfolioAverage,
      enrichedData.benchmarks?.competitors?.map((c: any) => c.value),
    );

    return {
      context:
        parseNestedText(result.context) || "Metric analysis in progress.",
      insight: parseNestedText(result.insight) || "Insights being generated.",
      recommendation:
        parseNestedText(result.recommendation) ||
        "1. Prioritize quick wins\n2. Address core gaps\n3. Leverage strengths",
      status:
        (result.status as MetricAnalysis["status"]) ||
        status ||
        "needs_improvement",
    };
  } catch (error) {
    logger.error("Error generating default insights with context", {
      error: (error as Error).message,
      metricName,
    });
    return {
      context: "Unable to generate default contextual analysis.",
      insight: "Please retry soon.",
      recommendation:
        "1. Retry later\n2. Validate template availability\n3. Check inputs",
      status: "warning",
    };
  }
}

// ---------- (Optional) Display info util retained for future use ----------
export function getMetricDisplayInfo(
  metricName: string,
  value: any,
): { unit: string; displayValue: string; rawUnit: string } {
  const metricConfig: Record<
    string,
    { unit: string; rawUnit: string; converter?: (val: number) => number }
  > = {
    "Bounce Rate": { unit: "%", rawUnit: "%" },
    "Session Duration": {
      unit: "minutes and seconds",
      rawUnit: "seconds",
      converter: (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return parseFloat(
          `${minutes}.${remainingSeconds.toString().padStart(2, "0")}`,
        );
      },
    },
    "Pages per Session": { unit: "pages", rawUnit: "pages" },
    Sessions: { unit: "sessions", rawUnit: "sessions" },
    "Sessions per User": { unit: "sessions", rawUnit: "sessions" },
    "Page Views": { unit: "views", rawUnit: "views" },
    Users: { unit: "users", rawUnit: "users" },
    "New Users": { unit: "users", rawUnit: "users" },
    "Conversion Rate": { unit: "%", rawUnit: "%" },
    "Click-Through Rate": { unit: "%", rawUnit: "%" },
    "Exit Rate": { unit: "%", rawUnit: "%" },
    "Load Time": { unit: "seconds", rawUnit: "seconds" },
    Revenue: { unit: "$", rawUnit: "$" },
    "Traffic Channels": { unit: "channels", rawUnit: "channels" },
  };

  const config = metricConfig[metricName] || {
    unit: "units",
    rawUnit: "units",
  };

  if (config.converter && typeof value === "number") {
    const converted = config.converter(value);
    return {
      unit: config.unit,
      displayValue: converted.toString(),
      rawUnit: config.rawUnit,
    };
  }
  return {
    unit: config.unit,
    displayValue: value?.toString() || "0",
    rawUnit: config.rawUnit,
  };
}
