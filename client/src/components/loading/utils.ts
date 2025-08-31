/**
 * LoadKit v1 - Utility Functions
 * Timer logic, reduced motion detection, and copy management
 * CRITICAL: Must respect existing timing and behavior
 */

import React, { useEffect, useRef, useState } from 'react'
import type { CopyConfig } from './types'
import { DEFAULT_FLAGS } from './constants'

/**
 * Feature flag hook - safe environment variable access
 */
export function useFeatureFlag(flagName: keyof typeof DEFAULT_FLAGS): boolean {
  // In Vite, environment variables need to be prefixed with VITE_ to be available in the browser
  // But we also check REACT_APP_ for compatibility and import.meta.env for Vite
  const viteEnv = (import.meta.env?.[`VITE_${flagName}`] === 'true')
  const reactEnv = (import.meta.env?.[`REACT_APP_${flagName}`] === 'true')
  const nodeEnv = (process.env?.[`REACT_APP_${flagName}`] === 'true')
  
  return viteEnv || reactEnv || nodeEnv || DEFAULT_FLAGS[flagName]
}

/**
 * LoadKit integration hook - determines if LoadKit should be used for a surface
 */
export function useLoadKit(surface: string) {
  const enabled = useFeatureFlag('LOADKIT_ENABLED')
  
  // Map surface names to flag names
  const surfaceFlagMap: Record<string, keyof typeof DEFAULT_FLAGS> = {
    'dashboard': 'LOADKIT_DASHBOARD',
    'brand-signals': 'LOADKIT_BRAND_SIGNALS',
    'effectiveness': 'LOADKIT_ENABLED',
    'metric-insights': 'LOADKIT_ENABLED', 
    'sov': 'LOADKIT_ENABLED',
  }
  
  const surfaceFlagName = surfaceFlagMap[surface] || 'LOADKIT_ENABLED'
  const surfaceEnabled = useFeatureFlag(surfaceFlagName)
  
  return {
    shouldUse: enabled && surfaceEnabled,
    flags: {
      enabled,
      surfaceEnabled,
      funCopy: useFeatureFlag('LOADKIT_FUN_COPY'),
      newTiming: useFeatureFlag('LOADKIT_NEW_TIMING'),
      visualOnly: useFeatureFlag('LOADKIT_VISUAL_ONLY'),
    }
  }
}

/**
 * Reduced motion detection
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return reducedMotion
}

/**
 * Copy rotation hook - manages timing and message cycling
 */
export interface CopyRotationState {
  currentCopy: string
  opacity: number
  showFunCopy: boolean
}

export function useCopyRotation(
  config: CopyConfig,
  isLoading: boolean,
  enabled: boolean = true
): CopyRotationState {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFunCopy, setShowFunCopy] = useState(false)
  const [opacity, setOpacity] = useState(1)
  const [isStalled, setIsStalled] = useState(false)
  

  const startTimeRef = useRef<number>(Date.now())
  const rotationTimerRef = useRef<NodeJS.Timeout>()
  const funCopyTimerRef = useRef<NodeJS.Timeout>()
  const stalledTimerRef = useRef<NodeJS.Timeout>()
  const fadeTimerRef = useRef<NodeJS.Timeout>()

  const reducedMotion = useReducedMotion()

  // Reset when loading starts
  useEffect(() => {
    if (isLoading) {
      startTimeRef.current = Date.now()
      setCurrentIndex(0)
      setShowFunCopy(false)
      setIsStalled(false)
      setOpacity(1)
    }
  }, [isLoading])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current)
      if (funCopyTimerRef.current) clearTimeout(funCopyTimerRef.current)
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  // Fun copy timer (3s delay)
  useEffect(() => {
    console.log('Fun copy timer check:', { isLoading, enabled, enableFunCopy: config.enableFunCopy, surface: config.surface })
    
    if (!isLoading || !enabled || !config.enableFunCopy) {
      console.log('Fun copy timer NOT starting - conditions not met')
      return
    }

    console.log('Fun copy timer STARTING - 100ms delay for surface:', config.surface)
    funCopyTimerRef.current = setTimeout(() => {
      console.log('Fun copy timer FIRED! Setting showFunCopy to true for surface:', config.surface)
      setShowFunCopy(true)
    }, 100) // Immediate delay for testing

    return () => {
      if (funCopyTimerRef.current) {
        console.log('Clearing fun copy timer for surface:', config.surface)
        clearTimeout(funCopyTimerRef.current)
      }
    }
  }, [isLoading, enabled, config.enableFunCopy])

  // Stalled timer (8s delay)
  useEffect(() => {
    if (!isLoading || !enabled) return

    stalledTimerRef.current = setTimeout(() => {
      setIsStalled(true)
    }, 8000) // 8 second delay for stalled state

    return () => {
      if (stalledTimerRef.current) clearTimeout(stalledTimerRef.current)
    }
  }, [isLoading, enabled])

  // Message rotation timer (4.5s intervals)
  useEffect(() => {
    if (!isLoading || !enabled || (!showFunCopy && !isStalled)) return

    rotationTimerRef.current = setInterval(() => {
      if (reducedMotion) {
        // No fade animation for reduced motion
        setCurrentIndex(prev => {
          const messages = isStalled ? (config.stalled || config.serious) :
                          showFunCopy ? (config.fun || config.serious) :
                          config.serious
          return (prev + 1) % messages.length
        })
      } else {
        // Fade out
        setOpacity(0)
        
        fadeTimerRef.current = setTimeout(() => {
          // Change message
          setCurrentIndex(prev => {
            const messages = isStalled ? (config.stalled || config.serious) :
                            showFunCopy ? (config.fun || config.serious) :
                            config.serious
            return (prev + 1) % messages.length
          })
          
          // Fade in
          setOpacity(1)
        }, 250) // Half of transition duration
      }
    }, 4500) // 4.5 second rotation

    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [isLoading, enabled, showFunCopy, isStalled, reducedMotion, config])

  // Get current message
  const getCurrentCopy = (): string => {
    if (!isLoading) return ''

    const messages = isStalled ? (config.stalled || config.serious) :
                    showFunCopy ? (config.fun || config.serious) :
                    config.serious

    return messages[currentIndex] || messages[0] || 'Loading...'
  }

  return {
    currentCopy: getCurrentCopy(),
    opacity: reducedMotion ? 1 : opacity,
    showFunCopy: showFunCopy && config.enableFunCopy,
  }
}

/**
 * Safe fallback wrapper - ensures LoadKit failures don't break existing functionality
 */
export function withSafeFallback<P>(
  Component: React.ComponentType<P>,
  Fallback: React.ComponentType<P>
): React.ComponentType<P> {
  return function SafeComponent(props: P) {
    try {
      return React.createElement(Component, props)
    } catch (error) {
      console.error('LoadKit component error, falling back:', error)
      return React.createElement(Fallback, props)
    }
  }
}