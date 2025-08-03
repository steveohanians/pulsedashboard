import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GlobalPromptTemplate {
  id: string;
  name: string;
  promptTemplate: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function GlobalPromptTemplateForm() {
  const [formData, setFormData] = useState({
    name: "", // Read-only, populated from server
    description: "",
    promptTemplate: ""
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const queryClient = useQueryClient();

  const { data: template, isLoading, error } = useQuery<GlobalPromptTemplate>({
    queryKey: ['/api/admin/global-prompt-template'],
    retry: false
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { description?: string; promptTemplate: string }) => {
      const response = await fetch('/api/admin/global-prompt-template', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error('Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      setSaveStatus('success');
      queryClient.invalidateQueries({ queryKey: ['/api/admin/global-prompt-template'] });
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  });

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || "",
        description: template.description || "",
        promptTemplate: template.promptTemplate || ""
      });
    }
  }, [template]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    
    updateMutation.mutate({
      description: formData.description,
      promptTemplate: formData.promptTemplate
    });
  };

  const handleInputChange = (field: string, value: string) => {
    // Only allow editing of description and promptTemplate
    if (field === 'description' || field === 'promptTemplate') {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-slate-600">Loading template...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load global prompt template. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={formData.name}
            readOnly
            className="bg-slate-50 text-slate-600 cursor-not-allowed"
          />
          <p className="text-xs text-slate-500 mt-1">Template name is system-managed and cannot be changed</p>
        </div>

        <div>
          <Label htmlFor="template-description">Description</Label>
          <Input
            id="template-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Brief description of this template's purpose"
          />
        </div>

        <div>
          <Label htmlFor="template-prompt">Global Prompt Template</Label>
          <Textarea
            id="template-prompt"
            value={formData.promptTemplate}
            onChange={(e) => handleInputChange('promptTemplate', e.target.value)}
            placeholder="Enter the global AI prompt template with placeholders like {{METRIC_SPECIFIC_ANALYSIS}}, {{clientName}}, {{industry}}, etc."
            rows={15}
            className="font-mono text-sm"
            required
          />
          <div className="mt-2 text-xs text-slate-500 space-y-1">
            <p><strong>Available placeholders:</strong></p>
            <p>• {`{{METRIC_SPECIFIC_ANALYSIS}}`} - Replaced with metric-specific prompt content</p>
            <p>• {`{{clientName}}, {{industry}}, {{businessSize}}`} - Client and context information</p>
            <p>• {`{{clientValue}}, {{industryAverage}}, {{cdPortfolioAverage}}`} - Performance metrics</p>
            <p>• {`{{competitors}}, {{metricDisplayName}}`} - Competitive analysis data</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center space-x-2">
          {saveStatus === 'success' && (
            <div className="flex items-center text-green-600 text-sm">
              <CheckCircle className="h-4 w-4 mr-1" />
              Template saved successfully
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mr-1" />
              Failed to save template
            </div>
          )}
        </div>
        
        <Button 
          type="submit" 
          disabled={saveStatus === 'saving' || updateMutation.isPending}
          className="min-w-[120px]"
        >
          {saveStatus === 'saving' || updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Template'
          )}
        </Button>
      </div>
    </form>
  );
}