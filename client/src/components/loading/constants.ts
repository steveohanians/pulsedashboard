/**
 * LoadKit v1 - Core Constants  
 * Centralized configuration for consistent loading behavior
 * CRITICAL: Values must preserve existing timing and behavior
 */

import type { LoadingSize, CopyConfig, AccessibilityConfig, TimerConfig } from './types'

/**
 * Standardized size scale - maps to exact pixel values
 */
export const LOADING_SIZES: Record<LoadingSize, string> = {
  xs: 'h-3 w-3',    // 12px - for small indicators
  sm: 'h-4 w-4',    // 16px - for buttons and inline
  md: 'h-5 w-5',    // 20px - for section loading
  lg: 'h-6 w-6',    // 24px - for page loading
} as const

/**
 * Color standardization - consistent across all loading states
 */
export const LOADING_COLORS = {
  default: 'text-primary',
  muted: 'text-muted-foreground',
  label: 'text-muted-foreground',
} as const

/**
 * Timing configuration - matches existing behavior exactly
 */
export const TIMING: TimerConfig = {
  funCopyDelay: 3000,        // Show serious copy first 3 seconds
  rotationInterval: 4500,    // Rotate messages every 4.5 seconds
  stalledThreshold: 8000,    // Show stalled message at 8 seconds
  fadeTransition: 500,       // 500ms fade transition
} as const

/**
 * Accessibility configuration - screen reader optimized
 */
export const A11Y_CONFIG: AccessibilityConfig = {
  role: 'status',
  'aria-live': 'polite',
  'aria-busy': 'true',
} as const

/**
 * Fun copy configuration for each approved surface
 * CRITICAL: Only these surfaces are allowed fun copy
 */
export const FUN_COPY_CONFIGS: Record<string, CopyConfig> = {
  'effectiveness': {
    surface: 'effectiveness',
    enableFunCopy: true,
    serious: [
      'Analyzing website effectiveness...',
      'Processing effectiveness criteria...',
      'Generating effectiveness report...',
    ],
    fun: [
      'Exploring your site like a friendly sleuth',
      'Scanning pixels and copy for clues',
      'Reading between the lines and <div>s',
      'Peeking under the hood—gently',
      'Snapping pixel-perfect screenshots',
      'Framing each page like a pro photo shoot',
      'Training our model on your brand signals',
      'Running 127 effectiveness checks (for real)',
      'Scoring for 8 effectiveness criteria signals',
      'Predicting how first-time visitors will feel',
      'Asking the big one: does this drive action?',
      'Packaging clear, do-this-next recommendations',
    ],
    stalled: [
      'Still working—confirming a few page details',
      'Almost there—double-checking our checks',
    ],
  },

  'sov': {
    surface: 'sov',
    enableFunCopy: true,
    serious: [
      'Analyzing share of voice...',
      'Processing brand mentions...',
      'Generating SOV report...',
    ],
    fun: [
      'Asking AI models about your brand and rivals',
      'Counting how often you get name-checked',
      'Comparing answers across models and prompts',
      'Untangling name twins before we count',
      'Separating direct mentions from subtle nods',
      'Keeping score: your mentions versus the field',
      'Rolling counts into clear share of voice',
      'Noting who gets top billing most often',
      'Saving quotable snippets for context',
      'Watching for answer drift across runs',
      'Highlighting where you lead—and where you lag',
      'Recommending next moves worth testing',
    ],
    stalled: [
      'Still listening—the models are thinking it through',
      'Almost done—double-checking name matches',
      'One moment—normalizing totals for a fair compare',
      'Finishing up—confirming who gets top billing',
    ],
  },

  'metric-insights': {
    surface: 'metric-insights',
    enableFunCopy: true,
    serious: [
      'Generating AI insights...',
      'Analyzing metric patterns...',
      'Processing recommendations...',
    ],
    fun: [
      'Scanning KPIs and segments for clues',
      'Reading between trends and outliers',
      'Peeking under the funnel—gently',
      'Linking behaviors to outcomes, not clicks',
      'Weighing speed, clarity, and credibility',
      'Checking CTAs for clarity and intent',
      'Surfacing patterns your team can act on',
      'Ranking fixes by impact versus effort',
      'Comparing periods to rule out seasonality',
      'Validating findings against real sessions',
      'Estimating likely lift from quick wins',
      'Packaging concise, do-this-next insights',
    ],
    stalled: [
      'Still working—verifying anomalies across sources',
      'Cross-checking segments to confirm the signal',
      'Resolving conflicting patterns before we commit',
      'Crunching a few more comparisons—almost there',
    ],
  },

  // Default fallback for surfaces without fun copy
  'dashboard': {
    surface: 'dashboard',
    enableFunCopy: false,
    serious: [
      'Loading dashboard...',
      'Processing data...',
      'Refreshing metrics...',
    ],
    stalled: [
      'Still loading data...',
      'Almost ready...',
    ],
  },

  'brand-signals': {
    surface: 'brand-signals',
    enableFunCopy: false,
    serious: [
      'Analyzing brand signals...',
      'Processing competitor data...',
      'Generating analysis...',
    ],
    stalled: [
      'Still analyzing...',
      'Almost complete...',
    ],
  },
} as const

/**
 * Feature flag defaults - all disabled for maximum safety
 */
export const DEFAULT_FLAGS = {
  LOADKIT_ENABLED: false,
  LOADKIT_DASHBOARD: false,
  LOADKIT_BRAND_SIGNALS: false,
  LOADKIT_CARDS: false,
  LOADKIT_FUN_COPY: false,
  LOADKIT_NEW_TIMING: false,
  LOADKIT_VISUAL_ONLY: false,
} as const