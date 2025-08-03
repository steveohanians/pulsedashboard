// Consolidated API patterns to eliminate duplicate request/response handling
// This replaces duplicate API patterns across client hooks and server routes

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Standard API response formats
 * Consolidates response patterns from server routes
 */
export const ApiResponses = {
  success: <T>(data: T, message?: string): ApiResponse<T> => ({
    success: true,
    data,
    message
  }),

  error: (message: string, status?: number): ApiResponse => ({
    success: false,
    error: message
  }),

  created: <T>(data: T): ApiResponse<T> => ({
    success: true,
    data,
    message: 'Resource created successfully'
  }),

  updated: <T>(data: T): ApiResponse<T> => ({
    success: true,
    data,
    message: 'Resource updated successfully'
  }),

  deleted: (): ApiResponse => ({
    success: true,
    message: 'Resource deleted successfully'
  }),

  notFound: (resource: string = 'Resource'): ApiResponse => ({
    success: false,
    error: `${resource} not found`
  }),

  unauthorized: (): ApiResponse => ({
    success: false,
    error: 'Unauthorized access'
  }),

  forbidden: (): ApiResponse => ({
    success: false,
    error: 'Forbidden - insufficient permissions'
  }),

  validation: (errors: string[]): ApiResponse => ({
    success: false,
    error: `Validation failed: ${errors.join(', ')}`
  })
};

/**
 * HTTP status codes mapping
 * Consolidates status code patterns
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500
} as const;

/**
 * Common request headers
 * Consolidates header patterns
 */
export const ApiHeaders = {
  JSON: {
    'Content-Type': 'application/json'
  },
  FORM: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  MULTIPART: {
    'Content-Type': 'multipart/form-data'
  }
} as const;

/**
 * Request timeout configurations
 * Consolidates timeout patterns
 */
export const ApiTimeouts = {
  SHORT: 5000,    // 5 seconds
  MEDIUM: 15000,  // 15 seconds
  LONG: 30000,    // 30 seconds
  UPLOAD: 60000   // 60 seconds for file uploads
} as const;

/**
 * Pagination parameters
 * Consolidates pagination patterns
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Query parameter builders
 * Consolidates URL building patterns
 */
export const QueryBuilder = {
  pagination: (params: PaginationParams): string => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', params.page.toString());
    searchParams.set('limit', params.limit.toString());
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    return searchParams.toString();
  },

  filters: (filters: Record<string, string | number | boolean>): string => {
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, value.toString());
      }
    });
    return searchParams.toString();
  },

  combine: (...queryStrings: string[]): string => {
    const combined = queryStrings.filter(Boolean).join('&');
    return combined ? `?${combined}` : '';
  }
};

/**
 * Error handling patterns
 * Consolidates error processing logic
 */
export const ErrorHandlers = {
  network: (error: any): ApiError => ({
    message: 'Network error - please check your connection',
    code: 'NETWORK_ERROR'
  }),

  timeout: (): ApiError => ({
    message: 'Request timed out - please try again',
    code: 'TIMEOUT_ERROR'
  }),

  server: (status: number): ApiError => ({
    message: 'Server error - please try again later',
    status,
    code: 'SERVER_ERROR'
  }),

  parsing: (): ApiError => ({
    message: 'Invalid response format',
    code: 'PARSE_ERROR'
  }),

  generic: (message: string): ApiError => ({
    message: message || 'An unexpected error occurred',
    code: 'GENERIC_ERROR'
  })
};