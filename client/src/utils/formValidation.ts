// Centralized form validation utilities
// Consolidates validation patterns found across form components

import { z } from 'zod';

/**
 * Common validation schemas
 * Consolidates repeated validation patterns across forms
 */
export const commonValidations = {
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  url: z.string().url("Please enter a valid URL").or(z.literal("")),
  required: z.string().min(1, "This field is required"),
  optional: z.string().optional(),

  // Business-specific validations
  companyName: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters"),

  websiteUrl: z.string()
    .url("Please enter a valid website URL")
    .refine(
      (url) => !url.includes('localhost') && !url.includes('127.0.0.1'),
      "Please enter a public website URL"
    ),

  // Dynamic validation - validates against filter_options API
  industryVertical: z.string().min(1, "Please select a valid industry vertical"),
  businessSize: z.string().min(1, "Please select a valid business size"),
};

/**
 * Form field validation helpers
 * Standardizes field validation across components
 */
export const fieldValidators = {
  /**
   * Validate email format and common business rules
   */
  email: (value: string) => {
    const emailSchema = commonValidations.email;
    const result = emailSchema.safeParse(value);
    return result.success ? null : result.error.errors[0].message;
  },

  /**
   * Validate password strength
   */
  password: (value: string) => {
    const errors: string[] = [];

    if (value.length < 8) {
      errors.push("At least 8 characters");
    }
    if (!/[A-Z]/.test(value)) {
      errors.push("One uppercase letter");
    }
    if (!/[a-z]/.test(value)) {
      errors.push("One lowercase letter");
    }
    if (!/\d/.test(value)) {
      errors.push("One number");
    }

    return errors.length > 0 ? `Password must contain: ${errors.join(", ")}` : null;
  },

  /**
   * Validate URL format and accessibility
   */
  url: (value: string) => {
    if (!value) return null;

    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return "URL must use HTTP or HTTPS protocol";
      }
      return null;
    } catch {
      return "Please enter a valid URL";
    }
  },

  /**
   * Validate required fields with custom messages
   */
  required: (value: any, fieldName: string = "This field") => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },
};

/**
 * Common form schemas
 * Pre-built schemas for frequently used forms
 */
export const formSchemas = {
  login: z.object({
    email: commonValidations.email,
    password: z.string().min(1, "Password is required"),
  }),

  register: z.object({
    name: commonValidations.required,
    email: commonValidations.email,
    password: commonValidations.password,
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),

  client: z.object({
    name: commonValidations.companyName,
    websiteUrl: commonValidations.websiteUrl,
    industryVertical: commonValidations.industryVertical,
    businessSize: commonValidations.businessSize,
    ga4PropertyId: commonValidations.optional,
  }),

  competitor: z.object({
    domain: commonValidations.websiteUrl,
    label: z.string()
      .min(2, "Label must be at least 2 characters")
      .max(50, "Label must be less than 50 characters"),
  }),

  user: z.object({
    name: commonValidations.required,
    email: commonValidations.email,
    role: z.enum(["Admin", "User"]),
  }),

  passwordReset: z.object({
    email: commonValidations.email,
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: commonValidations.password,
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }),
};

/**
 * Form error formatting utilities
 * Standardizes error display across forms
 */
export const formatFormErrors = {
  /**
   * Convert Zod errors to field-specific error messages
   */
  fromZodError: (error: z.ZodError): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};

    error.errors.forEach((err) => {
      const field = err.path.join('.');
      fieldErrors[field] = err.message;
    });

    return fieldErrors;
  },

  /**
   * Convert API errors to displayable format
   */
  fromApiError: (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return "An unexpected error occurred. Please try again.";
  },

  /**
   * Get field-specific error message
   */
  getFieldError: (errors: Record<string, string>, fieldName: string): string | undefined => {
    return errors[fieldName];
  },
};

/**
 * Form state management utilities
 * Helpers for managing form state consistently
 */
export const formHelpers = {
  /**
   * Check if form has any errors
   */
  hasErrors: (errors: Record<string, string>): boolean => {
    return Object.keys(errors).length > 0;
  },

  /**
   * Get first error message for display
   */
  getFirstError: (errors: Record<string, string>): string | undefined => {
    const keys = Object.keys(errors);
    return keys.length > 0 ? errors[keys[0]] : undefined;
  },

  /**
   * Clear specific field errors
   */
  clearFieldError: (errors: Record<string, string>, fieldName: string): Record<string, string> => {
    const { [fieldName]: removed, ...rest } = errors;
    return rest;
  },

  /**
   * Validate single field
   */
  validateField: (value: any, schema: z.ZodSchema): string | null => {
    const result = schema.safeParse(value);
    return result.success ? null : result.error.errors[0]?.message || "Invalid value";
  },
};