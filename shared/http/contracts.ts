/**
 * Shared HTTP API contracts using Zod schemas
 * Ensures type safety between frontend and backend
 */

import { z } from 'zod';

// ===== COMMON SCHEMAS =====

export const CompetitorSchema = z.object({
  id: z.string(),
  domain: z.string().transform(val => val || ''), // Transform empty/null to empty string
  label: z.string().transform(val => val || 'Unknown Competitor'), // Transform empty/null to default
  status: z.union([z.string(), z.null(), z.undefined()]).transform(val => val || 'Active') // Handle null/undefined
});

const DashboardMetricSchema = z.object({
  metricName: z.string(),
  value: z.union([z.string(), z.number()]),
  sourceType: z.string(),
  channel: z.string().optional(),
  competitorId: z.string().optional() // Keep optional to handle Client/CD_Avg metrics
});

const TimeSeriesDataPointSchema = z.object({
  metricName: z.string(),
  value: z.union([z.string(), z.number()]),
  sourceType: z.string(),
  competitorId: z.string().optional()
});

const TrafficChannelMetricSchema = z.object({
  metricName: z.string(),
  value: z.number(),
  sourceType: z.string(),
  channel: z.string()
});

const AIInsightSchema = z.object({
  metricName: z.string(),
  contextText: z.string(),
  insightText: z.string(),
  recommendationText: z.string(),
  status: z.string().optional(),
  createdAt: z.string().optional()
});

// ===== REQUEST SCHEMAS =====

export const DashboardRequestSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  timePeriod: z.string()
    .default("Last Month")
    .transform(val => {
      // Normalize common time period variations
      const normalized = val.trim().toLowerCase().replace(/[_\s]+/g, ' ');
      const mapping: Record<string, string> = {
        'last month': 'Last Month',
        'last 3 months': 'Last 3 Months', 
        'last quarter': 'Last 3 Months',
        'last 6 months': 'Last 6 Months',
        'last year': 'Last Year',
        'last 12 months': 'Last Year',
        'custom date range': 'Custom Date Range'
      };
      return mapping[normalized] || val;
    }),
  businessSize: z.string().default("All"),
  industryVertical: z.string().default("All")
});

export const FiltersRequestSchema = z.object({
  businessSize: z.string().optional(),
  industryVertical: z.string().optional()
});

export const InsightsRequestSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  timePeriod: z.string()
    .default("Last Month")
    .transform(val => {
      // Normalize common time period variations
      const normalized = val.trim().toLowerCase().replace(/[_\s]+/g, ' ');
      const mapping: Record<string, string> = {
        'last month': 'Last Month',
        'last 3 months': 'Last 3 Months', 
        'last quarter': 'Last 3 Months',
        'last 6 months': 'Last 6 Months',
        'last year': 'Last Year',
        'last 12 months': 'Last Year',
        'custom date range': 'Custom Date Range'
      };
      return mapping[normalized] || val;
    })
});

// ===== RESPONSE SCHEMAS =====

export const DashboardResponseSchema = z.object({
  client: z.object({
    id: z.string(),
    name: z.string(),
    websiteUrl: z.string()
  }),
  metrics: z.array(DashboardMetricSchema),
  averagedMetrics: z.record(z.record(z.number())).optional(),
  timeSeriesData: z.record(z.array(TimeSeriesDataPointSchema)).optional(),
  competitors: z.array(CompetitorSchema),
  insights: z.array(AIInsightSchema),
  isTimeSeries: z.boolean().optional(),
  periods: z.array(z.string()).optional(),
  trafficChannelMetrics: z.array(TrafficChannelMetricSchema).optional()
});

export const FiltersResponseSchema = z.object({
  businessSizes: z.array(z.string()),
  industryVerticals: z.array(z.string()),
  timePeriods: z.array(z.string())
});

export const InsightsResponseSchema = z.object({
  status: z.enum(['available', 'pending', 'generating', 'error']).default('pending'),
  insights: z.array(AIInsightSchema),
  message: z.string().optional()
});

// ===== ERROR SCHEMAS =====

export const ErrorResponseSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional()
});

export const SchemaValidationErrorSchema = z.object({
  message: z.string(),
  code: z.literal("SCHEMA_MISMATCH"),
  validationErrors: z.array(z.object({
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string()
  }))
});

// ===== TYPE EXPORTS =====

export type DashboardRequest = z.infer<typeof DashboardRequestSchema>;
export type FiltersRequest = z.infer<typeof FiltersRequestSchema>;
export type InsightsRequest = z.infer<typeof InsightsRequestSchema>;

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type FiltersResponse = z.infer<typeof FiltersResponseSchema>;
export type InsightsResponse = z.infer<typeof InsightsResponseSchema>;

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SchemaValidationError = z.infer<typeof SchemaValidationErrorSchema>;

// ===== QUERY KEY GENERATORS =====

/**
 * Standardized query key generators for consistent caching
 */
export const QueryKeys = {
  dashboard: (clientId: string, timePeriod: string = "Last Month") => 
    ["/api/dashboard", clientId, timePeriod] as const,
    
  filters: () => 
    ["/api/filters"] as const,
    
  insights: (clientId: string, timePeriod: string = "Last Month") => 
    ["/api/ai-insights", clientId, timePeriod] as const
} as const;

// ===== VALIDATION HELPERS =====

/**
 * Validates and transforms server response data
 * @param schema Zod schema to validate against
 * @param data Raw response data
 * @returns Validated data or throws validation error
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const validationError: SchemaValidationError = {
      message: "Response validation failed",
      code: "SCHEMA_MISMATCH",
      validationErrors: result.error.errors.map(err => ({
        path: err.path,
        message: err.message
      }))
    };
    
    throw new Error(JSON.stringify(validationError));
  }
  
  return result.data;
}

/**
 * Normalizes time period parameter with fallback
 * @param timePeriod Raw time period from request
 * @returns Normalized time period string
 */
export function normalizeTimePeriod(timePeriod?: string | string[]): string {
  if (Array.isArray(timePeriod)) {
    console.warn("Multiple timePeriod values provided, using first:", timePeriod[0]);
    return timePeriod[0] || "Last Month";
  }
  
  if (!timePeriod || timePeriod.trim() === "") {
    console.warn("Empty timePeriod provided, defaulting to 'Last Month'");
    return "Last Month";
  }
  
  return timePeriod;
}

/**
 * Normalizes filter parameters for consistent handling
 * @param params Raw query parameters
 * @returns Normalized filter parameters
 */
export function normalizeFilterParams(params: any): { businessSize: string; industryVertical: string } {
  return {
    businessSize: params.businessSize || params.currentBusinessSize || "All",
    industryVertical: params.industryVertical || params.currentIndustryVertical || "All"
  };
}