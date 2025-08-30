/**
 * LoadKit Debug Indicator
 * Shows when LoadKit is active for testing purposes
 */

import React from 'react'
import { useLoadKit } from '@/hooks/useLoadKit'

export function LoadKitDebugIndicator() {
  const { enabled, flags } = useLoadKit()
  
  if (!enabled) return null
  
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono">
      <div className="font-bold">🚀 LoadKit v1 Active</div>
      <div className="text-blue-100 mt-1">
        {flags.LOADKIT_DASHBOARD && '📊 Dashboard '}
        {flags.LOADKIT_BRAND_SIGNALS && '📡 Signals '}
        {flags.LOADKIT_FUN_COPY && '🎉 Fun '}
      </div>
    </div>
  )
}

/**
 * Enhanced LoadingSpinner with visual indicator
 */
import { LoadingSpinner as BaseLoadingSpinner } from './LoadingSpinner'
import type { LoadingSpinnerProps } from './LoadingSpinner'

export function LoadingSpinner(props: LoadingSpinnerProps) {
  const { enabled } = useLoadKit()
  
  return (
    <div className="relative">
      <BaseLoadingSpinner {...props} />
      {enabled && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse" 
             title="LoadKit Active" />
      )}
    </div>
  )
}