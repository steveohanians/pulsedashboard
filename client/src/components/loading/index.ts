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
  LoadingSurface,
  LoadingSize,
  LoadingVariant,
  CopyConfig,
  AccessibilityConfig,
  TimerConfig,
} from './types'

// Utils
export {
  useFeatureFlag,
  useLoadKit,
  useReducedMotion,
  useCopyRotation,
  withSafeFallback,
} from './utils'

// Constants
export {
  LOADING_SIZES,
  LOADING_COLORS,
  TIMING,
  A11Y_CONFIG,
  FUN_COPY_CONFIGS,
  DEFAULT_FLAGS,
} from './constants'