// Database schema definitions using Drizzle ORM
//
// ARCHITECTURE ENTITIES:
// - clients: Actual customers using the dashboard
// - cdPortfolioCompanies: Clear Digital's client portfolio (generates CD_Avg benchmarks)
// - benchmarkCompanies: Industry reference companies (generates Industry_Avg benchmarks)  
// - competitors: Client-specific competitor companies (generates Competitor sourceType data)
//
import { sql } from "drizzle-orm";
import { pgTable, varchar, text, integer, boolean, timestamp, decimal, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["Admin", "User"]);
export const statusEnum = pgEnum("status", ["Active", "Inactive", "Invited"]);
export const sourceTypeEnum = pgEnum("source_type", ["Client", "CD_Avg", "Industry", "Competitor", "Industry_Avg", "Competitor_Avg"]);

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
});

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
  active: boolean("active").default(true).notNull(),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// GA4 Property Access Tracking
export const ga4PropertyAccess = pgTable("ga4_property_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  serviceAccountId: varchar("service_account_id").references(() => ga4ServiceAccounts.id).notNull(),
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
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  competitorId: varchar("competitor_id").references(() => competitors.id),
  metricName: text("metric_name").notNull(),
  value: jsonb("value").notNull(), // Changed to jsonb to support complex data structures
  sourceType: sourceTypeEnum("source_type").notNull(),
  timePeriod: text("time_period").notNull(), // YYYY-MM format
  channel: varchar("channel", { length: 50 }), // For traffic channels breakdown
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const benchmarks = pgTable("benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricName: text("metric_name").notNull(),
  industryVertical: text("industry_vertical").notNull(),
  businessSize: text("business_size").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  timePeriod: text("time_period").notNull(), // YYYY-MM format
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

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
