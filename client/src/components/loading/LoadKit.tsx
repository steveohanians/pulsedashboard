/**
 * LoadKit v1 - Main Orchestrator Component
 * Provides unified loading experience with behavioral cloning
 * CRITICAL: Must never break existing functionality
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { LoadingSpinner } from './LoadingSpinner'
import { useCopyRotation, useFeatureFlag, withSafeFallback } from './utils'
import { FUN_COPY_CONFIGS, A11Y_CONFIG } from './constants'
import type { 
  DashboardLoadingState, 
  BrandSignalsLoadingState, 
  LoadingSurface,
  CopyConfig 
} from './types'

/**
 * Core LoadKit component - handles copy rotation and timing
 */
interface LoadKitCoreProps {
  isLoading: boolean
  surface: LoadingSurface
  children: React.ReactNode
  className?: string
  customCopy?: string[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showSpinner?: boolean
  spinnerVariant?: 'default' | 'muted'
}

function LoadKitCore({
  isLoading,
  surface,
  children,
  className,
  customCopy,
  size = 'md',
  showSpinner = true,
  spinnerVariant = 'default'
}: LoadKitCoreProps) {
  const enabled = useFeatureFlag('LOADKIT_ENABLED')
  const funCopyEnabled = useFeatureFlag('LOADKIT_FUN_COPY')
  
  
  // Get copy configuration for this surface
  const copyConfig = FUN_COPY_CONFIGS[surface] || FUN_COPY_CONFIGS['dashboard']
  const effectiveConfig: CopyConfig = customCopy 
    ? { ...copyConfig, serious: customCopy, enableFunCopy: false }
    : { ...copyConfig, enableFunCopy: funCopyEnabled && copyConfig.enableFunCopy }
    
  console.log('LoadKit.Core Config:', { 
    surface, 
    copyConfigFun: copyConfig.enableFunCopy,
    effectiveConfigFun: effectiveConfig.enableFunCopy,
    funMessages: copyConfig.fun?.length 
  })
  
  // Manage copy rotation
  const { currentCopy, opacity, showFunCopy } = useCopyRotation(
    effectiveConfig,
    isLoading,
    enabled
  )
  
  console.log('LoadKit.Core Render:', {
    surface,
    isLoading,
    enabled,
    showFunCopy,
    currentCopy,
    opacity,
    showSpinner,
    effectiveConfigFun: effectiveConfig.enableFunCopy
  })
  
  if (!isLoading) {
    console.log('LoadKit.Core: NOT loading, returning children')
    return <>{children}</>
  }
  
  console.log('LoadKit.Core: IS loading, rendering loading state with currentCopy:', currentCopy)
  
  return (
    <div 
      className={cn("flex flex-col items-center justify-center", className)}
      role={A11Y_CONFIG.role}
      aria-live={A11Y_CONFIG['aria-live']}
      aria-busy={A11Y_CONFIG['aria-busy']}
    >
      {showSpinner && (
        <LoadingSpinner 
          size={size}
          variant={spinnerVariant}
          text={currentCopy}
          showText={true}
          centered={true}
          className={cn(
            showFunCopy && "transition-opacity duration-500 ease-in-out"
          )}
          style={{ opacity }}
        />
      )}
      
      {/* Screen reader gets serious copy only */}
      <span className="sr-only">
        {effectiveConfig.serious[0] || 'Loading, please wait'}
      </span>
    </div>
  )
}

/**
 * Dashboard LoadKit - mirrors dashboard.tsx loading behavior exactly
 */
interface LoadKitDashboardProps {
  state: DashboardLoadingState
  children: React.ReactNode
  className?: string
}

function LoadKitDashboard({ state, children, className }: LoadKitDashboardProps) {
  const enabled = useFeatureFlag('LOADKIT_DASHBOARD')
  
  if (!enabled) {
    return <>{children}</>
  }
  
  // Mirror exact logic from dashboard.tsx:298
  const showLoading = state.isLoading || state.isRefreshing
  
  if (!showLoading) {
    return <>{children}</>
  }
  
  // Simple skeleton without recursive LoadKit components
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Skeleton - exact copy from dashboard.tsx */}
      <div className="bg-gradient-to-r from-white to-slate-50/80 border-b border-slate-200 px-4 sm:px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="h-8 w-24 sm:h-10 sm:w-32 bg-slate-200 rounded animate-pulse"></div>
            <div className="hidden sm:block">
              <div className="h-4 w-32 sm:h-5 sm:w-40 bg-slate-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-20 sm:w-24 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-slate-200 rounded animate-pulse lg:hidden"></div>
            <div className="h-8 w-16 sm:w-20 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* LoadKit loading indicator */}
      <div className="p-4 sm:p-6 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Brand Signals LoadKit - mirrors brand-signals.tsx behavior exactly
 */
interface LoadKitBrandSignalsProps {
  state: BrandSignalsLoadingState
  children: React.ReactNode
  className?: string
}

function LoadKitBrandSignals({ state, children, className }: LoadKitBrandSignalsProps) {
  const enabled = useFeatureFlag('LOADKIT_BRAND_SIGNALS')
  
  if (!enabled || !state.isAnalyzing) {
    return <>{children}</>
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      <LoadKitCore
        isLoading={state.isAnalyzing}
        surface="brand-signals"
        size="md"
      >
        {children}
      </LoadKitCore>
      
      {/* Progress steps - exact logic from brand-signals.tsx:476-520 */}
      {state.progressSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">
            Analysis Progress:
          </h4>
          {state.progressSteps.map((step, index) => {
            const isExplicitlyCompleted = step.includes("✅")
            const isFailed = step.includes("❌")
            const isCurrentStep = 
              index === state.progressSteps.length - 1 &&
              !isExplicitlyCompleted &&
              !isFailed
            const isImplicitlyCompleted =
              !isExplicitlyCompleted && 
              !isFailed && 
              !isCurrentStep

            return (
              <div
                key={index}
                className="flex items-center space-x-3 text-sm"
              >
                <div className="flex-shrink-0">
                  {(isExplicitlyCompleted || isImplicitlyCompleted) && (
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 text-xs font-bold">✓</span>
                    </div>
                  )}
                  {isFailed && (
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 text-xs font-bold">✕</span>
                    </div>
                  )}
                  {isCurrentStep && (
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                      <LoadingSpinner 
                        size="xs" 
                        showText={false} 
                        centered={false}
                        className="text-blue-600"
                      />
                    </div>
                  )}
                </div>
                <span className={cn(
                  isExplicitlyCompleted || isImplicitlyCompleted ? "text-green-700" :
                  isFailed ? "text-red-700" :
                  isCurrentStep ? "text-blue-700" : "text-slate-600"
                )}>
                  {step}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Create safe fallback versions
const SafeLoadKitDashboard = withSafeFallback(LoadKitDashboard, ({ children }) => <>{children}</>)
const SafeLoadKitBrandSignals = withSafeFallback(LoadKitBrandSignals, ({ children }) => <>{children}</>)

/**
 * Card LoadKit - for individual card loading states
 */
interface LoadKitCardProps {
  isLoading: boolean
  children: React.ReactNode
  className?: string
  surface?: LoadingSurface
  loadingText?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

function LoadKitCard({ 
  isLoading, 
  children, 
  className, 
  surface = 'dashboard', 
  loadingText,
  size = 'md' 
}: LoadKitCardProps) {
  const enabled = useFeatureFlag('LOADKIT_CARDS')
  
  if (!enabled || !isLoading) {
    return <>{children}</>
  }
  
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <LoadingSpinner 
        size={size}
        text={loadingText}
        showText={!!loadingText}
        centered={true}
      />
    </div>
  )
}

// Create safe fallback version
const SafeLoadKitCard = withSafeFallback(LoadKitCard, ({ children }) => <>{children}</>)

/**
 * LoadKit namespace - provides all loading components
 */
export const LoadKit = {
  Core: LoadKitCore,
  Dashboard: SafeLoadKitDashboard,
  BrandSignals: SafeLoadKitBrandSignals,
  Card: SafeLoadKitCard,
} as const

export default LoadKit