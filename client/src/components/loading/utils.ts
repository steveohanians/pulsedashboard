/**
 * LoadKit v1 - Utility Functions
 * Timer logic, reduced motion detection, and copy management
 * CRITICAL: Must respect existing timing and behavior
 */

import React, { useEffect, useRef, useState } from 'react'
import type { CopyConfig } from './types'

/**
 * Detects user's reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mediaQuery.matches)
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])
  
  return reducedMotion
}

/**
 * Copy rotation hook - manages timed message switching
 * Only activates when fun copy is enabled and timing thresholds met
 */
export function useCopyRotation(
  config: CopyConfig,
  isActive: boolean,
  enabled: boolean = true
) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showFunCopy, setShowFunCopy] = useState(false)
  const [isStalled, setIsStalled] = useState(false)
  const [opacity, setOpacity] = useState(1)
  
  const rotationTimerRef = useRef<NodeJS.Timeout>()
  const funCopyTimerRef = useRef<NodeJS.Timeout>()
  const stalledTimerRef = useRef<NodeJS.Timeout>()
  const reducedMotion = useReducedMotion()
  
  // Current copy array based on state
  const copyArray = isStalled && config.stalled 
    ? config.stalled
    : showFunCopy && config.fun 
      ? config.fun 
      : config.serious
  
  const currentCopy = copyArray[currentIndex % copyArray.length]
  
  useEffect(() => {
    if (!isActive || !enabled || !config.enableFunCopy) {
      // Reset state when not active
      setShowFunCopy(false)
      setIsStalled(false)
      setCurrentIndex(0)
      setOpacity(1)
      return
    }
    
    // Timer to switch to fun copy after delay
    funCopyTimerRef.current = setTimeout(() => {
      if (config.fun && config.fun.length > 0) {
        setShowFunCopy(true)
      }
    }, config.timingThresholds.funCopyDelay)
    
    // Timer to show stalled message
    stalledTimerRef.current = setTimeout(() => {
      if (config.stalled && config.stalled.length > 0) {
        setIsStalled(true)
      }
    }, config.timingThresholds.stalledThreshold)
    
    return () => {
      clearTimeout(funCopyTimerRef.current)
      clearTimeout(stalledTimerRef.current)
    }
  }, [isActive, enabled, config])
  
  // Rotation timer for cycling through messages
  useEffect(() => {
    if (!isActive || !enabled || !showFunCopy || copyArray.length <= 1) {
      return
    }
    
    const startRotation = () => {
      rotationTimerRef.current = setInterval(() => {
        if (reducedMotion) {
          // No fade animation, just switch
          setCurrentIndex(prev => (prev + 1) % copyArray.length)
        } else {
          // Fade out
          setOpacity(0)
          
          // After fade completes, change message and fade in
          setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % copyArray.length)
            setOpacity(1)
          }, 250) // Half of transition duration
        }
      }, config.timingThresholds.rotationInterval)
    }
    
    startRotation()
    
    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current)
      }
    }
  }, [isActive, enabled, showFunCopy, copyArray.length, reducedMotion, config.timingThresholds.rotationInterval])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(funCopyTimerRef.current)
      clearTimeout(stalledTimerRef.current)
      clearInterval(rotationTimerRef.current)
    }
  }, [])
  
  return {
    currentCopy,
    opacity,
    showFunCopy,
    isStalled,
    currentIndex
  }
}

/**
 * Progress step analyzer - determines step status from content
 * Mirrors brand-signals.tsx logic exactly
 */
export function analyzeProgressStep(
  step: string,
  index: number,
  allSteps: string[]
): 'completed' | 'error' | 'current' | 'pending' {
  const isExplicitlyCompleted = step.includes('✅')
  const isFailed = step.includes('❌')
  const isCurrentStep = 
    index === allSteps.length - 1 && 
    !isExplicitlyCompleted && 
    !isFailed
  const isImplicitlyCompleted = 
    !isExplicitlyCompleted && 
    !isFailed && 
    !isCurrentStep
    
  if (isExplicitlyCompleted || isImplicitlyCompleted) return 'completed'
  if (isFailed) return 'error'
  if (isCurrentStep) return 'current' 
  return 'pending'
}

/**
 * Debounced function for state updates
 * Prevents excessive re-renders during rapid state changes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}

/**
 * Feature flag hook - safely checks flags with fallbacks
 */
export function useFeatureFlag(flag: string): boolean {
  // For now, check environment variables
  // In production, this would integrate with feature flag service
  return process.env[`REACT_APP_${flag}`] === 'true' || false
}

/**
 * Safe component fallback - ensures graceful degradation
 */
export function withSafeFallback<T extends object>(
  Component: React.ComponentType<T>,
  FallbackComponent: React.ComponentType<T>
) {
  return function SafeComponent(props: T) {
    try {
      return React.createElement(Component, props)
    } catch (error) {
      console.error('LoadKit component error:', error)
      return React.createElement(FallbackComponent, props)
    }
  }
}

/**
 * String template replacement - for dynamic copy messages
 */
export function templateReplace(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return String(variables[key] ?? match)
  })
}