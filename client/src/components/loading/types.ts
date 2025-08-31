/**
 * LoadKit v1 - Core Types
 * Defines all loading state interfaces for systematic replacement
 * CRITICAL: These types must perfectly mirror existing behavior
 */

export type LoadingSize = 'xs' | 'sm' | 'md' | 'lg'
export type LoadingVariant = 'default' | 'muted'
export type LoadingSurface = 'dashboard' | 'brand-signals' | 'effectiveness' | 'metric-insights' | 'sov'

/**
 * Base loading state - foundation for all components
 */
export interface BaseLoadingState {
  isLoading: boolean
  className?: string
}

/**
 * Dashboard loading state - mirrors useDashboardData exactly
 */
export interface DashboardLoadingState extends BaseLoadingState {
  isLoading: boolean         // From React Query
  isRefreshing: boolean      // Manual refresh state
  filtersLoading: boolean    // Filter dropdowns
  combinationsLoading: boolean // Smart filters
  insightsLoading: boolean   // AI insights generation
}

/**
 * Brand Signals loading state - mirrors component state exactly
 */
export interface BrandSignalsLoadingState extends BaseLoadingState {
  isLoading: boolean              // Always false for brand signals
  isAnalyzing: boolean            // Main analysis state
  progressSteps: string[]         // Step accumulator array
  activeAnalysisType: 'main' | 'test' | null // Which analysis running
  currentStep: number             // Derived from steps.length
  errorMessage?: string           // Error state
}

/**
 * Copy configuration for different surfaces
 */
export interface CopyConfig {
  surface: LoadingSurface
  serious: string[]              // Default serious messages
  fun?: string[]                 // Optional fun messages (only for approved surfaces)
  stalled?: string[]             // Stalled state messages (≥8s)
  enableFunCopy: boolean         // Whether fun copy is allowed for this surface
}

/**
 * Accessibility configuration
 */
export interface AccessibilityConfig {
  role: 'status'
  'aria-live': 'polite'
  'aria-busy': 'true'
}

/**
 * Timer configuration for copy rotation
 */
export interface TimerConfig {
  funCopyDelay: number          // 3000ms - when to switch to fun copy
  rotationInterval: number      // 4500ms - how often to rotate messages
  stalledThreshold: number      // 8000ms - when to show stalled messages
  fadeTransition: number        // 500ms - fade duration
}