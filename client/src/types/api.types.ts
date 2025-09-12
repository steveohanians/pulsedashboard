// API Response Types - Based on actual database schema from /shared/schema.ts
export interface Client {
  id: string;
  name: string;
  websiteUrl: string;
  businessSize: string;
  industryVertical: string;
  ga4PropertyId?: string;
  iconUrl?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  clientId?: string;
  status: 'Active' | 'Inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BenchmarkCompany {
  id: string;
  name: string;
  websiteUrl: string;
  businessSize: string;
  industryVertical: string;
  sourceVerified: boolean;
  active: boolean;
  createdAt: Date;
  syncStatus?: "pending" | "processing" | "verified" | "error";
  lastSyncAttempt?: Date;
  lastSyncCompleted?: Date;
}

export interface CDPortfolioCompany {
  id: string;
  name: string;
  websiteUrl: string;
  businessSize: string;
  industryVertical: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

export interface FilterOption {
  id: string;
  type: 'business_size' | 'industry_vertical';
  category: 'businessSizes' | 'industryVerticals';
  value: string;
  label: string;
  order: number;
  sortOrder?: number;
  active: boolean;
}

export interface Metric {
  id: string;
  clientId: string;
  metricName: string;
  value: number | string;
  channel?: string;
  deviceType?: string;
  sourceType: 'Client' | 'Industry_Avg' | 'CD_Avg' | 'Competitor';
  timePeriod: string;
  createdAt: Date;
}

export interface AIInsight {
  id: string;
  clientId: string;
  metricName: string;
  contextText: string;
  insightText: string;
  recommendationText: string;
  status: string;
  timePeriod: string;
  createdAt: Date;
}

export interface GA4ServiceAccount {
  id: string;
  email: string;
  projectId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface MetricPrompt {
  metricName: string;
  description?: string;
  promptTemplate: string;
  isActive: boolean;
  updatedAt: Date;
}

// API Response wrapper types
export interface DashboardData {
  client: Client;
  metrics: Metric[];
  timeSeriesData: Record<string, Metric[]>;
}

export interface FilterData {
  businessSizes: string[];
  industryVerticals: string[];
}

export interface CompanyData {
  company: CDPortfolioCompany;
  metrics: Metric[];
  lastSync?: Date;
}

// Form data interfaces for mutations
export interface CreateClientData {
  name: string;
  websiteUrl: string;
  businessSize: string;
  industryVertical: string;
  ga4PropertyId?: string | null;
  serviceAccountId?: string | null;
}

export interface UpdateClientData {
  name?: string;
  websiteUrl?: string;
  businessSize?: string;
  industryVertical?: string;
  ga4PropertyId?: string | null;
  serviceAccountId?: string | null;
  active?: boolean;
}

export interface CreateUserData {
  name: string;
  email: string;
  role: 'Admin' | 'User';
  clientId?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: 'Admin' | 'User';
  clientId?: string;
  status?: 'Active' | 'Inactive';
}

export interface CreateBenchmarkCompanyData {
  name: string;
  websiteUrl: string;
  businessSize: string;
  industryVertical: string;
}

export interface CreateCDPortfolioCompanyData {
  name: string;
  domain: string;
  industryVertical: string;
  businessSize: string;
}

export interface CreateFilterOptionData {
  type: 'business_size' | 'industry_vertical';
  value: string;
  sortOrder?: number;
}