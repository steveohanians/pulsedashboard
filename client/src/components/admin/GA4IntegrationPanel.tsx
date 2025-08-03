import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface GA4IntegrationPanelProps {
  clientId: string;
  currentGA4PropertyId: string;
  onGA4PropertyUpdate: (propertyId: string) => void;
}

interface ServiceAccount {
  serviceAccount: {
    id: string;
    name: string;
    serviceAccountEmail: string;
    verified: boolean;
    active: boolean;
  };
  totalProperties: number;
  verifiedProperties: number;
  activeClients: number;
}

interface PropertyAccess {
  id: string;
  propertyId: string;
  propertyName?: string;
  accessLevel?: string;
  accessVerified: boolean;
  lastVerified?: string;
  syncStatus: string;
  errorMessage?: string;
}

export function GA4IntegrationPanel({ clientId, currentGA4PropertyId, onGA4PropertyUpdate }: GA4IntegrationPanelProps) {
  const [propertyId, setPropertyId] = useState(currentGA4PropertyId);
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<string>("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch available service accounts
  const { data: serviceAccounts } = useQuery<ServiceAccount[]>({
    queryKey: ["/api/admin/ga4-service-accounts"],
  });

  // Fetch current property access for this client
  const { data: propertyAccess, refetch: refetchPropertyAccess } = useQuery<PropertyAccess[]>({
    queryKey: ["/api/admin/ga4-property-access/client", clientId],
    enabled: !!clientId,
  });

  const currentAccess = propertyAccess?.find(access => access.propertyId === propertyId);
  const activeServiceAccounts = serviceAccounts?.filter(sa => sa.serviceAccount.active && sa.serviceAccount.verified) || [];
  
  // If we have property access data and no property ID set, use the first one
  useEffect(() => {
    if (propertyAccess && propertyAccess.length > 0 && !propertyId) {
      const firstProperty = propertyAccess[0];
      setPropertyId(firstProperty.propertyId);
      onGA4PropertyUpdate(firstProperty.propertyId);
    }
  }, [propertyAccess, propertyId, onGA4PropertyUpdate]);
  
  // Only show status if connection has been tested (not just when property ID is entered)
  // Show if we have a verified connection OR if we're currently testing
  const showStatus = isTestingConnection || (currentAccess && currentAccess.syncStatus !== 'pending');

  useEffect(() => {
    setPropertyId(currentGA4PropertyId);
  }, [currentGA4PropertyId]);

  const handlePropertyIdChange = (value: string) => {
    setPropertyId(value);
    onGA4PropertyUpdate(value);
  };

  const handleTestConnection = async () => {
    if (!propertyId || !selectedServiceAccount) return;
    
    setIsTestingConnection(true);
    try {
      // Check if property access already exists
      const existingAccess = currentAccess;
      let accessId = existingAccess?.id;
      
      if (!existingAccess) {
        // Create new property access
        const result = await apiRequest("POST", "/api/admin/ga4-property-access", {
          clientId,
          propertyId,
          serviceAccountId: selectedServiceAccount,
        });
        accessId = result?.id;
      }
      
      // Trigger verification for existing or new property access
      if (accessId) {
        await apiRequest("POST", `/api/admin/ga4-property-access/${accessId}/verify`);
        
        // Wait a moment for verification to complete
        setTimeout(() => {
          refetchPropertyAccess();
        }, 1500);
      }
    } catch (error) {
      console.error("Connection test failed:", error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "bg-green-100 text-green-600 border-green-200";
      case "failed": case "blocked": return "bg-red-100 text-red-600 border-red-200";
      case "pending": return "bg-yellow-100 text-yellow-600 border-yellow-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4" />;
      case "failed": case "blocked": return <AlertCircle className="h-4 w-4" />;
      default: return <RefreshCw className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Google Analytics 4 Integration
        </CardTitle>
        <CardDescription>
          Configure GA4 property access for automated data collection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="ga4PropertyId">GA4 Property ID</Label>
          <Input
            id="ga4PropertyId"
            value={propertyId}
            onChange={(e) => handlePropertyIdChange(e.target.value)}
            placeholder="e.g., 123456789"
            className="mt-1"
          />
          <p className="text-xs text-slate-600 mt-1">
            Found in Google Analytics → Admin → Property Settings
          </p>
        </div>

        <div>
          <Label htmlFor="serviceAccount">Service Account</Label>
          <Select value={selectedServiceAccount} onValueChange={setSelectedServiceAccount}>
            <SelectTrigger>
              <SelectValue placeholder="Select a service account" />
            </SelectTrigger>
            <SelectContent>
              {activeServiceAccounts.map((account) => (
                <SelectItem key={account.serviceAccount.id} value={account.serviceAccount.id}>
                  {account.serviceAccount.name} ({account.serviceAccount.serviceAccountEmail})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeServiceAccounts.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No verified service accounts available. Add one in the GA4 Accounts tab.
            </p>
          )}
        </div>

        {propertyId && selectedServiceAccount && (
          <div className="pt-2">
            <Button 
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              variant="outline"
              size="sm"
            >
              {isTestingConnection ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        )}

        {showStatus && currentAccess && (
          <div className="border rounded-lg p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Status</span>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(currentAccess.syncStatus)}>
                  {getStatusIcon(currentAccess.syncStatus)}
                  <span className="ml-1 capitalize">{currentAccess.syncStatus}</span>
                </Badge>
                {currentAccess.syncStatus !== 'success' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchPropertyAccess()}
                    className="h-6 w-6 p-0"
                    title="Refresh status"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            
            {currentAccess.propertyName && (
              <p className="text-sm text-slate-600 mb-1">
                <strong>Property:</strong> {currentAccess.propertyName}
              </p>
            )}
            
            {currentAccess.accessLevel && (
              <p className="text-sm text-slate-600 mb-1">
                <strong>Access Level:</strong> {currentAccess.accessLevel}
              </p>
            )}
            
            {currentAccess.lastVerified && (
              <p className="text-sm text-slate-600 mb-1">
                <strong>Last Verified:</strong> {new Date(currentAccess.lastVerified).toLocaleDateString()}
              </p>
            )}
            
            {currentAccess.errorMessage && (
              <p className="text-sm text-red-600 mt-2">
                <strong>Error:</strong> {currentAccess.errorMessage}
              </p>
            )}
          </div>
        )}

        {propertyId && !currentAccess && (
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
            <p className="text-sm text-blue-700">
              <strong>Setup Required:</strong> Add your property ID and test the connection to enable automated data collection.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}