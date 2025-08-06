import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ValidationWarning {
  type: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
  details?: string;
}

interface ValidationWarningsProps {
  warnings: ValidationWarning[] | string[];
  className?: string;
  showTitle?: boolean;
}

export function ValidationWarnings({ 
  warnings, 
  className,
  showTitle = true 
}: ValidationWarningsProps) {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  // Convert string array to ValidationWarning objects
  const normalizedWarnings: ValidationWarning[] = warnings.map(warning => {
    if (typeof warning === 'string') {
      // Detect type based on content
      const lowerWarning = warning.toLowerCase();
      let type: ValidationWarning['type'] = 'info';
      
      if (lowerWarning.includes('error') || lowerWarning.includes('failed') || lowerWarning.includes('conflict')) {
        type = 'error';
      } else if (lowerWarning.includes('warning') || lowerWarning.includes('caution')) {
        type = 'warning';
      } else if (lowerWarning.includes('success') || lowerWarning.includes('completed')) {
        type = 'success';
      }

      return {
        type,
        message: warning
      };
    }
    return warning;
  });

  const getIcon = (type: ValidationWarning['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = (type: ValidationWarning['type']) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showTitle && (
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Validation Results</h4>
          <Badge variant="secondary" className="text-xs">
            {normalizedWarnings.length} item{normalizedWarnings.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      )}
      
      {normalizedWarnings.map((warning, index) => (
        <Alert 
          key={index} 
          variant={getVariant(warning.type)}
          className={cn(
            "text-sm",
            warning.type === 'success' && "border-green-200 bg-green-50 text-green-800",
            warning.type === 'info' && "border-blue-200 bg-blue-50 text-blue-800"
          )}
        >
          {getIcon(warning.type)}
          {warning.title && (
            <AlertTitle className="text-sm font-medium">
              {warning.title}
            </AlertTitle>
          )}
          <AlertDescription className="text-xs">
            {warning.message}
            {warning.details && (
              <div className="mt-1 text-xs opacity-75">
                {warning.details}
              </div>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

export default ValidationWarnings;