/**
 * React Query client configuration and API utilities
 * Provides centralized HTTP request handling with error management
 */

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { 
  ERROR_CODES, 
  ErrorCode, 
  StandardErrorResponse, 
  NoDataResponse,
  isErrorResponse,
  isNoDataResponse
} from "@shared/errorTypes";

/**
 * HTTP methods supported by the API request function
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Typed error class for API requests with specific error code handling
 */
export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public hint?: string,
    public retryable: boolean = false,
    public retryAfter?: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Validates response status and creates typed errors for specific error codes
 * @param res The fetch Response object to validate
 * @throws APIError with specific error code and metadata
 */
async function validateResponse(res: Response): Promise<void> {
  if (!res.ok) {
    let errorData: StandardErrorResponse | null = null;
    let fallbackMessage = res.statusText;
    
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          
          // Check if this is a standardized error response
          if (isErrorResponse(json)) {
            errorData = json;
          } else {
            // Legacy error format
            fallbackMessage = json.message || json.error || text;
          }
        } catch {
          fallbackMessage = text;
        }
      }
    } catch {
      // Fallback to status text if can't read response
    }
    
    if (errorData) {
      // Throw typed error with specific code
      throw new APIError(
        errorData.error.code,
        errorData.error.message,
        res.status,
        errorData.error.hint,
        errorData.error.retryable,
        errorData.error.retryAfter,
        errorData.context
      );
    } else {
      // Map HTTP status codes to error codes for legacy responses
      const errorCode = mapStatusToErrorCode(res.status);
      throw new APIError(
        errorCode,
        fallbackMessage,
        res.status,
        undefined,
        isRetryableStatus(res.status)
      );
    }
  }
}

/**
 * Maps HTTP status codes to standardized error codes
 */
function mapStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ERROR_CODES.UNAUTHENTICATED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.CLIENT_NOT_FOUND;
    case 422:
      return ERROR_CODES.SCHEMA_MISMATCH;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    case 503:
      return ERROR_CODES.NETWORK_ERROR;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Determines if an HTTP status is generally retryable
 */
function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

/**
 * Generic API request function with automatic JSON handling and typed error responses
 * @param method HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param url The API endpoint URL
 * @param data Optional request body data
 * @returns Parsed response data, NoDataResponse, or throws APIError
 */
export async function apiRequest(
  method: HttpMethod,
  url: string,
  data?: unknown,
): Promise<any> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await validateResponse(res);
    
    const text = await res.text();
    const responseData = text ? JSON.parse(text) : null;
    
    // Check for no-data responses (successful but empty)
    if (isNoDataResponse(responseData)) {
      console.debug('No data response received:', responseData.meta);
      return responseData;
    }
    
    return responseData;
  } catch (error) {
    // Log error for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('API Request Error:', {
        method,
        url,
        error: error instanceof APIError ? {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          retryable: error.retryable
        } : error
      });
    }
    
    throw error;
  }
}

/**
 * Behavior when receiving 401 Unauthorized responses
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Creates a React Query function with configurable 401 handling
 * @param options Configuration for unauthorized response behavior
 * @returns Query function for use with React Query
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await validateResponse(res);
    return await res.json();
  };

/**
 * Configured React Query client with optimized defaults for the application
 * - 5 minute stale time for caching
 * - No automatic refetching or retries
 * - Session-based authentication support
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
