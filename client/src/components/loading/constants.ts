/**
 * LoadKit v1 - Core Constants  
 * Centralized configuration for consistent loading behavior
 * CRITICAL: Values must preserve existing timing and behavior
 */

import type { LoadingSize, CopyConfig, AccessibilityConfig } from './types'

/**
 * Standardized size scale - maps to exact pixel values
 * Based on audit findings, standardized to 4-step scale
 */
export const LOADING_SIZES: Record<LoadingSize, string> = {
  xs: 'h-3 w-3',   // 12px - for progress indicators
  sm: 'h-4 w-4',   // 16px - for buttons (most common)
  md: 'h-6 w-6',   // 24px - for inline loading
  lg: 'h-8 w-8'    // 32px - for page-level loading
} as const

/**
 * Color tokens - standardized from audit
 */
export const LOADING_COLORS = {
  primary: 'text-primary',
  muted: 'text-muted-foreground',
  slate: 'text-slate-600'
} as const

/**
 * Timing constants - CRITICAL: Must preserve existing behavior
 */
export const TIMING = {
  // Brand signals exact timing (from brand-signals.tsx:185,192)
  BRAND_SIGNALS_FIRST_STEP: 500,   // "Analyzing against competitors"
  BRAND_SIGNALS_SECOND_STEP: 1000, // "Processing... 2-3 minutes"
  
  // LoadKit enhancement timing (only when enabled)
  FUN_COPY_DELAY: 3000,       // Switch to fun copy after 3s
  ROTATION_INTERVAL: 4500,    // Rotate messages every 4.5s  
  STALLED_THRESHOLD: 8000,    // Show stalled message at 8s
  
  // Animation timing
  FADE_DURATION: 500,         // Copy fade transition (matches effectiveness-card.tsx:317)
  SPINNER_ANIMATION: 'animate-spin', // Standard tailwind spin
  PULSE_ANIMATION: 'animate-pulse'   // For skeletons
} as const

/**
 * Serious copy defaults - used everywhere initially
 */
export const SERIOUS_COPY = {
  loading: 'Loading...',
  processing: 'Processing...',
  analyzing: 'Analyzing...',
  generating: 'Generating...',
  preparing: 'Preparing...',
  initializing: 'Initializing...',
  scoring: 'Scoring...',
  fetching: 'Fetching...'
} as const

/**
 * Fun copy configurations by surface
 * CRITICAL: Only enabled for approved surfaces
 */
export const FUN_COPY_CONFIGS: Record<string, CopyConfig> = {
  effectiveness: {
    surface: 'effectiveness',
    enableFunCopy: true,
    serious: [SERIOUS_COPY.analyzing, SERIOUS_COPY.processing],
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
      'Packaging clear, do-this-next recommendations'
    ],
    stalled: [
      'Still working—confirming a few page details',
      'Almost there—double-checking our checks'
    ],
    timingThresholds: {
      funCopyDelay: TIMING.FUN_COPY_DELAY,
      rotationInterval: TIMING.ROTATION_INTERVAL,
      stalledThreshold: TIMING.STALLED_THRESHOLD
    }
  },
  
  'sov': {
    surface: 'sov',
    enableFunCopy: true,
    serious: [SERIOUS_COPY.analyzing, SERIOUS_COPY.processing],
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
      'Recommending next moves worth testing'
    ],
    stalled: [
      'Still listening—the models are thinking it through',
      'Almost done—double-checking name matches',
      'One moment—normalizing totals for a fair compare',
      'Finishing up—confirming who gets top billing'
    ],
    timingThresholds: {
      funCopyDelay: TIMING.FUN_COPY_DELAY,
      rotationInterval: TIMING.ROTATION_INTERVAL,
      stalledThreshold: TIMING.STALLED_THRESHOLD
    }
  },

  'metric-insights': {
    surface: 'metric-insights', 
    enableFunCopy: true,
    serious: [SERIOUS_COPY.analyzing, SERIOUS_COPY.generating],
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
      'Packaging concise, do-this-next insights'
    ],
    stalled: [
      'Still working—verifying anomalies across sources',
      'Cross-checking segments to confirm the signal',
      'Resolving conflicting patterns before we commit',
      'Crunching a few more comparisons—almost there'
    ],
    timingThresholds: {
      funCopyDelay: TIMING.FUN_COPY_DELAY,
      rotationInterval: TIMING.ROTATION_INTERVAL,
      stalledThreshold: TIMING.STALLED_THRESHOLD
    }
  },

  // Serious-only surfaces
  'dashboard': {
    surface: 'dashboard',
    enableFunCopy: false,
    serious: [SERIOUS_COPY.loading, SERIOUS_COPY.processing],
    timingThresholds: {
      funCopyDelay: 0,
      rotationInterval: 0,
      stalledThreshold: 0
    }
  },

  'brand-signals': {
    surface: 'brand-signals',
    enableFunCopy: false, // Start serious, enable later
    serious: [SERIOUS_COPY.analyzing, SERIOUS_COPY.processing],
    timingThresholds: {
      funCopyDelay: 0,
      rotationInterval: 0,
      stalledThreshold: 0
    }
  }
} as const

/**
 * Accessibility defaults - additive only
 */
export const A11Y_CONFIG: AccessibilityConfig = {
  'aria-live': 'polite',
  'role': 'status', 
  'aria-busy': true,
  screenReaderText: SERIOUS_COPY.loading, // Always serious for SR
  announceSteps: true
} as const

/**
 * Feature flag defaults - everything disabled by default for safety
 */
export const DEFAULT_FEATURE_FLAGS = {
  LOADKIT_ENABLED: false,
  LOADKIT_DASHBOARD: false,
  LOADKIT_BRAND_SIGNALS: false,
  LOADKIT_FUN_COPY: false,
  LOADKIT_NEW_TIMING: false,
  LOADKIT_VISUAL_ONLY: false
} as const

/**
 * Brand signals specific constants - preserve exact existing behavior
 */
export const BRAND_SIGNALS_CONSTANTS = {
  // Exact progress messages from brand-signals.tsx
  PROGRESS_MESSAGES: {
    MAIN_START: 'Starting analysis...',
    MAIN_COMPETITORS: 'Analyzing against {count} competitors',
    MAIN_PROCESSING: 'Processing... This may take 2-3 minutes',
    TEST_START: 'Starting test analysis for {brand}...',
    TEST_COMPETITORS: 'Analyzing against well-known competitors',
    TEST_PROCESSING: 'Processing... This may take 2-3 minutes',
    SUCCESS_PREFIX: '✅',
    ERROR_PREFIX: '❌ Error:'
  },
  
  // Button text patterns
  BUTTON_TEXT: {
    MAIN_NORMAL: 'Run Analysis',
    MAIN_LOADING: 'Analyzing...',
    TEST_NORMAL: 'Test Analysis', 
    TEST_LOADING: 'Analyzing...'
  }
} as const