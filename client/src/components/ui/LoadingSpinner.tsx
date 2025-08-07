/**
 * Consistent loading spinner component
 * Provides a centered loading indicator with customizable size and text
 */
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Size variant for the spinner */
  size?: 'sm' | 'md' | 'lg';
  /** Loading text to display */
  text?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading spinner with animated icon and text
 * @param size - Controls icon and text size
 * @param text - Message to show below spinner
 * @param className - Additional styling classes
 */
export default function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary mb-2`} />
      <p className={`${textSizeClasses[size]} text-slate-600 font-medium`}>
        {text}
      </p>
    </div>
  );
}