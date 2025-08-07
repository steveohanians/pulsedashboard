/**
 * React Query client configuration and API utilities
 * Provides centralized HTTP request handling with error management
 */

import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * HTTP methods supported by the API request function
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Validates response status and extracts error messages from failed requests
 * @param res The fetch Response object to validate
 * @throws Error with descriptive message if response is not ok
 */
async function validateResponse(res: Response): Promise<void> {
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      const text = await res.text();
      if (text) {
        // Try to parse as JSON first
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          // Not JSON, use raw text
          errorMessage = text;
        }
      }
    } catch {
      // Fallback to status text if can't read response
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Generic API request function with automatic JSON handling
 * @param method HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param url The API endpoint URL
 * @param data Optional request body data
 * @returns Parsed response data or raw text
 */
export async function apiRequest(
  method: HttpMethod,
  url: string,
  data?: unknown,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await validateResponse(res);
  
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
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
