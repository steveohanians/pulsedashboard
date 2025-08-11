// Database schema definitions using Drizzle ORM
//
// ARCHITECTURE ENTITIES:
// - clients: Actual customers using the dashboard
// - cdPortfolioCompanies: Clear Digital's client portfolio (generates CD_Avg benchmarks)
// - benchmarkCompanies: Industry reference companies (generates Industry_Avg benchmarks)  
// - competitors: Client-specific competitor companies (generates Competitor sourceType data)
//
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, integer, boolean, timestamp, decimal, pgEnum, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== CANONICAL METRIC ENVELOPE SCHEMAS =====

/**
 * Canonical Metric Envelope Schema
 * 
 * Standardizes all metrics stored in Postgres to follow a unified JSON structure
 * so chart readers never need to branch by source type.
 */

export const CanonicalMetricDimensionsSchema = z.object({
  deviceCategory: z.string().optional(), // "Desktop", "Mobile", "Tablet"
  channel: z.string().optional(), // "Organic Search", "Direct", "Social Media", etc.
}).strict();

export const CanonicalMetricSeriesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  value: z.number(),
  dimensions: CanonicalMetricDimensionsSchema.optional()
}).strict();

export const CanonicalMetricMetaSchema = z.object({
  sourceType: z.enum(["GA4", "SEMrush", "DataForSEO"]),
  units: z.string(), // "percentage", "minutes", "count", "sessions", etc.
  notes: z.string().optional()
}).strict();

export const CanonicalMetricEnvelopeSchema = z.object({
  series: z.array(CanonicalMetricSeriesSchema).min(1, "Series must contain at least one data point"),
  meta: CanonicalMetricMetaSchema
}).strict();

// Type exports for canonical envelope
export type CanonicalMetricDimensions = z.infer<typeof CanonicalMetricDimensionsSchema>;
export type CanonicalMetricSeries = z.infer<typeof CanonicalMetricSeriesSchema>;
export type CanonicalMetricMeta = z.infer<typeof CanonicalMetricMetaSchema>;
export type CanonicalMetricEnvelope = z.infer<typeof CanonicalMetricEnvelopeSchema>;

/**
 * Validation helper for canonical metric envelopes
 */
export function validateCanonicalMetricEnvelope(data: unknown): CanonicalMetricEnvelope {
  try {
    return CanonicalMetricEnvelopeSchema.parse(data);
  } catch (error) {
    throw new Error(`Invalid canonical metric envelope: ${error instanceof z.ZodError ? error.message : String(error)}`);
  }
}

// Enums
export const roleEnum = pgEnum("role", ["Admin", "User"]);
export const statusEnum = pgEnum("status", ["Active", "Inactive", "Invited"]);
export const sourceTypeEnum = pgEnum("source_type", ["Client", "CD_Portfolio", "CD_Avg", "Industry", "Competitor", "Industry_Avg", "Competitor_Avg"]);

// Tables
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  websiteUrl: text("website_url").notNull(),
  industryVertical: text("industry_vertical").notNull(),
  businessSize: text("business_size").notNull(),
  ga4PropertyId: text("ga4_property_id"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Index for client filtering
  industryVerticalIdx: index("idx_clients_industry_vertical").on(table.industryVertical),
  businessSizeIdx: index("idx_clients_business_size").on(table.businessSize),
  activeIdx: index("idx_clients_active").on(table.active),
}));

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").default("User").notNull(),
  status: statusEnum("status").default("Active").notNull(),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const competitors = pgTable("competitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  domain: text("domain").notNull(),
  label: text("label").notNull(),
  status: statusEnum("status").default("Active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const benchmarkCompanies = pgTable("benchmark_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  websiteUrl: text("website_url").notNull(),
  industryVertical: text("industry_vertical").notNull(),
  businessSize: text("business_size").notNull(),
  sourceVerified: boolean("source_verified").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google Service Account Management for GA4 API access
export const ga4ServiceAccounts = pgTable("ga4_service_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Clear Digital Main", "Client Batch A"
  serviceAccountEmail: text("service_account_email").notNull().unique(),
  accessToken: text("access_token"), // OAuth access token
  refreshToken: text("refresh_token"), // OAuth refresh token
  tokenExpiry: timestamp("token_expiry"), // When access token expires
  scopes: text("scopes").array(), // Granted OAuth scopes
  verified: boolean("verified").default(false).notNull(), // OAuth verification status
  active: boolean("active").default(true).notNull(),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// GA4 Property Access Tracking
export const ga4PropertyAccess = pgTable("ga4_property_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull().unique(), // Enforce one-to-one relationship
  serviceAccountId: varchar("service_account_id").references(() => ga4ServiceAccounts.id, { onDelete: "cascade" }).notNull(),
  propertyId: text("property_id").notNull(),
  propertyName: text("property_name"), // Fetched from GA4 API
  accessLevel: text("access_level"), // Viewer, Analyst, Editor, etc.
  accessVerified: boolean("access_verified").default(false).notNull(),
  lastVerified: timestamp("last_verified"),
  lastDataSync: timestamp("last_data_sync"),
  syncStatus: text("sync_status").default("pending"), // pending, success, failed, blocked
  errorMessage: text("error_message"), // Store API errors
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// CD Portfolio companies for company benchmarking (separate from clients)
export const cdPortfolioCompanies = pgTable("cd_portfolio_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  websiteUrl: text("website_url").notNull(),
  industryVertical: text("industry_vertical").notNull(),
  businessSize: text("business_size").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  competitorId: varchar("competitor_id").references(() => competitors.id),
  cdPortfolioCompanyId: varchar("cd_portfolio_company_id").references(() => cdPortfolioCompanies.id),
  benchmarkCompanyId: varchar("benchmark_company_id").references(() => benchmarkCompanies.id),
  metricName: text("metric_name").notNull(),
  value: jsonb("value"), // Legacy field - contains raw data during migration
  canonicalEnvelope: jsonb("canonical_envelope"), // New canonical format
  sourceType: sourceTypeEnum("source_type").notNull(),
  timePeriod: text("time_period").notNull(), // YYYY-MM format
  channel: varchar("channel", { length: 50 }), // For traffic channels breakdown
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Performance indexes for frequently queried fields
  clientIdIdx: index("idx_metrics_client_id").on(table.clientId),
  metricNameIdx: index("idx_metrics_metric_name").on(table.metricName),
  timePeriodIdx: index("idx_metrics_time_period").on(table.timePeriod),
  sourceTypeIdx: index("idx_metrics_source_type").on(table.sourceType),
  // Composite indexes for common query patterns
  clientMetricIdx: index("idx_metrics_client_metric").on(table.clientId, table.metricName),
  clientTimePeriodIdx: index("idx_metrics_client_time_period").on(table.clientId, table.timePeriod),
  metricTimePeriodIdx: index("idx_metrics_metric_time_period").on(table.metricName, table.timePeriod),
}));

export const benchmarks = pgTable("benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricName: text("metric_name").notNull(),
  industryVertical: text("industry_vertical").notNull(),
  businessSize: text("business_size").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  timePeriod: text("time_period").notNull(), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for benchmark lookups
  industryVerticalIdx: index("idx_benchmarks_industry_vertical").on(table.industryVertical),
  businessSizeIdx: index("idx_benchmarks_business_size").on(table.businessSize),
  metricNameIdx: index("idx_benchmarks_metric_name").on(table.metricName),
  timePeriodIdx: index("idx_benchmarks_time_period").on(table.timePeriod),
  // Composite index for filtering benchmarks
  industryMetricIdx: index("idx_benchmarks_industry_metric").on(table.industryVertical, table.businessSize, table.metricName),
}));

export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  metricName: text("metric_name").notNull(),
  timePeriod: text("time_period").notNull(),
  contextText: text("context_text"),
  insightText: text("insight_text"),
  recommendationText: text("recommendation_text"),
  status: text("status"), // success, needs_improvement, warning
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes for AI insights lookups
  clientIdIdx: index("idx_ai_insights_client_id").on(table.clientId),
  metricNameIdx: index("idx_ai_insights_metric_name").on(table.metricName),
  timePeriodIdx: index("idx_ai_insights_time_period").on(table.timePeriod),
  clientMetricIdx: index("idx_ai_insights_client_metric").on(table.clientId, table.metricName),
}));

export const globalPromptTemplate = pgTable("global_prompt_template", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique().default("Global Base Template"),
  promptTemplate: text("prompt_template").notNull(),
  description: text("description"), // Help text for admin
  variables: text("variables"), // JSON array of available variables
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const metricPrompts = pgTable("metric_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricName: text("metric_name").notNull().unique(),
  promptTemplate: text("prompt_template").notNull(),
  description: text("description"), // Help text for admin
  variables: text("variables"), // JSON array of available variables
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insightContexts = pgTable("insight_contexts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  metricName: text("metric_name").notNull(),
  userContext: text("user_context").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Filter options table for custom filter management
export const filterOptions = pgTable("filter_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // 'businessSizes' or 'industryVerticals'
  value: text("value").notNull(),
  order: integer("order").default(0).notNull(), // For custom ordering
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  users: many(users),
  competitors: many(competitors),
  metrics: many(metrics),
  aiInsights: many(aiInsights),
  insightContexts: many(insightContexts),
  ga4PropertyAccess: many(ga4PropertyAccess),
}));

export const ga4ServiceAccountsRelations = relations(ga4ServiceAccounts, ({ many }) => ({
  propertyAccess: many(ga4PropertyAccess),
}));

export const ga4PropertyAccessRelations = relations(ga4PropertyAccess, ({ one }) => ({
  client: one(clients, {
    fields: [ga4PropertyAccess.clientId],
    references: [clients.id],
  }),
  serviceAccount: one(ga4ServiceAccounts, {
    fields: [ga4PropertyAccess.serviceAccountId],
    references: [ga4ServiceAccounts.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  client: one(clients, {
    fields: [users.clientId],
    references: [clients.id],
  }),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  client: one(clients, {
    fields: [competitors.clientId],
    references: [clients.id],
  }),
  metrics: many(metrics),
}));

export const metricsRelations = relations(metrics, ({ one }) => ({
  client: one(clients, {
    fields: [metrics.clientId],
    references: [clients.id],
  }),
  competitor: one(competitors, {
    fields: [metrics.competitorId],
    references: [competitors.id],
  }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  client: one(clients, {
    fields: [aiInsights.clientId],
    references: [clients.id],
  }),
}));

export const insightContextsRelations = relations(insightContexts, ({ one }) => ({
  client: one(clients, {
    fields: [insightContexts.clientId],
    references: [clients.id],
  }),
}));

// Insert schemas
export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true,
});

export const insertCompetitorSchema = createInsertSchema(competitors).omit({
  id: true,
  createdAt: true,
});

export const insertBenchmarkCompanySchema = createInsertSchema(benchmarkCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertCdPortfolioCompanySchema = createInsertSchema(cdPortfolioCompanies).omit({
  id: true,
  createdAt: true,
});

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true,
});

export const insertBenchmarkSchema = createInsertSchema(benchmarks).omit({
  id: true,
  createdAt: true,
});

export const insertAIInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
});

export const insertGlobalPromptTemplateSchema = createInsertSchema(globalPromptTemplate).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGlobalPromptTemplateSchema = createInsertSchema(globalPromptTemplate).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertMetricPromptSchema = createInsertSchema(metricPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMetricPromptSchema = createInsertSchema(metricPrompts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertFilterOptionSchema = createInsertSchema(filterOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFilterOptionSchema = createInsertSchema(filterOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export const insertGA4ServiceAccountSchema = createInsertSchema(ga4ServiceAccounts).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
});

export const updateGA4ServiceAccountSchema = createInsertSchema(ga4ServiceAccounts).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertGA4PropertyAccessSchema = createInsertSchema(ga4PropertyAccess).omit({
  id: true,
  createdAt: true,
  lastVerified: true,
  lastDataSync: true,
});

export const updateGA4PropertyAccessSchema = createInsertSchema(ga4PropertyAccess).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertInsightContextSchema = createInsertSchema(insightContexts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateInsightContextSchema = createInsertSchema(insightContexts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

// Types
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type BenchmarkCompany = typeof benchmarkCompanies.$inferSelect;
export type InsertBenchmarkCompany = z.infer<typeof insertBenchmarkCompanySchema>;
export type CdPortfolioCompany = typeof cdPortfolioCompanies.$inferSelect;
export type InsertCdPortfolioCompany = z.infer<typeof insertCdPortfolioCompanySchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Benchmark = typeof benchmarks.$inferSelect;
export type InsertBenchmark = z.infer<typeof insertBenchmarkSchema>;
export type AIInsight = typeof aiInsights.$inferSelect;
export type InsertAIInsight = z.infer<typeof insertAIInsightSchema>;

export type GlobalPromptTemplate = typeof globalPromptTemplate.$inferSelect;
export type InsertGlobalPromptTemplate = z.infer<typeof insertGlobalPromptTemplateSchema>;
export type UpdateGlobalPromptTemplate = z.infer<typeof updateGlobalPromptTemplateSchema>;

export type MetricPrompt = typeof metricPrompts.$inferSelect;
export type InsertMetricPrompt = z.infer<typeof insertMetricPromptSchema>;
export type UpdateMetricPrompt = z.infer<typeof updateMetricPromptSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type InsightContext = typeof insightContexts.$inferSelect;
export type InsertInsightContext = z.infer<typeof insertInsightContextSchema>;
export type UpdateInsightContext = z.infer<typeof updateInsightContextSchema>;
export type FilterOption = typeof filterOptions.$inferSelect;
export type InsertFilterOption = z.infer<typeof insertFilterOptionSchema>;
export type UpdateFilterOption = z.infer<typeof updateFilterOptionSchema>;

export type GA4ServiceAccount = typeof ga4ServiceAccounts.$inferSelect;
export type InsertGA4ServiceAccount = z.infer<typeof insertGA4ServiceAccountSchema>;
export type UpdateGA4ServiceAccount = z.infer<typeof updateGA4ServiceAccountSchema>;

export type GA4PropertyAccess = typeof ga4PropertyAccess.$inferSelect;
export type InsertGA4PropertyAccess = z.infer<typeof insertGA4PropertyAccessSchema>;
export type UpdateGA4PropertyAccess = z.infer<typeof updateGA4PropertyAccessSchema>;
