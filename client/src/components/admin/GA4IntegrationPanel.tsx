import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, RefreshCw, ExternalLink, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { logger } from "@/utils/logger";

interface GA4IntegrationPanelProps {
  clientId: string | null;
  currentGA4PropertyId: string;
  onGA4PropertyUpdate: (propertyId: string) => void;
  onServiceAccountUpdate?: (serviceAccountId: string) => void;
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
  serviceAccountId: string;
  propertyName?: string;
  accessLevel?: string;
  accessVerified: boolean;
  lastVerified?: string;
  syncStatus: string;
  errorMessage?: string;
}

export function GA4IntegrationPanel({ clientId, currentGA4PropertyId, onGA4PropertyUpdate, onServiceAccountUpdate }: GA4IntegrationPanelProps) {
  const [propertyId, setPropertyId] = useState(currentGA4PropertyId);
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<string>("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Fetch available service accounts
  const { data: serviceAccounts, error: serviceAccountsError, isLoading: serviceAccountsLoading } = useQuery<ServiceAccount[]>({
    queryKey: AdminQueryKeys.ga4ServiceAccounts(),
  });

  // Debug logging for service accounts
  useEffect(() => {
    logger.info("[GA4IntegrationPanel] Service accounts data:", {
      serviceAccounts,
      serviceAccountsError,
      serviceAccountsLoading,
      activeServiceAccounts: serviceAccounts?.filter(sa => sa.serviceAccount.active && sa.serviceAccount.verified) || [],
      allServiceAccounts: serviceAccounts || []
    });
  }, [serviceAccounts, serviceAccountsError, serviceAccountsLoading]);

  // Fetch current property access for this client (single property per client)
  const { data: propertyAccess, refetch: refetchPropertyAccess } = useQuery<PropertyAccess | null>({
    queryKey: AdminQueryKeys.ga4PropertyAccessClient(clientId || ''),
    enabled: !!clientId,
  });

  const currentAccess = propertyAccess;
  const activeServiceAccounts = serviceAccounts?.filter(sa => sa.serviceAccount.active && sa.serviceAccount.verified) || [];
  
  // Initialize component state from props and reset form state
  useEffect(() => {
    setPropertyId(currentGA4PropertyId);
    // Only reset test state if property ID actually changed
    if (currentGA4PropertyId !== propertyId) {
      setHasTestedConnection(false);
    }
    // Reset service account selection to force re-population
    setSelectedServiceAccount("");
  }, [currentGA4PropertyId]);

  // Auto-populate property ID and service account from existing property access data
  useEffect(() => {
    if (propertyAccess) {
      // If we have existing property access, populate the form with that data
      if (propertyAccess.propertyId && propertyAccess.propertyId !== propertyId) {
        setPropertyId(propertyAccess.propertyId);
        onGA4PropertyUpdate(propertyAccess.propertyId);
      }
      if (propertyAccess.serviceAccountId && !selectedServiceAccount) {
        setSelectedServiceAccount(propertyAccess.serviceAccountId);
        onServiceAccountUpdate?.(propertyAccess.serviceAccountId);
      }
    }
  }, [propertyAccess, onGA4PropertyUpdate, onServiceAccountUpdate]);
  
  // Only show status while testing or if we just completed a test (not for existing saved data)
  const [hasTestedConnection, setHasTestedConnection] = useState(false);
  // Show status if testing, just tested, or if there's existing access data to display
  const showStatus = isTestingConnection || hasTestedConnection || (currentAccess && currentAccess.accessVerified);

  const handlePropertyIdChange = async (value: string) => {
    setPropertyId(value);
    onGA4PropertyUpdate(value);
    // Reset test status when property ID changes
    setHasTestedConnection(false);
    
    // Auto-save property ID changes if there's an existing access record
    if (currentAccess && value !== currentAccess.propertyId) {
      try {
        await apiRequest("PUT", `/api/admin/ga4-property-access/${currentAccess.id}`, {
          propertyId: value
        });
        // Refresh property access data to show updated info
        refetchPropertyAccess();
      } catch (error) {
        // Property ID change failed
      }
    }
  };

  const handleTestConnection = async () => {
    if (!propertyId || !selectedServiceAccount) return;
    
    setIsTestingConnection(true);
    setHasTestedConnection(false);
    
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
          setHasTestedConnection(true);
        }, 1000);
      }
    } catch (error) {
      // Connection test failed
      setHasTestedConnection(true); // Show status even on error
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
          <Select value={selectedServiceAccount} onValueChange={async (value) => {
            setSelectedServiceAccount(value);
            onServiceAccountUpdate?.(value);
            
            // Auto-save service account changes if there's an existing access record
            if (currentAccess && value !== currentAccess.serviceAccountId) {
              try {
                await apiRequest("PUT", `/api/admin/ga4-property-access/${currentAccess.id}`, {
                  serviceAccountId: value
                });
                // Refresh property access data to show updated info
                refetchPropertyAccess();
              } catch (error) {
                logger.warn("Failed to save service account change:", error);
              }
            }
          }}>
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
          {serviceAccountsLoading && (
            <p className="text-xs text-blue-600 mt-1">
              Loading service accounts...
            </p>
          )}
          {!serviceAccountsLoading && serviceAccountsError && (
            <p className="text-xs text-red-600 mt-1">
              Error loading service accounts: {serviceAccountsError instanceof Error ? serviceAccountsError.message : 'Unknown error'}
            </p>
          )}
          {!serviceAccountsLoading && !serviceAccountsError && activeServiceAccounts.length === 0 && serviceAccounts && serviceAccounts.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No active/verified service accounts found. Available accounts: {serviceAccounts.length} (check GA4 Accounts tab to verify accounts)
            </p>
          )}
          {!serviceAccountsLoading && !serviceAccountsError && activeServiceAccounts.length === 0 && (!serviceAccounts || serviceAccounts.length === 0) && (
            <p className="text-xs text-amber-600 mt-1">
              No service accounts available. Add one in the GA4 Accounts tab.
            </p>
          )}
        </div>

        {propertyId && selectedServiceAccount && (
          <div className="pt-2">
            {clientId ? (
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
            ) : (
              <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                <p className="text-sm text-amber-700">
                  <strong>Test Connection:</strong> Connection testing will be available after the client is created. Save the client first to enable GA4 verification.
                </p>
              </div>
            )}
          </div>
        )}

        {showStatus && (
          <div className="border rounded-lg p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Connection Test Results</span>
              <div className="flex items-center gap-2">
                {isTestingConnection ? (
                  <Badge className="bg-yellow-100 text-yellow-800">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Testing...
                  </Badge>
                ) : currentAccess && currentAccess.syncStatus === 'success' && currentAccess.accessVerified ? (
                  <Badge className={getStatusColor(currentAccess.syncStatus)}>
                    {getStatusIcon(currentAccess.syncStatus)}
                    <span className="ml-1 capitalize">{currentAccess.syncStatus}</span>
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <X className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>
            </div>
            
            {!isTestingConnection && currentAccess && currentAccess.syncStatus === 'success' && currentAccess.accessVerified && (
              <>
                {currentAccess.propertyName && (
                  <p className="text-sm text-slate-600 mb-1">
                    <strong>Property:</strong> {currentAccess.propertyName}
                  </p>
                )}
                

                
                {currentAccess.lastVerified && (
                  <p className="text-sm text-slate-600 mb-1">
                    <strong>Verified:</strong> {new Date(currentAccess.lastVerified).toLocaleDateString()}
                  </p>
                )}
              </>
            )}
            
            {!isTestingConnection && currentAccess && (currentAccess.syncStatus === 'failed' || !currentAccess.accessVerified) && currentAccess.errorMessage && (
              <p className="text-sm text-red-600 mt-2">
                <strong>Error:</strong> {currentAccess.errorMessage}
              </p>
            )}
          </div>
        )}


      </CardContent>
    </Card>
  );
}