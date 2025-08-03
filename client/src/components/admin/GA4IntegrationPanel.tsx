import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Play, BarChart3, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';


interface GA4IntegrationPanelProps {
  clientId: string;
  currentGA4PropertyId?: string;
  onGA4PropertyUpdate?: (propertyId: string) => void;
}

export function GA4IntegrationPanel({ 
  clientId, 
  currentGA4PropertyId = '', 
  onGA4PropertyUpdate 
}: GA4IntegrationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ga4PropertyId, setGA4PropertyId] = useState(currentGA4PropertyId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Test GA4 data processing mutation
  const testGA4Processing = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/ga4/test/${clientId}`, {});
    },
    onSuccess: (data) => {
      toast({
        title: "GA4 Test Completed",
        description: `Successfully processed ${data.metricsProcessed || 0} metrics and ${data.trafficChannelsProcessed || 0} traffic channels.`,
      });
      // Invalidate dashboard data to show updated metrics
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard', clientId] });
    },
    onError: (error: any) => {
      toast({
        title: "GA4 Test Failed",
        description: error.message || "Failed to process GA4 data. Check server logs for details.",
        variant: "destructive",
      });
    },
  });

  const handleGA4PropertyChange = (value: string) => {
    setGA4PropertyId(value);
    if (onGA4PropertyUpdate) {
      onGA4PropertyUpdate(value);
    }
  };

  const isGA4Connected = Boolean(ga4PropertyId);

  return (
    <div className="space-y-4">
      {/* GA4 Property ID Field */}
      <div>
        <Label htmlFor="gaPropertyId">GA4 Property ID</Label>
        <Input 
          id="gaPropertyId" 
          name="gaPropertyId"
          value={ga4PropertyId}
          onChange={(e) => handleGA4PropertyChange(e.target.value)}
          placeholder="ex: 412345678901"
          className="font-mono"
        />
        <p className="text-xs text-slate-500 mt-1">
          Google Analytics 4 property ID for data collection
        </p>
      </div>

      {/* Expandable Integration Panel */}
      <div>
        <Button 
          variant="ghost" 
          className="w-full justify-between p-0 h-auto"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-medium">GA4 Integration Details</span>
            <Badge variant={isGA4Connected ? "secondary" : "outline"} className="text-xs">
              {isGA4Connected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </Button>
        
        {isExpanded && (
          <div className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>GA4 Integration Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Integration Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isGA4Connected ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm">
                    {isGA4Connected ? 'GA4 Property Connected' : 'GA4 Property Not Set'}
                  </span>
                </div>
                <Badge variant={isGA4Connected ? "secondary" : "outline"}>
                  {isGA4Connected ? 'Ready' : 'Pending'}
                </Badge>
              </div>

              {isGA4Connected && (
                <>
                  <Separator />
                  
                  {/* GA4 Property Details */}
                  <div className="space-y-2">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Property Details</div>
                    <div className="bg-slate-50 p-3 rounded-md">
                      <div className="text-sm">
                        <strong>Property ID:</strong> <code className="font-mono text-xs">{ga4PropertyId}</code>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Real GA4 data will replace sample metrics for this client
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Test Integration */}
                  <div className="space-y-3">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Test Integration</div>
                    <div className="flex items-center space-x-3">
                      <Button
                        size="sm"
                        onClick={() => testGA4Processing.mutate()}
                        disabled={testGA4Processing.isPending}
                        className="flex items-center space-x-2"
                      >
                        <Play className="h-3 w-3" />
                        <span>
                          {testGA4Processing.isPending ? 'Processing...' : 'Test GA4 Data Processing'}
                        </span>
                      </Button>
                      {testGA4Processing.isPending && (
                        <div className="text-xs text-slate-500">
                          Simulating GA4 data import...
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Test the data processing pipeline with simulated GA4 data
                    </div>
                  </div>
                </>
              )}

              {!isGA4Connected && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-xs text-slate-600 uppercase tracking-wide">Setup Instructions</div>
                    <div className="text-sm space-y-2">
                      <div>1. Find your GA4 Property ID in Google Analytics Admin</div>
                      <div>2. Add Clear Digital as a guest user to your GA4 property</div>
                      <div>3. Enter your Property ID above and save</div>
                      <div>4. Real GA4 data will replace sample metrics automatically</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}