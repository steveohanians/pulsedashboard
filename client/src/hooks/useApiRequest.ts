/**
 * Centralized API request hook
 * Consolidates API request patterns found across multiple components
 * Provides mutation handling with toast notifications and query invalidation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import React, { useState } from 'react';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  invalidateQueries?: string[];
  showToast?: boolean;
}

/**
 * Generic API request hook
 * Consolidates repeated patterns for API calls with error handling and toast notifications
 */
export function useApiRequest<TData = unknown, TVariables = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
) {
  const {
    method = 'POST',
    onSuccess,
    onError,
    successMessage,
    errorMessage,
    invalidateQueries = [],
    showToast = true
  } = options;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables): Promise<TData> => {
      const requestOptions: RequestInit = { method };
      
      if (method !== 'GET' && variables) {
        requestOptions.body = JSON.stringify(variables);
        requestOptions.headers = {
          'Content-Type': 'application/json',
        };
      }

      const response = await fetch(endpoint, requestOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate specified queries
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });

      // Show success toast
      if (showToast && successMessage) {
        toast({
          title: "Success",
          description: successMessage,
        });
      }

      // Call custom success handler
      onSuccess?.(data);
    },
    onError: (error, variables) => {
      // Show error toast
      if (showToast) {
        toast({
          title: "Error",
          description: errorMessage || error.message || "An error occurred",
          variant: "destructive",
        });
      }

      // Call custom error handler
      onError?.(error);
    },
  });
}

/**
 * Data fetching hook with standardized error handling
 * Consolidates query patterns across components
 */
export function useApiQuery<TData = unknown>(
  queryKey: string | string[],
  endpoint?: string,
  options: {
    enabled?: boolean;
    refetchInterval?: number;
    onError?: (error: Error) => void;
    showErrorToast?: boolean;
  } = {}
) {
  const { onError, showErrorToast = true } = options;
  const { toast } = useToast();
  
  const keyArray = Array.isArray(queryKey) ? queryKey : [queryKey];
  const actualEndpoint = endpoint || keyArray[0];

  const query = useQuery<TData>({
    queryKey: keyArray,
    queryFn: async (): Promise<TData> => {
      const response = await fetch(actualEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: options.enabled,
    refetchInterval: options.refetchInterval,
  });

  // Handle errors in useEffect for TanStack Query v5
  React.useEffect(() => {
    if (query.error) {
      if (showErrorToast) {
        toast({
          title: "Error",
          description: query.error.message || "Failed to fetch data",
          variant: "destructive",
        });
      }
      onError?.(query.error);
    }
  }, [query.error, showErrorToast, onError, toast]);

  return query;
}

/**
 * Optimistic update hook
 * Handles optimistic updates with rollback on error
 */
export function useOptimisticUpdate<TData, TVariables>(
  queryKey: string[],
  endpoint: string,
  options: ApiRequestOptions & {
    optimisticUpdate?: (oldData: TData, variables: TVariables) => TData;
  } = {}
) {
  const { optimisticUpdate, ...requestOptions } = options;
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables): Promise<TData> => {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(variables),
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    onMutate: async (variables) => {
      if (!optimisticUpdate) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update
      if (previousData) {
        queryClient.setQueryData<TData>(queryKey, optimisticUpdate(previousData, variables));
      }

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context && typeof context === 'object' && 'previousData' in context && context.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      requestOptions.onError?.(error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

/**
 * Form submission hook
 * Consolidates form submission patterns with loading states
 */
export function useFormSubmission<TData = unknown, TVariables = unknown>(
  endpoint: string,
  options: ApiRequestOptions & {
    resetForm?: () => void;
  } = {}
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resetForm, ...requestOptions } = options;

  const mutation = useApiRequest<TData, TVariables>(endpoint, {
    ...requestOptions,
    onSuccess: (data) => {
      setIsSubmitting(false);
      resetForm?.();
      requestOptions.onSuccess?.(data);
    },
    onError: (error) => {
      setIsSubmitting(false);
      requestOptions.onError?.(error);
    },
  });

  const submit = (data: TVariables) => {
    setIsSubmitting(true);
    mutation.mutate(data);
  };

  return {
    submit,
    isSubmitting: isSubmitting || mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}