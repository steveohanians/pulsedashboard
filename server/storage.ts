import { 
  clients, users, competitors, benchmarkCompanies, cdPortfolioCompanies, metrics, benchmarks, aiInsights, passwordResetTokens, globalPromptTemplate, metricPrompts, insightContexts, filterOptions,
  type Client, type InsertClient,
  type User, type InsertUser,
  type Competitor, type InsertCompetitor,
  type BenchmarkCompany, type InsertBenchmarkCompany,
  type CdPortfolioCompany, type InsertCdPortfolioCompany,
  type Metric, type InsertMetric,
  type Benchmark, type InsertBenchmark,
  type AIInsight, type InsertAIInsight,
  type PasswordResetToken, type InsertPasswordResetToken,
  type GlobalPromptTemplate, type InsertGlobalPromptTemplate, type UpdateGlobalPromptTemplate,
  type MetricPrompt, type InsertMetricPrompt, type UpdateMetricPrompt,
  type InsightContext, type InsertInsightContext, type UpdateInsightContext,
  type FilterOption, type InsertFilterOption, type UpdateFilterOption
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { DatabaseRepository } from "./utils/databaseUtils";
import logger from "./utils/logger";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser & { lastLogin?: Date }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  
  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  
  // Competitors
  getCompetitorsByClient(clientId: string): Promise<Competitor[]>;
  createCompetitor(competitor: InsertCompetitor): Promise<Competitor>;
  deleteCompetitor(id: string): Promise<void>;
  
  // Benchmark Companies
  getBenchmarkCompanies(): Promise<BenchmarkCompany[]>;
  createBenchmarkCompany(company: InsertBenchmarkCompany): Promise<BenchmarkCompany>;
  updateBenchmarkCompany(id: string, company: Partial<InsertBenchmarkCompany>): Promise<BenchmarkCompany | undefined>;
  deleteBenchmarkCompany(id: string): Promise<void>;
  
  // CD Portfolio Companies
  getCdPortfolioCompanies(): Promise<CdPortfolioCompany[]>;
  createCdPortfolioCompany(company: InsertCdPortfolioCompany): Promise<CdPortfolioCompany>;
  updateCdPortfolioCompany(id: string, company: Partial<InsertCdPortfolioCompany>): Promise<CdPortfolioCompany | undefined>;
  deleteCdPortfolioCompany(id: string): Promise<void>;
  
  // Metrics
  getMetricsByClient(clientId: string, timePeriod: string): Promise<Metric[]>;
  getMetricsByNameAndPeriod(clientId: string, metricName: string, timePeriod: string, sourceType: string): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;
  
  // Benchmarks
  getBenchmarks(metricName: string, industryVertical: string, businessSize: string, timePeriod: string): Promise<Benchmark[]>;
  createBenchmark(benchmark: InsertBenchmark): Promise<Benchmark>;
  
  // AI Insights
  getAIInsights(clientId: string, timePeriod: string): Promise<AIInsight[]>;
  getAIInsightsByClient(clientId: string, timePeriod?: string): Promise<AIInsight[]>;
  createAIInsight(insight: InsertAIInsight): Promise<AIInsight>;
  clearAllAIInsights(): Promise<void>;
  
  // Password Reset
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  usePasswordResetToken(token: string): Promise<void>;
  
  // Insight Contexts
  getInsightContext(clientId: string, metricName: string): Promise<InsightContext | undefined>;
  createInsightContext(context: InsertInsightContext): Promise<InsightContext>;
  updateInsightContext(id: string, context: UpdateInsightContext): Promise<InsightContext | undefined>;
  deleteInsightContext(id: string): Promise<void>;
  clearAllInsightContexts(): Promise<void>;
  
  // Global Prompt Template
  getGlobalPromptTemplate(): Promise<GlobalPromptTemplate | undefined>;
  updateGlobalPromptTemplate(template: UpdateGlobalPromptTemplate): Promise<GlobalPromptTemplate | undefined>;
  
  // Metric Prompts
  getMetricPrompts(): Promise<MetricPrompt[]>;
  getMetricPrompt(metricName: string): Promise<MetricPrompt | undefined>;
  createMetricPrompt(prompt: InsertMetricPrompt): Promise<MetricPrompt>;
  updateMetricPrompt(metricName: string, prompt: UpdateMetricPrompt): Promise<MetricPrompt | undefined>;
  deleteMetricPrompt(metricName: string): Promise<void>;
  
  // Filter Options
  getFilterOptions(): Promise<FilterOption[]>;
  getFilterOptionsByCategory(category: string): Promise<FilterOption[]>;
  createFilterOption(option: InsertFilterOption): Promise<FilterOption>;
  updateFilterOption(id: string, option: UpdateFilterOption): Promise<FilterOption | undefined>;
  deleteFilterOption(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  // Consolidated CRUD repositories - eliminates duplicate patterns
  private clientRepo = new DatabaseRepository<Client, InsertClient>(clients, 'client');
  private userRepo = new DatabaseRepository<User, InsertUser>(users, 'user');
  private competitorRepo = new DatabaseRepository<Competitor, InsertCompetitor>(competitors, 'competitor');
  private benchmarkCompanyRepo = new DatabaseRepository<BenchmarkCompany, InsertBenchmarkCompany>(benchmarkCompanies, 'benchmark company');
  private cdPortfolioCompanyRepo = new DatabaseRepository<CdPortfolioCompany, InsertCdPortfolioCompany>(cdPortfolioCompanies, 'CD portfolio company');
  private metricRepo = new DatabaseRepository<Metric, InsertMetric>(metrics, 'metric');
  private benchmarkRepo = new DatabaseRepository<Benchmark, InsertBenchmark>(benchmarks, 'benchmark');
  private aiInsightRepo = new DatabaseRepository<AIInsight, InsertAIInsight>(aiInsights, 'AI insight');
  private filterOptionRepo = new DatabaseRepository<FilterOption, InsertFilterOption>(filterOptions, 'filter option');

  constructor() {
    try {
      this.sessionStore = new PostgresSessionStore({ 
        pool, 
        createTableIfMissing: true,  // Allow creating table if missing
        tableName: 'sessions',  // Explicit table name
        // Add error handling for connection issues
        errorLog: (error: Error) => {
          logger.error('Session store error:', error.message);
        }
      });
    } catch (error) {
      logger.error('Failed to initialize session store:', error);
      // Fallback to memory store for development
      const MemoryStore = session.MemoryStore;
      this.sessionStore = new MemoryStore();
      logger.warn('Using memory store as fallback - sessions will not persist');
    }
  }

  // Users - consolidated using DatabaseRepository
  async getUser(id: string): Promise<User | undefined> {
    return await this.userRepo.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return await this.userRepo.create(insertUser);
  }

  async getUsers(): Promise<User[]> {
    return await this.userRepo.findAll();
  }

  async updateUser(id: string, updateUser: Partial<InsertUser & { lastLogin?: Date }>): Promise<User | undefined> {
    return await this.userRepo.update(id, updateUser);
  }

  async deleteUser(id: string): Promise<void> {
    await this.userRepo.delete(id);
  }

  // Clients - consolidated using DatabaseRepository
  async getClient(id: string): Promise<Client | undefined> {
    return await this.clientRepo.findById(id);
  }

  async getClients(): Promise<Client[]> {
    return await this.clientRepo.findAll({ active: true });
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    return await this.clientRepo.create(insertClient);
  }

  async updateClient(id: string, updateClient: Partial<InsertClient>): Promise<Client | undefined> {
    return await this.clientRepo.update(id, updateClient);
  }

  async deleteClient(id: string): Promise<void> {
    // First delete all related data to maintain referential integrity
    
    // Delete metrics associated with this client
    await db.delete(metrics).where(eq(metrics.clientId, id));
    
    // Delete AI insights associated with this client  
    await db.delete(aiInsights).where(eq(aiInsights.clientId, id));
    
    // Delete insight contexts associated with this client
    await db.delete(insightContexts).where(eq(insightContexts.clientId, id));
    
    // Delete competitors associated with this client
    const clientCompetitors = await db.select().from(competitors).where(eq(competitors.clientId, id));
    for (const competitor of clientCompetitors) {
      await this.deleteCompetitor(competitor.id);
    }
    
    // Finally delete the client
    await this.clientRepo.delete(id);
  }



  // Competitors
  async getCompetitorsByClient(clientId: string): Promise<Competitor[]> {
    return await db.select().from(competitors).where(eq(competitors.clientId, clientId));
  }

  // Competitors - consolidated using DatabaseRepository
  async createCompetitor(insertCompetitor: InsertCompetitor): Promise<Competitor> {
    return await this.competitorRepo.create(insertCompetitor);
  }

  async deleteCompetitor(id: string): Promise<void> {
    // First delete all metrics associated with this competitor
    await db.delete(metrics).where(eq(metrics.competitorId, id));
    
    // Then delete the competitor using consolidated method
    await this.competitorRepo.delete(id);
  }



  // Benchmark Companies
  async getBenchmarkCompanies(): Promise<BenchmarkCompany[]> {
    return await db.select().from(benchmarkCompanies).where(eq(benchmarkCompanies.active, true));
  }

  // Benchmark Companies - consolidated using DatabaseRepository
  async createBenchmarkCompany(insertCompany: InsertBenchmarkCompany): Promise<BenchmarkCompany> {
    return await this.benchmarkCompanyRepo.create(insertCompany);
  }

  async updateBenchmarkCompany(id: string, updateCompany: Partial<InsertBenchmarkCompany>): Promise<BenchmarkCompany | undefined> {
    return await this.benchmarkCompanyRepo.update(id, updateCompany);
  }

  async deleteBenchmarkCompany(id: string): Promise<void> {
    await this.benchmarkCompanyRepo.delete(id);
  }

  // CD Portfolio Companies
  async getCdPortfolioCompanies(): Promise<CdPortfolioCompany[]> {
    return await db.select().from(cdPortfolioCompanies).where(eq(cdPortfolioCompanies.active, true));
  }

  // CD Portfolio Companies - consolidated using DatabaseRepository
  async createCdPortfolioCompany(insertCompany: InsertCdPortfolioCompany): Promise<CdPortfolioCompany> {
    return await this.cdPortfolioCompanyRepo.create(insertCompany);
  }

  async updateCdPortfolioCompany(id: string, updateCompany: Partial<InsertCdPortfolioCompany>): Promise<CdPortfolioCompany | undefined> {
    return await this.cdPortfolioCompanyRepo.update(id, updateCompany);
  }

  async deleteCdPortfolioCompany(id: string): Promise<void> {
    await this.cdPortfolioCompanyRepo.delete(id);
  }

  // Get filtered CD Portfolio companies
  async getFilteredCdPortfolioCompanies(filters?: { businessSize?: string; industryVertical?: string }): Promise<CdPortfolioCompany[]> {
    const conditions = [eq(cdPortfolioCompanies.active, true)];
    
    if (filters?.businessSize && filters.businessSize !== "All") {
      conditions.push(eq(cdPortfolioCompanies.businessSize, filters.businessSize));
    }
    
    if (filters?.industryVertical && filters.industryVertical !== "All") {
      conditions.push(eq(cdPortfolioCompanies.industryVertical, filters.industryVertical));
    }
    
    return await db.select().from(cdPortfolioCompanies).where(and(...conditions));
  }

  // Get filtered benchmark companies
  async getFilteredBenchmarkCompanies(filters?: { businessSize?: string; industryVertical?: string }): Promise<BenchmarkCompany[]> {
    const conditions = [eq(benchmarkCompanies.active, true)];
    
    if (filters?.businessSize && filters.businessSize !== "All") {
      conditions.push(eq(benchmarkCompanies.businessSize, filters.businessSize));
    }
    
    if (filters?.industryVertical && filters.industryVertical !== "All") {
      conditions.push(eq(benchmarkCompanies.industryVertical, filters.industryVertical));
    }
    
    return await db.select().from(benchmarkCompanies).where(and(...conditions));
  }

  // Get filtered industry average metrics based on actual benchmark data
  async getFilteredIndustryMetrics(
    period: string, 
    filters?: { businessSize?: string; industryVertical?: string }
  ): Promise<Metric[]> {
    logger.debug(`getFilteredIndustryMetrics called with period: ${period}, filters:`, filters);
    
    // Get all Industry_Avg metrics for this period
    const allIndustryMetrics = await db.select().from(metrics).where(
      and(
        eq(metrics.sourceType, 'Industry_Avg'),
        eq(metrics.timePeriod, period)
      )
    );
    
    // If no filters applied, return all metrics
    if (!filters || ((!filters.businessSize || filters.businessSize === "All") && 
                    (!filters.industryVertical || filters.industryVertical === "All"))) {
      logger.debug(`No filters applied, returning ${allIndustryMetrics.length} metrics`);
      
      // Debug traffic channel data specifically for Industry_Avg
      const trafficChannels = allIndustryMetrics.filter(r => r.metricName === 'Traffic Channels');
      const channelsWithNames = trafficChannels.filter(r => r.channel);
      logger.debug(`Industry_Avg unfiltered traffic channels: Total=${trafficChannels.length}, With names=${channelsWithNames.length}, Sample:`, channelsWithNames.slice(0, 2).map(r => ({ channel: r.channel, value: r.value })));
      
      return allIndustryMetrics;
    }
    
    // Get benchmark companies that match the filters to determine which variations to use
    const companyConditions = [];
    if (filters.businessSize && filters.businessSize !== "All") {
      companyConditions.push(eq(benchmarkCompanies.businessSize, filters.businessSize));
    }
    if (filters.industryVertical && filters.industryVertical !== "All") {
      companyConditions.push(eq(benchmarkCompanies.industryVertical, filters.industryVertical));
    }
    
    // Get matching benchmark companies
    const matchingCompanies = await db
      .select()
      .from(benchmarkCompanies)
      .where(and(...companyConditions));
    
    if (matchingCompanies.length === 0) {
      logger.debug(`No matching companies found for filters`);
      return [];
    }
    
    logger.debug(`Found ${matchingCompanies.length} matching companies:`, matchingCompanies.map(c => c.businessSize));
    
    // Use the data generation logic to create filtered metrics that match the selected filters
    const { generateMetricValue, METRIC_CONFIGS } = await import('./utils/dataGeneratorCore');
    const { generateTimePeriods } = await import('./utils/timePeriodsGenerator');
    const timePeriods = generateTimePeriods();
    
    const filteredMetrics: Metric[] = [];
    
    // Generate filtered metrics by averaging values for matching companies
    // IMPORTANT: Skip Traffic Channels - they need actual database records to preserve channel information
    for (const config of METRIC_CONFIGS) {
      if (config.name === 'Traffic Channels') {
        logger.debug(`Skipping Traffic Channels generation - will use actual database records`);
        continue; // Skip traffic channels - use actual database records instead
      }
      
      let totalValue = 0;
      let companyCount = 0;
      
      // Calculate average for matching companies using the same logic as data generation
      for (const company of matchingCompanies) {
        const value = generateMetricValue(
          config, 
          'Industry_Avg', 
          period, 
          timePeriods, 
          company.businessSize, 
          company.industryVertical
        );
        totalValue += value;
        companyCount++;
      }
      
      if (companyCount > 0) {
        const avgValue = totalValue / companyCount;
        const finalValue = config.name === "Pages per Session" || config.name === "Sessions per User" 
          ? Math.round(avgValue * 10) / 10 
          : Math.round(avgValue);
        
        filteredMetrics.push({
          id: `industry-avg-filtered-${config.name}-${period}`,
          clientId: "", // Not applicable for industry averages
          metricName: config.name,
          value: finalValue.toString(),
          sourceType: 'Industry_Avg' as any,
          timePeriod: period,
          channel: null,
          competitorId: null,
          createdAt: new Date()
        });
        
        if (config.name === "Session Duration") {
          logger.debug(`Generated filtered Session Duration: ${finalValue} (from ${companyCount} companies, avg: ${avgValue})`);
        }
      }
    }
    
    // Add actual Traffic Channels data from database to preserve channel information
    const trafficChannelsFromDB = allIndustryMetrics.filter(m => m.metricName === 'Traffic Channels');
    logger.debug(`Adding ${trafficChannelsFromDB.length} Traffic Channels from database with channel info`);
    logger.debug(`Sample traffic channels from DB:`, trafficChannelsFromDB.slice(0, 3).map(m => ({ channel: m.channel, value: m.value, sourceType: m.sourceType })));
    filteredMetrics.push(...trafficChannelsFromDB);
    
    return filteredMetrics;
  }

  // Get CD Average metrics - NO filtering should ever be applied
  async getFilteredCdAvgMetrics(
    period: string, 
    filters?: { businessSize?: string; industryVertical?: string }
  ): Promise<Metric[]> {
    logger.debug(`getFilteredCdAvgMetrics called with period: ${period}, filters: ${JSON.stringify(filters)} - BUT CD_Avg should NEVER be filtered`);
    
    // CD_Avg should NEVER be filtered by any criteria
    // It always represents the full CD portfolio regardless of industry filters
    logger.debug('CD_Avg should NEVER be filtered - returning all CD metrics for period');
    const allMetrics = await db.select().from(metrics)
      .where(and(
        eq(metrics.sourceType, 'CD_Avg'),
        eq(metrics.timePeriod, period)
      ));
    
    // Debug traffic channel data specifically for CD_Avg
    const trafficChannels = allMetrics.filter(r => r.metricName === 'Traffic Channels');
    const channelsWithNames = trafficChannels.filter(r => r.channel);
    logger.debug(`CD_Avg traffic channels: Total=${trafficChannels.length}, With names=${channelsWithNames.length}, Sample:`, channelsWithNames.slice(0, 2).map(r => ({ channel: r.channel, value: r.value })));
    
    logger.debug(`Returning ${allMetrics.length} unfiltered CD_Avg metrics`);
    return allMetrics;
  }

  // Metrics
  async getMetricsByClient(clientId: string, timePeriod: string): Promise<Metric[]> {
    const results = await db.select().from(metrics).where(
      and(
        or(eq(metrics.clientId, clientId), isNull(metrics.clientId)),
        eq(metrics.timePeriod, timePeriod)
      )
    );
    logger.debug(`getMetricsByClient(${clientId}, ${timePeriod}): ${results.length} metrics, Traffic Channels: ${results.filter(r => r.metricName === 'Traffic Channels').length}`);
    
    // Debug traffic channel data specifically
    const trafficChannels = results.filter(r => r.metricName === 'Traffic Channels');
    const channelsWithNames = trafficChannels.filter(r => r.channel);
    logger.debug(`Traffic channel breakdown: Total=${trafficChannels.length}, With channel names=${channelsWithNames.length}, Sample:`, channelsWithNames.slice(0, 3).map(r => ({ channel: r.channel, sourceType: r.sourceType, value: r.value })));
    
    return results;
  }

  async getMetricsByNameAndPeriod(clientId: string, metricName: string, timePeriod: string, sourceType: string): Promise<Metric[]> {
    return await db.select().from(metrics).where(
      and(
        eq(metrics.clientId, clientId),
        eq(metrics.metricName, metricName),
        eq(metrics.timePeriod, timePeriod),
        eq(metrics.sourceType, sourceType as any)
      )
    );
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    return await this.metricRepo.create(insertMetric);
  }

  async clearMetricsByName(metricName: string): Promise<void> {
    await db.delete(metrics).where(eq(metrics.metricName, metricName));
  }

  async getMetricsByCompetitors(clientId: string, timePeriod: string): Promise<Metric[]> {
    // Get all competitors for this client, then get their metrics
    const clientCompetitors = await db.select().from(competitors).where(eq(competitors.clientId, clientId));
    const competitorIds = clientCompetitors.map(c => c.id);
    
    if (competitorIds.length === 0) {
      return [];
    }
    
    return await db.select().from(metrics).where(
      and(
        inArray(metrics.competitorId, competitorIds),
        eq(metrics.timePeriod, timePeriod)
      )
    );
  }

  // Benchmarks
  async getBenchmarks(metricName: string, industryVertical: string, businessSize: string, timePeriod: string): Promise<Benchmark[]> {
    return await db.select().from(benchmarks).where(
      and(
        eq(benchmarks.metricName, metricName),
        or(eq(benchmarks.industryVertical, industryVertical), eq(benchmarks.industryVertical, "All")),
        or(eq(benchmarks.businessSize, businessSize), eq(benchmarks.businessSize, "All")),
        eq(benchmarks.timePeriod, timePeriod)
      )
    );
  }

  async createBenchmark(insertBenchmark: InsertBenchmark): Promise<Benchmark> {
    return await this.benchmarkRepo.create(insertBenchmark);
  }

  // AI Insights
  async getAIInsights(clientId: string, timePeriod: string): Promise<AIInsight[]> {
    return await db.select().from(aiInsights).where(
      and(
        eq(aiInsights.clientId, clientId),
        eq(aiInsights.timePeriod, timePeriod)
      )
    );
  }

  async createAIInsight(insertInsight: InsertAIInsight): Promise<AIInsight> {
    return await this.aiInsightRepo.create(insertInsight);
  }

  async getAIInsightsByClient(clientId: string, timePeriod?: string): Promise<AIInsight[]> {
    const conditions = [eq(aiInsights.clientId, clientId)];
    
    if (timePeriod) {
      conditions.push(eq(aiInsights.timePeriod, timePeriod));
    }
    
    return await db
      .select()
      .from(aiInsights)
      .where(and(...conditions))
      .orderBy(sql`${aiInsights.createdAt} DESC`);
  }

  async clearAllAIInsights(): Promise<void> {
    await db.delete(aiInsights);
  }

  // Password Reset
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async usePasswordResetToken(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  // Metric Prompts
  async getMetricPrompts(): Promise<MetricPrompt[]> {
    return await db
      .select()
      .from(metricPrompts)
      .where(eq(metricPrompts.isActive, true))
      .orderBy(metricPrompts.metricName);
  }

  async getMetricPrompt(metricName: string): Promise<MetricPrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(metricPrompts)
      .where(eq(metricPrompts.metricName, metricName));
    return prompt || undefined;
  }

  async createMetricPrompt(prompt: InsertMetricPrompt): Promise<MetricPrompt> {
    const [newPrompt] = await db
      .insert(metricPrompts)
      .values(prompt)
      .returning();
    return newPrompt;
  }

  async updateMetricPrompt(metricName: string, prompt: UpdateMetricPrompt): Promise<MetricPrompt | undefined> {
    const [updatedPrompt] = await db
      .update(metricPrompts)
      .set({ ...prompt, updatedAt: new Date() })
      .where(eq(metricPrompts.metricName, metricName))
      .returning();
    return updatedPrompt || undefined;
  }

  async deleteMetricPrompt(metricName: string): Promise<void> {
    await db
      .delete(metricPrompts)
      .where(eq(metricPrompts.metricName, metricName));
  }

  // Global Prompt Template
  async getGlobalPromptTemplate(): Promise<GlobalPromptTemplate | undefined> {
    const [template] = await db
      .select()
      .from(globalPromptTemplate)
      .where(eq(globalPromptTemplate.isActive, true))
      .limit(1);
    return template || undefined;
  }

  async updateGlobalPromptTemplate(template: UpdateGlobalPromptTemplate): Promise<GlobalPromptTemplate | undefined> {
    const [updatedTemplate] = await db
      .update(globalPromptTemplate)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(globalPromptTemplate.isActive, true))
      .returning();
    return updatedTemplate || undefined;
  }

  // Insight Contexts
  async getInsightContext(clientId: string, metricName: string): Promise<InsightContext | undefined> {
    const [context] = await db
      .select()
      .from(insightContexts)
      .where(
        and(
          eq(insightContexts.clientId, clientId),
          eq(insightContexts.metricName, metricName)
        )
      )
      .orderBy(sql`${insightContexts.updatedAt} DESC`)
      .limit(1);
    return context || undefined;
  }

  async createInsightContext(insertContext: InsertInsightContext): Promise<InsightContext> {
    const [context] = await db
      .insert(insightContexts)
      .values(insertContext)
      .returning();
    return context;
  }

  async updateInsightContext(id: string, updateContext: UpdateInsightContext): Promise<InsightContext | undefined> {
    const [context] = await db
      .update(insightContexts)
      .set({ ...updateContext, updatedAt: new Date() })
      .where(eq(insightContexts.id, id))
      .returning();
    return context || undefined;
  }

  async deleteInsightContext(id: string): Promise<void> {
    await db
      .delete(insightContexts)
      .where(eq(insightContexts.id, id));
  }

  async clearAllInsightContexts(): Promise<void> {
    await db.delete(insightContexts);
  }

  // Filter Options
  async getFilterOptions(): Promise<FilterOption[]> {
    return await db.select().from(filterOptions).where(eq(filterOptions.active, true)).orderBy(filterOptions.category, filterOptions.order);
  }

  async getFilterOptionsByCategory(category: string): Promise<FilterOption[]> {
    return await db.select().from(filterOptions).where(
      and(
        eq(filterOptions.category, category),
        eq(filterOptions.active, true)
      )
    ).orderBy(filterOptions.order);
  }

  async createFilterOption(insertOption: InsertFilterOption): Promise<FilterOption> {
    return await this.filterOptionRepo.create(insertOption);
  }

  async updateFilterOption(id: string, updateOption: UpdateFilterOption): Promise<FilterOption | undefined> {
    return await this.filterOptionRepo.update(id, updateOption);
  }

  async getFilterOptionById(id: string): Promise<FilterOption | undefined> {
    const [option] = await db
      .select()
      .from(filterOptions)
      .where(eq(filterOptions.id, id))
      .limit(1);
    return option || undefined;
  }

  async cascadeFilterOptionValueUpdate(category: string, oldValue: string, newValue: string): Promise<void> {
    logger.info(`Starting cascade update: ${category}, ${oldValue} -> ${newValue}`);
    
    // Update all entities that reference this filter option value
    if (category === 'businessSizes') {
      // Update clients
      const clientsResult = await db
        .update(clients)
        .set({ businessSize: newValue })
        .where(eq(clients.businessSize, oldValue))
        .returning({ id: clients.id });
      logger.info(`Updated ${clientsResult.length} clients`);

      // Update benchmark companies
      const benchmarkResult = await db
        .update(benchmarkCompanies)
        .set({ businessSize: newValue })
        .where(eq(benchmarkCompanies.businessSize, oldValue))
        .returning({ id: benchmarkCompanies.id });
      logger.info(`Updated ${benchmarkResult.length} benchmark companies`);

      // Update CD portfolio companies
      const cdPortfolioResult = await db
        .update(cdPortfolioCompanies)
        .set({ businessSize: newValue })
        .where(eq(cdPortfolioCompanies.businessSize, oldValue))
        .returning({ id: cdPortfolioCompanies.id });
      logger.info(`Updated ${cdPortfolioResult.length} CD portfolio companies`);
    } else if (category === 'industryVerticals') {
      // Update clients
      const clientsResult = await db
        .update(clients)
        .set({ industryVertical: newValue })
        .where(eq(clients.industryVertical, oldValue))
        .returning({ id: clients.id });
      logger.info(`Updated ${clientsResult.length} clients`);

      // Update benchmark companies
      const benchmarkResult = await db
        .update(benchmarkCompanies)
        .set({ industryVertical: newValue })
        .where(eq(benchmarkCompanies.industryVertical, oldValue))
        .returning({ id: benchmarkCompanies.id });
      logger.info(`Updated ${benchmarkResult.length} benchmark companies`);

      // Update CD portfolio companies
      const cdPortfolioResult = await db
        .update(cdPortfolioCompanies)
        .set({ industryVertical: newValue })
        .where(eq(cdPortfolioCompanies.industryVertical, oldValue))
        .returning({ id: cdPortfolioCompanies.id });
      logger.info(`Updated ${cdPortfolioResult.length} CD portfolio companies`);
    }
    
    logger.info(`Cascade update completed for ${category}`);
  }

  async deleteFilterOption(id: string): Promise<void> {
    await this.filterOptionRepo.delete(id);
  }
}

export const storage = new DatabaseStorage();
