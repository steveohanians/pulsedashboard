// Import and export all service classes
import { BaseService } from './base.service';
import { AuthService } from './auth.service';
import { ClientService } from './client.service';
import { UserService } from './user.service';
import { CompetitorService } from './competitor.service';
import { BenchmarkService } from './benchmark.service';
import { PortfolioService } from './portfolio.service';
import { FilterService } from './filter.service';
import { GA4Service } from './ga4.service';
import { InsightService } from './insight.service';
import { MetricService } from './metric.service';
import { DashboardService } from './dashboard.service';

// Export all service classes
export {
  BaseService,
  AuthService,
  ClientService,
  UserService,
  CompetitorService,
  BenchmarkService,
  PortfolioService,
  FilterService,
  GA4Service,
  InsightService,
  MetricService,
  DashboardService,
};

// Create and export singleton instances
export const authService = new AuthService();
export const clientService = new ClientService();
export const userService = new UserService();
export const competitorService = new CompetitorService();
export const benchmarkService = new BenchmarkService();
export const portfolioService = new PortfolioService();
export const filterService = new FilterService();
export const ga4Service = new GA4Service();
export const insightService = new InsightService();
export const metricService = new MetricService();
export const dashboardService = new DashboardService();

// Export all as a single services object for convenience
export const services = {
  auth: authService,
  client: clientService,
  user: userService,
  competitor: competitorService,
  benchmark: benchmarkService,
  portfolio: portfolioService,
  filter: filterService,
  ga4: ga4Service,
  insight: insightService,
  metric: metricService,
  dashboard: dashboardService,
} as const;

// Export types for TypeScript
export type Services = typeof services;
export type ServiceName = keyof Services;