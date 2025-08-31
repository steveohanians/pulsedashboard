/**
 * LoadKit v1 - Standardized Loading Spinner
 * Replaces all inconsistent spinner implementations with unified component
 * CRITICAL: Must preserve existing visual behavior exactly
 */

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseLoadingState, LoadingSize, LoadingVariant } from './types'
import { LOADING_SIZES, LOADING_COLORS } from './constants'

export interface LoadingSpinnerProps extends BaseLoadingState {
  size?: LoadingSize
  variant?: LoadingVariant
  text?: string
  showText?: boolean
  centered?: boolean
  'aria-label'?: string
  style?: React.CSSProperties
}

/**
 * Main LoadingSpinner component - standardizes all spinner usage
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  text,
  showText = false,
  centered = false,
  className,
  'aria-label': ariaLabel,
  style,
}: LoadingSpinnerProps) {
  const spinnerSize = LOADING_SIZES[size]
  const spinnerColor = LOADING_COLORS[variant]
  const textColor = LOADING_COLORS.label

  const spinner = (
    <Loader2 
      className={cn(
        spinnerSize,
        spinnerColor,
        'animate-spin',
        className
      )}
      aria-label={ariaLabel}
      style={style}
    />
  )

  if (!showText || !text) {
    return spinner
  }

  const content = (
    <>
      {spinner}
      <span className={cn('text-sm font-medium', textColor)}>
        {text}
      </span>
    </>
  )

  if (centered) {
    return (
      <div className="flex items-center justify-center gap-3">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {content}
    </div>
  )
}

/**
 * Button-specific loading spinner - for consistent button loading states
 */
export interface ButtonLoadingSpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}

export function ButtonLoadingSpinner({ 
  size = 'sm', 
  className 
}: ButtonLoadingSpinnerProps) {
  return (
    <LoadingSpinner
      size={size}
      variant="default"
      className={className}
      showText={false}
      centered={false}
    />
  )
}

/**
 * Inline loading spinner - for text-embedded loading indicators
 */
export interface InlineLoadingSpinnerProps {
  size?: 'xs' | 'sm'
  className?: string
}

export function InlineLoadingSpinner({ 
  size = 'xs', 
  className 
}: InlineLoadingSpinnerProps) {
  return (
    <LoadingSpinner
      size={size}
      variant="muted"
      className={className}
      showText={false}
      centered={false}
    />
  )
}