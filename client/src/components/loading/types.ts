/**
 * LoadKit v1 - Core Types
 * Defines all loading state interfaces for systematic replacement
 * CRITICAL: These types must perfectly mirror existing behavior
 */

export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg'
export type LoadingVariant = 'default' | 'muted'
export type LoadingSurface = 'dashboard' | 'brand-signals' | 'effectiveness' | 'metric-insights' | 'sov'

/**
 * Core loading state that mirrors existing patterns
 */
export interface BaseLoadingState {
  isLoading?: boolean
  variant?: LoadingVariant
  size?: LoadingSize
  className?: string
  'aria-label'?: string
}

/**
 * Dashboard loading state - mirrors useDashboardData exactly
 */
export interface DashboardLoadingState extends BaseLoadingState {
  isLoading: boolean           // Direct from useDashboardData.isLoading
  isRefreshing: boolean        // Direct from useState in dashboard.tsx:85
  filtersLoading: boolean      // Direct from useDashboardFilters
  combinationsLoading: boolean // Direct from useSmartFilterCombinations
  insightsLoading: boolean     // Direct from useDashboardData.insightsLoading
}

/**
 * Brand Signals loading state - mirrors exact useState patterns
 */
export interface BrandSignalsLoadingState extends BaseLoadingState {
  isAnalyzing: boolean                           // Direct from useState:37
  progressSteps: string[]                        // Direct from useState:39
  activeAnalysisType: 'main' | 'test' | null   // Direct from useState:45
  currentStep: number                            // Derived from progressSteps.length
  errorMessage: string                           // Direct from useState:44
}

/**
 * Button loading state - mirrors existing button patterns
 */
export interface ButtonLoadingState {
  isLoading: boolean
  disabled: boolean
  loadingText: string
  normalText: string
  size: LoadingSize
  icon?: 'loader' | 'refresh' | 'sparkles'
}

/**
 * Progress indicator state - mirrors brand signals progress exactly
 */
export interface ProgressState {
  steps: string[]
  currentIndex: number
  status: 'pending' | 'current' | 'completed' | 'error'
}

/**
 * Copy configuration - defines serious vs fun copy rules
 */
export interface CopyConfig {
  surface: LoadingSurface
  serious: string[]
  fun?: string[]
  stalled?: string[]
  enableFunCopy: boolean
  timingThresholds: {
    funCopyDelay: number    // 3000ms
    rotationInterval: number // 4500ms
    stalledThreshold: number // 8000ms
  }
}

/**
 * Accessibility configuration - additive only, never breaking
 */
export interface AccessibilityConfig {
  'aria-live': 'polite' | 'assertive'
  'role': 'status' | 'progressbar'
  'aria-busy': boolean
  screenReaderText: string // Always serious, never fun
  announceSteps: boolean
}

/**
 * Feature flag configuration - safety switches
 */
export interface LoadKitFeatureFlags {
  LOADKIT_ENABLED: boolean
  LOADKIT_DASHBOARD: boolean
  LOADKIT_BRAND_SIGNALS: boolean
  LOADKIT_FUN_COPY: boolean
  LOADKIT_NEW_TIMING: boolean
  LOADKIT_VISUAL_ONLY: boolean
}