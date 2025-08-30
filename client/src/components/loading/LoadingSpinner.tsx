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
  /** Display text below spinner (optional) */
  text?: string
  /** Text size class - separate from icon size */  
  textSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg'
  /** Show text below spinner */
  showText?: boolean
  /** Centered layout (like original LoadingSpinner) */
  centered?: boolean
  /** Padding around component */
  padding?: string
}

/**
 * Standardized spinner that replaces:
 * - Original LoadingSpinner component
 * - All Loader2 instances in loading contexts  
 * - RefreshCw in loading contexts (not refresh actions)
 * 
 * Preserves exact visual behavior while standardizing implementation
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'default', 
  text,
  textSize,
  showText = !!text,
  centered = true,
  padding = 'p-8',
  className,
  'aria-label': ariaLabel,
  ...props
}: LoadingSpinnerProps) {
  
  // Size mapping to preserve existing visual appearance
  const iconClasses = LOADING_SIZES[size]
  
  // Color mapping based on variant
  const colorClasses = variant === 'muted' 
    ? LOADING_COLORS.muted 
    : LOADING_COLORS.primary
    
  // Text size defaults based on spinner size
  const defaultTextSize = {
    xs: 'text-xs',
    sm: 'text-sm', 
    md: 'text-base',
    lg: 'text-lg'
  }[size]
  
  const textClasses = textSize || defaultTextSize
  
  // Container classes for layout
  const containerClasses = cn(
    centered && 'flex flex-col items-center justify-center',
    centered && padding,
    className
  )
  
  const spinnerClasses = cn(
    iconClasses,
    colorClasses,
    'animate-spin',
    showText && centered && 'mb-2'
  )
  
  const textElementClasses = cn(
    textClasses,
    'text-slate-600 font-medium'
  )

  return (
    <div 
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel || text || 'Loading'}
      {...props}
    >
      <Loader2 className={spinnerClasses} />
      
      {showText && text && (
        <p className={textElementClasses}>
          {text}
        </p>
      )}
      
      {/* Screen reader only text - always serious */}
      <span className="sr-only">
        {ariaLabel || text || 'Loading, please wait'}
      </span>
    </div>
  )
}

/**
 * Button loading spinner - optimized for button contexts
 * Replaces all Loader2 instances in buttons
 */
export function ButtonLoadingSpinner({
  size = 'sm',
  className,
  ...props
}: Omit<LoadingSpinnerProps, 'text' | 'showText' | 'centered' | 'padding'>) {
  
  return (
    <Loader2 
      className={cn(
        LOADING_SIZES[size],
        'animate-spin',
        className
      )}
      role="status"
      aria-hidden="true" // Button text handles accessibility
      {...props}
    />
  )
}

/**
 * Inline loading spinner - for in-content loading states
 * Replaces inline Loader2 instances
 */
export function InlineLoadingSpinner({
  size = 'xs',
  className,
  ...props
}: Omit<LoadingSpinnerProps, 'text' | 'showText' | 'centered' | 'padding'>) {
  
  return (
    <Loader2
      className={cn(
        LOADING_SIZES[size],
        LOADING_COLORS.primary,
        'animate-spin inline-block',
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    />
  )
}

export default LoadingSpinner