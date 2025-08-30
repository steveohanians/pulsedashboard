/**
 * LoadKit v1 - Main Export
 * Centralized loading system for consistent user experience
 */

export { LoadKit as default } from './LoadKit'
export { LoadingSpinner, ButtonLoadingSpinner, InlineLoadingSpinner } from './LoadingSpinner'

// Types
export type {
  BaseLoadingState,
  DashboardLoadingState,
  BrandSignalsLoadingState,
  ButtonLoadingState,
  ProgressState,
  CopyConfig,
  AccessibilityConfig,
  LoadKitFeatureFlags,
  LoadingSize,
  LoadingVariant,
  LoadingSurface
} from './types'

// Constants
export {
  LOADING_SIZES,
  LOADING_COLORS,
  TIMING,
  SERIOUS_COPY,
  FUN_COPY_CONFIGS,
  A11Y_CONFIG,
  DEFAULT_FEATURE_FLAGS,
  BRAND_SIGNALS_CONSTANTS
} from './constants'

// Utils
export {
  useReducedMotion,
  useCopyRotation,
  analyzeProgressStep,
  useDebounce,
  useFeatureFlag,
  withSafeFallback,
  templateReplace
} from './utils'