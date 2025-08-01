import { 
  clients, users, competitors, benchmarkCompanies, cdPortfolioCompanies, metrics, benchmarks, aiInsights, passwordResetTokens, metricPrompts,
  type Client, type InsertClient,
  type User, type InsertUser,
  type Competitor, type InsertCompetitor,
  type BenchmarkCompany, type InsertBenchmarkCompany,
  type CdPortfolioCompany, type InsertCdPortfolioCompany,
  type Metric, type InsertMetric,
  type Benchmark, type InsertBenchmark,
  type AIInsight, type InsertAIInsight,
  type PasswordResetToken, type InsertPasswordResetToken,
  type MetricPrompt, type InsertMetricPrompt, type UpdateMetricPrompt
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, isNull, inArray, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

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
  createMetric(metric: InsertMetric): Promise<Metric>;
  
  // Benchmarks
  getBenchmarks(metricName: string, industryVertical: string, businessSize: string, timePeriod: string): Promise<Benchmark[]>;
  createBenchmark(benchmark: InsertBenchmark): Promise<Benchmark>;
  
  // AI Insights
  getAIInsights(clientId: string, timePeriod: string): Promise<AIInsight[]>;
  getAIInsightsByClient(clientId: string, timePeriod?: string): Promise<AIInsight[]>;
  createAIInsight(insight: InsertAIInsight): Promise<AIInsight>;
  
  // Password Reset
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  usePasswordResetToken(token: string): Promise<void>;
  
  // Metric Prompts
  getMetricPrompts(): Promise<MetricPrompt[]>;
  getMetricPrompt(metricName: string): Promise<MetricPrompt | undefined>;
  createMetricPrompt(prompt: InsertMetricPrompt): Promise<MetricPrompt>;
  updateMetricPrompt(metricName: string, prompt: UpdateMetricPrompt): Promise<MetricPrompt | undefined>;
  deleteMetricPrompt(metricName: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: false,  // We already created the table manually
      tableName: 'sessions'  // Explicit table name
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, updateUser: Partial<InsertUser & { lastLogin?: Date }>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updateUser)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.active, true));
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  async updateClient(id: string, updateClient: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updateClient)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }



  // Competitors
  async getCompetitorsByClient(clientId: string): Promise<Competitor[]> {
    return await db.select().from(competitors).where(eq(competitors.clientId, clientId));
  }

  async createCompetitor(insertCompetitor: InsertCompetitor): Promise<Competitor> {
    const [competitor] = await db
      .insert(competitors)
      .values(insertCompetitor)
      .returning();
    return competitor;
  }

  async deleteCompetitor(id: string): Promise<void> {
    // First delete all metrics associated with this competitor
    await db.delete(metrics).where(eq(metrics.competitorId, id));
    
    // Then delete the competitor
    await db.delete(competitors).where(eq(competitors.id, id));
  }



  // Benchmark Companies
  async getBenchmarkCompanies(): Promise<BenchmarkCompany[]> {
    return await db.select().from(benchmarkCompanies).where(eq(benchmarkCompanies.active, true));
  }

  async createBenchmarkCompany(insertCompany: InsertBenchmarkCompany): Promise<BenchmarkCompany> {
    const [company] = await db
      .insert(benchmarkCompanies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async updateBenchmarkCompany(id: string, updateCompany: Partial<InsertBenchmarkCompany>): Promise<BenchmarkCompany | undefined> {
    const [company] = await db
      .update(benchmarkCompanies)
      .set(updateCompany)
      .where(eq(benchmarkCompanies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteBenchmarkCompany(id: string): Promise<void> {
    await db.delete(benchmarkCompanies).where(eq(benchmarkCompanies.id, id));
  }

  // CD Portfolio Companies
  async getCdPortfolioCompanies(): Promise<CdPortfolioCompany[]> {
    return await db.select().from(cdPortfolioCompanies).where(eq(cdPortfolioCompanies.active, true));
  }

  async createCdPortfolioCompany(insertCompany: InsertCdPortfolioCompany): Promise<CdPortfolioCompany> {
    const [company] = await db
      .insert(cdPortfolioCompanies)
      .values(insertCompany)
      .returning();
    return company;
  }

  async updateCdPortfolioCompany(id: string, updateCompany: Partial<InsertCdPortfolioCompany>): Promise<CdPortfolioCompany | undefined> {
    const [company] = await db
      .update(cdPortfolioCompanies)
      .set(updateCompany)
      .where(eq(cdPortfolioCompanies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCdPortfolioCompany(id: string): Promise<void> {
    await db.delete(cdPortfolioCompanies).where(eq(cdPortfolioCompanies.id, id));
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
    // Query benchmarks table with filters
    const conditions = [
      eq(benchmarks.sourceType, 'Industry_Avg'),
      eq(benchmarks.timePeriod, period)
    ];
    
    if (filters?.businessSize && filters.businessSize !== "All") {
      conditions.push(eq(benchmarks.businessSize, filters.businessSize));
    }
    
    if (filters?.industryVertical && filters.industryVertical !== "All") {
      conditions.push(eq(benchmarks.industryVertical, filters.industryVertical));
    }
    
    const benchmarkData = await db
      .select()
      .from(benchmarks)
      .where(and(...conditions));
    
    if (benchmarkData.length === 0) {
      return [];
    }
    
    // Group by metric and calculate averages
    const groupedMetrics: Record<string, number[]> = {};
    
    benchmarkData.forEach(benchmark => {
      if (!groupedMetrics[benchmark.metricName]) {
        groupedMetrics[benchmark.metricName] = [];
      }
      groupedMetrics[benchmark.metricName].push(parseFloat(benchmark.value as string));
    });
    
    // Calculate averages and return as Metric objects
    const averagedMetrics: Metric[] = Object.entries(groupedMetrics).map(([metricName, values]) => {
      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      const finalValue = metricName === "Pages per Session" || metricName === "Sessions per User" 
        ? Math.round(avgValue * 10) / 10 
        : Math.round(avgValue);
      
      return {
        id: `industry-avg-${metricName}-${period}`,
        clientId: "", // Not applicable for industry averages
        metricName,
        value: finalValue.toString(),
        sourceType: 'Industry_Avg' as any,
        timePeriod: period,
        channel: null,
        competitorId: null,
        createdAt: new Date()
      };
    });
    
    return averagedMetrics;
  }

  // Metrics
  async getMetricsByClient(clientId: string, timePeriod: string): Promise<Metric[]> {
    return await db.select().from(metrics).where(
      and(
        or(eq(metrics.clientId, clientId), isNull(metrics.clientId)),
        eq(metrics.timePeriod, timePeriod)
      )
    );
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    const [metric] = await db
      .insert(metrics)
      .values(insertMetric)
      .returning();
    return metric;
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
    const [benchmark] = await db
      .insert(benchmarks)
      .values(insertBenchmark)
      .returning();
    return benchmark;
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
    const [insight] = await db
      .insert(aiInsights)
      .values(insertInsight)
      .returning();
    return insight;
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
}

export const storage = new DatabaseStorage();
