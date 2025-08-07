/**
 * Enhanced error display component
 * Provides rich error visualization with context, validation details, and suggestions
 */
import { AlertTriangle, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Enhanced error object with additional context and suggestions */
export interface EnhancedError {
  /** Main error message */
  message: string;
  /** Error code identifier */
  code?: string;
  /** Array of validation error details */
  validationErrors?: string[];
  /** Array of suggested solutions */
  suggestions?: string[];
  /** Additional context about the error */
  context?: {
    /** Field that caused the error */
    field?: string;
    /** Value that caused the error */
    value?: string;
    /** What this error conflicts with */
    conflictsWith?: string;
  };
}

interface EnhancedErrorDisplayProps {
  /** Error object or simple error string */
  error: EnhancedError | string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show suggestion section */
  showSuggestions?: boolean;
}

export function EnhancedErrorDisplay({ 
  error, 
  className,
  showSuggestions = true 
}: EnhancedErrorDisplayProps) {
  const normalizedError: EnhancedError = typeof error === 'string' 
    ? { message: error } 
    : error;

  const getErrorType = (message: string) => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('conflict') || lowerMessage.includes('duplicate')) {
      return 'conflict';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'validation';
    }
    return 'general';
  };

  const errorType = getErrorType(normalizedError.message);

  const getIcon = () => {
    switch (errorType) {
      case 'conflict':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'validation':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getVariant = () => {
    switch (errorType) {
      case 'conflict':
        return 'default';
      case 'validation':
        return 'default';
      default:
        return 'destructive';
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Alert variant={getVariant()} className={cn(
        errorType === 'conflict' && "border-amber-200 bg-amber-50",
        errorType === 'validation' && "border-blue-200 bg-blue-50"
      )}>
        {getIcon()}
        <AlertTitle className="text-sm font-medium">
          {errorType === 'conflict' && 'Domain Conflict Detected'}
          {errorType === 'validation' && 'Validation Issue'}
          {errorType === 'general' && 'Error'}
        </AlertTitle>
        <AlertDescription className="text-sm">
          {normalizedError.message}
          
          {normalizedError.context && (
            <div className="mt-2 text-xs space-y-1">
              {normalizedError.context.field && (
                <div>
                  <Badge variant="outline" className="text-xs">
                    Field: {normalizedError.context.field}
                  </Badge>
                </div>
              )}
              {normalizedError.context.conflictsWith && (
                <div className="text-amber-700">
                  <strong>Conflicts with:</strong> {normalizedError.context.conflictsWith}
                </div>
              )}
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Validation Errors */}
      {normalizedError.validationErrors && normalizedError.validationErrors.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-slate-700">Validation Issues:</h4>
          {normalizedError.validationErrors.map((validationError, index) => (
            <Alert key={index} variant="default" className="border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-xs text-orange-800">
                {validationError}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {showSuggestions && normalizedError.suggestions && normalizedError.suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Suggestions:</h4>
          <div className="space-y-1">
            {normalizedError.suggestions.map((suggestion, index) => (
              <Alert key={index} variant="default" className="border-green-200 bg-green-50">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-xs text-green-800">
                  {suggestion}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancedErrorDisplay;