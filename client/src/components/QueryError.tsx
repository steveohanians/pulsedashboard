import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface QueryErrorProps {
  message: string;
  onRetry?: () => void;
}

export const QueryError = ({ message, onRetry }: QueryErrorProps) => (
  <Card className="p-4">
    <div className="text-center text-muted-foreground">
      <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
      <p>{message}</p>
      <Button 
        onClick={onRetry || (() => window.location.reload())} 
        className="mt-4"
        data-testid="button-retry-error"
      >
        Retry
      </Button>
    </div>
  </Card>
);