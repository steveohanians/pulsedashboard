import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DialogClose } from "@/components/ui/dialog";
import { Loader2, AlertCircle, CheckCircle, Link, Link2Off, Calendar, Power, PowerOff, Key } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ServiceAccountFormProps {
  onClose: () => void;
  serviceAccount?: any; // For editing existing accounts
}

export function ServiceAccountForm({ onClose, serviceAccount }: ServiceAccountFormProps) {
  const [formData, setFormData] = useState({
    name: serviceAccount?.name || "",
    serviceAccountEmail: serviceAccount?.serviceAccountEmail || "",
    active: serviceAccount?.active ?? true
  });
  
  const [validationError, setValidationError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        name: data.name,
        serviceAccountEmail: data.serviceAccountEmail,
        active: data.active
      };

      if (serviceAccount) {
        return await apiRequest('PUT', `/api/admin/ga4-service-accounts/${serviceAccount.id}`, payload);
      } else {
        return await apiRequest('POST', '/api/admin/ga4-service-accounts', payload);
      }
    },
    onSuccess: () => {
      toast({
        title: serviceAccount ? "Service account updated" : "Service account created",
        description: `Successfully ${serviceAccount ? 'updated' : 'created'} service account "${formData.name}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ga4-service-accounts'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${serviceAccount ? 'update' : 'create'} service account.`,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    
    // Basic validation
    if (!formData.name.trim()) {
      setValidationError("Service account name is required");
      return;
    }
    
    if (!formData.serviceAccountEmail.trim()) {
      setValidationError("Google account email is required");
      return;
    }

    createMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationError(""); // Clear validation error when user types
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serviceAccount && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">Account Status</div>
            <Badge 
              variant={serviceAccount.active ? "default" : "secondary"}
              className="text-xs"
            >
              {serviceAccount.active ? (
                <><Power className="h-3 w-3 mr-1" />Active</>
              ) : (
                <><PowerOff className="h-3 w-3 mr-1" />Inactive</>
              )}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600">OAuth Status</div>
            <Badge 
              variant={serviceAccount.verified ? "default" : "outline"}
              className="text-xs"
            >
              {serviceAccount.verified ? (
                <><Link className="h-3 w-3 mr-1" />Connected</>
              ) : (
                <><Link2Off className="h-3 w-3 mr-1" />Not Connected</>
              )}
            </Badge>
          </div>
          {serviceAccount.lastUsed && (
            <div className="space-y-2 col-span-2">
              <div className="text-xs font-medium text-slate-600">Last Used</div>
              <div className="text-xs text-slate-500 flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {new Date(serviceAccount.lastUsed).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      )}

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="name">Account Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          placeholder="e.g., Clear Digital GA4 Account 1"
          required
        />
      </div>

      <div>
        <Label htmlFor="email">Google Account Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.serviceAccountEmail}
          onChange={(e) => handleInputChange('serviceAccountEmail', e.target.value)}
          placeholder="user@cleardigital.com"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          This Google account will be granted access to client GA4 properties
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={formData.active}
          onCheckedChange={(checked) => handleInputChange('active', checked)}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex items-center justify-end space-x-2 pt-4 border-t">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {serviceAccount ? 'Update Account' : 'Add Account'}
        </Button>
      </div>
    </form>
  );
}