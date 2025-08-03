import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose } from "@/components/ui/dialog";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
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
    description: serviceAccount?.description || "",
    credentialsJson: serviceAccount?.credentialsJson ? JSON.stringify(serviceAccount.credentialsJson, null, 2) : "",
    maxProperties: serviceAccount?.maxProperties || 50,
    active: serviceAccount?.active ?? true
  });
  
  const [validationError, setValidationError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      let parsedCredentials = null;
      
      // Validate and parse JSON credentials if provided
      if (data.credentialsJson?.trim()) {
        try {
          parsedCredentials = JSON.parse(data.credentialsJson);
          
          // Validate required fields
          const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
          for (const field of requiredFields) {
            if (!parsedCredentials[field]) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
        } catch (error) {
          throw new Error(`Invalid credentials JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      const payload = {
        name: data.name,
        serviceAccountEmail: data.serviceAccountEmail,
        description: data.description,
        credentialsJson: parsedCredentials,
        maxProperties: parseInt(data.maxProperties.toString()),
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
      setValidationError("Service account email is required");
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
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Service Account Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., Clear Digital GA4 Account 1"
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Service Account Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.serviceAccountEmail}
            onChange={(e) => handleInputChange('serviceAccountEmail', e.target.value)}
            placeholder="service-account@project.iam.gserviceaccount.com"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Brief description of this service account's purpose"
        />
      </div>

      <div>
        <Label htmlFor="credentials">Service Account Credentials (JSON)</Label>
        <Textarea
          id="credentials"
          value={formData.credentialsJson}
          onChange={(e) => handleInputChange('credentialsJson', e.target.value)}
          placeholder="Paste the complete service account JSON file contents here..."
          rows={8}
          className="font-mono text-xs"
        />
        <p className="text-xs text-slate-500 mt-1">
          Paste the JSON file downloaded from Google Cloud Console for this service account
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="maxProperties">Max Properties</Label>
          <Input
            id="maxProperties"
            type="number"
            min="1"
            max="100"
            value={formData.maxProperties}
            onChange={(e) => handleInputChange('maxProperties', e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            Maximum number of GA4 properties this account can access
          </p>
        </div>

        <div className="flex items-center space-x-2 pt-6">
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => handleInputChange('active', checked)}
          />
          <Label htmlFor="active">Active</Label>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 pt-4 border-t">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {serviceAccount ? 'Update Account' : 'Create Account'}
        </Button>
      </div>
    </form>
  );
}