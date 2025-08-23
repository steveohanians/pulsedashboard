import { z } from 'zod';

export const commonValidations = {
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  url: z.string().url("Please enter a valid URL").or(z.literal("")),
  required: z.string().min(1, "This field is required"),
  optional: z.string().optional(),

  companyName: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be less than 100 characters"),

  websiteUrl: z.string()
    .url("Please enter a valid website URL")
    .refine(
      (url) => !url.includes('localhost') && !url.includes('127.0.0.1'),
      "Please enter a public website URL"
    ),

  industryVertical: z.string().min(1, "Please select a valid industry vertical"),
  businessSize: z.string().min(1, "Please select a valid business size"),
};

export const fieldValidators = {
  email: (value: string) => {
    const emailSchema = commonValidations.email;
    const result = emailSchema.safeParse(value);
    return result.success ? null : result.error.errors[0].message;
  },

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

  required: (value: any, fieldName: string = "This field") => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return null;
  },
};

export const formSchemas = {
  login: z.object({
    email: commonValidations.email,
    password: z.string().min(1, "Password is required"),
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

export const formatFormErrors = {
  fromZodError: (error: z.ZodError): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};

    error.errors.forEach((err) => {
      const field = err.path.join('.');
      fieldErrors[field] = err.message;
    });

    return fieldErrors;
  },

  fromApiError: (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return "An unexpected error occurred. Please try again.";
  },

  getFieldError: (errors: Record<string, string>, fieldName: string): string | undefined => {
    return errors[fieldName];
  },
};

export const formHelpers = {
  hasErrors: (errors: Record<string, string>): boolean => {
    return Object.keys(errors).length > 0;
  },

  getFirstError: (errors: Record<string, string>): string | undefined => {
    const keys = Object.keys(errors);
    return keys.length > 0 ? errors[keys[0]] : undefined;
  },

  clearFieldError: (errors: Record<string, string>, fieldName: string): Record<string, string> => {
    const { [fieldName]: removed, ...rest } = errors;
    return rest;
  },

  validateField: (value: any, schema: z.ZodSchema): string | null => {
    const result = schema.safeParse(value);
    return result.success ? null : result.error.errors[0]?.message || "Invalid value";
  },
};