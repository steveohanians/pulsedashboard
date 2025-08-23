// Consolidated form validation schemas to eliminate duplicate Zod schemas across frontend and backend
// This replaces duplicate validation logic in multiple components and routes

import { z } from 'zod';
import { VALIDATION_LIMITS } from './validationPatterns';

/**
 * User login schemas
 * Consolidates login validation logic
 */
export const loginSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .max(VALIDATION_LIMITS.MAX_EMAIL_LENGTH, `Email must be less than ${VALIDATION_LIMITS.MAX_EMAIL_LENGTH} characters`),
  password: z.string()
    .min(VALIDATION_LIMITS.MIN_PASSWORD_LENGTH, `Password must be at least ${VALIDATION_LIMITS.MIN_PASSWORD_LENGTH} characters`)
    .max(VALIDATION_LIMITS.MAX_PASSWORD_LENGTH, `Password must be less than ${VALIDATION_LIMITS.MAX_PASSWORD_LENGTH} characters`)
});



/**
 * Client management schemas
 * Consolidates client creation/update validation
 */
export const clientSchema = z.object({
  name: z.string()
    .min(1, "Client name is required")
    .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, `Name must be less than ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`),
  email: z.string()
    .email("Invalid email format")
    .max(VALIDATION_LIMITS.MAX_EMAIL_LENGTH, `Email must be less than ${VALIDATION_LIMITS.MAX_EMAIL_LENGTH} characters`),
  url: z.string()
    .url("Invalid URL format")
    .max(VALIDATION_LIMITS.MAX_URL_LENGTH, `URL must be less than ${VALIDATION_LIMITS.MAX_URL_LENGTH} characters`)
    .optional(),
  businessSize: z.string()
    .min(1, "Business size is required"),
  industryVertical: z.string()
    .min(1, "Industry vertical is required"),
  isActive: z.boolean().default(true)
});

/**
 * Competitor management schemas
 * Consolidates competitor creation/update validation
 */
export const competitorSchema = z.object({
  name: z.string()
    .min(1, "Competitor name is required")
    .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, `Name must be less than ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`),
  url: z.string()
    .url("Invalid URL format")
    .max(VALIDATION_LIMITS.MAX_URL_LENGTH, `URL must be less than ${VALIDATION_LIMITS.MAX_URL_LENGTH} characters`),
  clientId: z.string()
    .min(1, "Client ID is required"),
  businessSize: z.string()
    .min(1, "Business size is required"),
  industryVertical: z.string()
    .min(1, "Industry vertical is required"),
  isActive: z.boolean().default(true)
});

/**
 * Benchmark company schemas
 * Consolidates benchmark company validation
 */
export const benchmarkCompanySchema = z.object({
  name: z.string()
    .min(1, "Company name is required")
    .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, `Name must be less than ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`),
  url: z.string()
    .url("Invalid URL format")
    .max(VALIDATION_LIMITS.MAX_URL_LENGTH, `URL must be less than ${VALIDATION_LIMITS.MAX_URL_LENGTH} characters`),
  businessSize: z.string()
    .min(1, "Business size is required"),
  industryVertical: z.string()
    .min(1, "Industry vertical is required"),
  isActive: z.boolean().default(true)
});

/**
 * CD Portfolio company schemas
 * Consolidates CD portfolio company validation
 */
export const cdPortfolioCompanySchema = z.object({
  name: z.string()
    .min(1, "Company name is required")
    .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, `Name must be less than ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`),
  url: z.string()
    .url("Invalid URL format")
    .max(VALIDATION_LIMITS.MAX_URL_LENGTH, `URL must be less than ${VALIDATION_LIMITS.MAX_URL_LENGTH} characters`),
  businessSize: z.string()
    .min(1, "Business size is required"),
  industryVertical: z.string()
    .min(1, "Industry vertical is required"),
  isActive: z.boolean().default(true)
});

/**
 * Filter option schemas
 * Consolidates filter creation/update validation
 */
export const filterOptionSchema = z.object({
  type: z.enum(['business_size', 'industry_vertical']),
  value: z.string()
    .min(1, "Filter value is required")
    .max(VALIDATION_LIMITS.MAX_NAME_LENGTH, `Value must be less than ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters`),
  isActive: z.boolean().default(true)
});

/**
 * AI prompt template schemas
 * Consolidates AI prompt validation
 */
export const promptTemplateSchema = z.object({
  template: z.string()
    .min(10, "Template must be at least 10 characters")
    .max(VALIDATION_LIMITS.MAX_PROMPT_LENGTH, `Template must be less than ${VALIDATION_LIMITS.MAX_PROMPT_LENGTH} characters`)
});

/**
 * User context input schemas
 * Consolidates user input validation for AI insights
 */
export const userContextSchema = z.object({
  context: z.string()
    .max(VALIDATION_LIMITS.MAX_INPUT_LENGTH, `Context must be less than ${VALIDATION_LIMITS.MAX_INPUT_LENGTH} characters`)
    .optional()
});

/**
 * Common ID validation schema
 * Consolidates UUID/ID validation patterns
 */
export const idSchema = z.string().uuid("Invalid ID format");

/**
 * Pagination schemas
 * Consolidates pagination validation
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1, "Page must be at least 1").default(1),
  limit: z.coerce.number().min(1, "Limit must be at least 1").max(100, "Limit cannot exceed 100").default(20)
});

/**
 * Type exports for consistent typing
 */
export type LoginInput = z.infer<typeof loginSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type CompetitorInput = z.infer<typeof competitorSchema>;
export type BenchmarkCompanyInput = z.infer<typeof benchmarkCompanySchema>;
export type CdPortfolioCompanyInput = z.infer<typeof cdPortfolioCompanySchema>;
export type FilterOptionInput = z.infer<typeof filterOptionSchema>;
export type PromptTemplateInput = z.infer<typeof promptTemplateSchema>;
export type UserContextInput = z.infer<typeof userContextSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;