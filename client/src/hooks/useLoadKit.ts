/**
 * LoadKit v1 - Feature Flag Hook
 * Safe feature flag system with environment variable fallbacks
 * CRITICAL: Defaults to disabled for maximum safety
 */

import { useMemo } from 'react'

export interface LoadKitFlags {
  LOADKIT_ENABLED: boolean
  LOADKIT_DASHBOARD: boolean  
  LOADKIT_BRAND_SIGNALS: boolean
  LOADKIT_FUN_COPY: boolean
  LOADKIT_NEW_TIMING: boolean
  LOADKIT_VISUAL_ONLY: boolean
}

/**
 * Central feature flag hook for LoadKit
 * Checks environment variables with safe defaults
 */
export function useLoadKitFlags(): LoadKitFlags {
  return useMemo(() => ({
    // Master switch - everything disabled until explicitly enabled
    LOADKIT_ENABLED: process.env.REACT_APP_LOADKIT_ENABLED === 'true',
    
    // Component-specific flags
    LOADKIT_DASHBOARD: process.env.REACT_APP_LOADKIT_DASHBOARD === 'true',
    LOADKIT_BRAND_SIGNALS: process.env.REACT_APP_LOADKIT_BRAND_SIGNALS === 'true',
    
    // Feature-specific flags
    LOADKIT_FUN_COPY: process.env.REACT_APP_LOADKIT_FUN_COPY === 'true',
    LOADKIT_NEW_TIMING: process.env.REACT_APP_LOADKIT_NEW_TIMING === 'true',
    LOADKIT_VISUAL_ONLY: process.env.REACT_APP_LOADKIT_VISUAL_ONLY === 'true',
  }), [])
}

/**
 * Individual feature flag checker
 */
export function useLoadKitFlag(flag: keyof LoadKitFlags): boolean {
  const flags = useLoadKitFlags()
  
  // Master switch must be enabled for any other flag to work
  if (!flags.LOADKIT_ENABLED) {
    return false
  }
  
  return flags[flag]
}

/**
 * Safe LoadKit usage hook - determines if LoadKit should be used
 */
export function useLoadKit(component?: 'dashboard' | 'brand-signals') {
  const flags = useLoadKitFlags()
  
  // Master switch check
  if (!flags.LOADKIT_ENABLED) {
    return {
      enabled: false,
      shouldUse: false,
      flags
    }
  }
  
  // Component-specific check
  const componentEnabled = component 
    ? flags[`LOADKIT_${component.toUpperCase().replace('-', '_')}` as keyof LoadKitFlags]
    : true
    
  return {
    enabled: flags.LOADKIT_ENABLED,
    shouldUse: componentEnabled,
    flags
  }
}

/**
 * Development helper - shows current flag status
 */
export function useLoadKitDebug(): {
  flags: LoadKitFlags
  envVars: Record<string, string | undefined>
  recommendations: string[]
} {
  const flags = useLoadKitFlags()
  
  const envVars = {
    REACT_APP_LOADKIT_ENABLED: process.env.REACT_APP_LOADKIT_ENABLED,
    REACT_APP_LOADKIT_DASHBOARD: process.env.REACT_APP_LOADKIT_DASHBOARD,
    REACT_APP_LOADKIT_BRAND_SIGNALS: process.env.REACT_APP_LOADKIT_BRAND_SIGNALS,
    REACT_APP_LOADKIT_FUN_COPY: process.env.REACT_APP_LOADKIT_FUN_COPY,
    REACT_APP_LOADKIT_NEW_TIMING: process.env.REACT_APP_LOADKIT_NEW_TIMING,
    REACT_APP_LOADKIT_VISUAL_ONLY: process.env.REACT_APP_LOADKIT_VISUAL_ONLY,
  }
  
  const recommendations: string[] = []
  
  if (!flags.LOADKIT_ENABLED) {
    recommendations.push('Set REACT_APP_LOADKIT_ENABLED=true to enable LoadKit')
  }
  
  if (flags.LOADKIT_ENABLED && !flags.LOADKIT_DASHBOARD && !flags.LOADKIT_BRAND_SIGNALS) {
    recommendations.push('Enable at least one component: REACT_APP_LOADKIT_DASHBOARD or REACT_APP_LOADKIT_BRAND_SIGNALS')
  }
  
  if (flags.LOADKIT_FUN_COPY && (!flags.LOADKIT_DASHBOARD && !flags.LOADKIT_BRAND_SIGNALS)) {
    recommendations.push('Fun copy requires a component to be enabled')
  }
  
  return {
    flags,
    envVars,
    recommendations
  }
}