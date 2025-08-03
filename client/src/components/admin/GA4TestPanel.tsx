/**
 * GA4 Test Panel Component
 * Admin interface for testing GA4 integration
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, TestTube, Database, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export function GA4TestPanel() {
  const [propertyId, setPropertyId] = useState('');
  const [clientId, setClientId] = useState('demo-client-id');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Test GA4 data processing mutation
  const testGA4Processing = useMutation({
    mutationFn: async (data: { clientId: string }) => {
      return await apiRequest('POST', `/api/ga4/test/${data.clientId}`, {});
    },
    onSuccess: (data) => {
      toast({
        title: "GA4 Test Successful",
        description: `Processed ${data.processedCount} GA4 metrics successfully`,
      });
      // Invalidate dashboard cache to show new data
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "GA4 Test Failed",
        description: error.message || "Failed to process GA4 test data",
        variant: "destructive",
      });
    }
  });

  const handleTestGA4Processing = () => {
    if (!clientId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a client ID",
        variant: "destructive",
      });
      return;
    }

    testGA4Processing.mutate({ clientId: clientId.trim() });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            GA4 Integration Testing
          </CardTitle>
          <CardDescription>
            Test GA4 data processing with mock data to validate the integration pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="demo-client-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">GA4 Property ID (For Future Use)</Label>
              <Input
                id="propertyId"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="123456789"
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Property ID input is prepared for real GA4 integration
              </p>
            </div>

            <Button 
              onClick={handleTestGA4Processing}
              disabled={testGA4Processing.isPending}
              className="w-full"
            >
              {testGA4Processing.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing GA4 Test Data...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Test GA4 Data Processing
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Display */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
          <CardDescription>Current GA4 integration capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Data Processing Pipeline</span>
              </div>
              <span className="text-sm text-green-600 font-medium">Ready</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Mock Data Generation</span>
              </div>
              <span className="text-sm text-green-600 font-medium">Ready</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-orange-500" />
                <span>Real GA4 API Connection</span>
              </div>
              <span className="text-sm text-orange-600 font-medium">Pending Setup</span>
            </div>
          </div>
          
          <Alert className="mt-4">
            <AlertDescription>
              The GA4 integration framework is ready. Mock data testing is fully functional. 
              Real GA4 API integration will be enabled when you provide a valid GA4 Property ID and credentials.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}