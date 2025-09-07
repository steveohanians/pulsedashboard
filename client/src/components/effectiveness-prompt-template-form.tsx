import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, AlertCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { errorHandler, AppError, NetworkError, AuthError } from "@/services/error/ErrorHandler";
import { effectivenessApi } from "@/services/api/EffectivenessApiService";
import { EffectivenessErrorBoundary } from './EffectivenessErrorBoundary';

interface EffectivenessPromptTemplate {
  id: string;
  criterion: string;
  classifierName: string;
  promptTemplate: string;
  systemPrompt: string;
  schema: string;
  description?: string;
  variables?: string;
  isActive: boolean;
}

export function EffectivenessPromptTemplateForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isUnmountedRef = useRef(false);
  const [selectedCriterion, setSelectedCriterion] = useState('positioning');
  const [formData, setFormData] = useState({
    promptTemplate: '',
    systemPrompt: '',
    schema: ''
  });
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // Fetch templates
  const { data: templates, isLoading } = useQuery<EffectivenessPromptTemplate[]>({
    queryKey: AdminQueryKeys.effectivenessPromptTemplates(),
    queryFn: async () => {
      if (isUnmountedRef.current) {
        throw new AppError('Component unmounted', 'COMPONENT_UNMOUNTED');
      }
      return await effectivenessApi.getPromptTemplates();
    }
  });

  // Update form when template changes
  useEffect(() => {
    if (templates) {
      const template = templates.find(t => t.criterion === selectedCriterion);
      if (template) {
        setFormData({
          promptTemplate: template.promptTemplate || '',
          systemPrompt: template.systemPrompt || '',
          schema: template.schema || '{}'
        });
        setIsDirty(false);
        setPreviewResult(null);
      }
    }
  }, [templates, selectedCriterion]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await effectivenessApi.updatePromptTemplate(selectedCriterion, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.effectivenessPromptTemplates() });
      setIsDirty(false);
      toast({
        title: "Template saved",
        description: `${selectedCriterion} prompt template has been updated successfully.`,
      });
    },
    onError: (error) => {
      errorHandler.handleError(error, 'save prompt template');
    }
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (data: any) => {
      const previewData = {
        ...data,
        criterion: selectedCriterion,
        sampleContent: getSampleContent(selectedCriterion)
      };
      return await effectivenessApi.previewPromptTemplate(previewData);
    },
    onSuccess: (data) => {
      setPreviewResult(data.preview);
      toast({
        title: "Preview generated",
        description: "AI response preview is shown below.",
      });
    },
    onError: (error) => {
      errorHandler.handleError(error, 'preview prompt template');
    }
  });

  const getSampleContent = (criterion: string) => {
    switch (criterion) {
      case 'positioning':
        return "Transforming Healthcare Data Analytics. We empower hospitals and clinics with AI-driven insights to improve patient outcomes and operational efficiency.";
      case 'brand_story':
        return "Founded in 2022, we've helped over 50 healthcare facilities reduce readmission rates by 30%. Our proprietary algorithm analyzes patient data to predict risks and recommend interventions.";
      case 'ctas':
        return "Get Started Today";
      default:
        return "Sample content for testing";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handlePreview = () => {
    previewMutation.mutate(formData);
  };

  const criteriaInfo = {
    positioning: {
      name: "Positioning (Hero Content)",
      description: "Analyzes hero section for audience clarity, outcome specificity, and capability definition"
    },
    brand_story: {
      name: "Brand Story",
      description: "Evaluates brand narrative for POV, recent outcomes, and proof points"
    },
    ctas: {
      name: "Call-to-Actions",
      description: "Assesses CTA effectiveness and message consistency (if using AI)"
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const currentTemplate = templates?.find(t => t.criterion === selectedCriterion);

  return (
    <EffectivenessErrorBoundary 
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-2 text-red-600 mb-4">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Prompt Template Form Error</span>
          </div>
          <p className="text-sm text-red-600 mb-4">Unable to load the prompt template management form.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Effectiveness Scoring Prompts</CardTitle>
          <CardDescription>
            Configure the AI prompts used to analyze website effectiveness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedCriterion} onValueChange={setSelectedCriterion}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="positioning">Positioning</TabsTrigger>
              <TabsTrigger value="brand_story">Brand Story</TabsTrigger>
              <TabsTrigger value="ctas">CTAs</TabsTrigger>
            </TabsList>

            {Object.entries(criteriaInfo).map(([criterion, info]) => (
              <TabsContent key={criterion} value={criterion}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{info.name}</h4>
                    <p className="text-sm text-muted-foreground mb-4">{info.description}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="systemPrompt">System Prompt</Label>
                      <Textarea
                        id="systemPrompt"
                        value={formData.systemPrompt}
                        onChange={(e) => {
                          setFormData({ ...formData, systemPrompt: e.target.value });
                          setIsDirty(true);
                        }}
                        placeholder="System message for OpenAI"
                        className="font-mono text-xs"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label htmlFor="promptTemplate">Prompt Template</Label>
                      <div className="text-xs text-muted-foreground mb-1">
                        Available variables: {currentTemplate?.variables || '{content}'}
                      </div>
                      <Textarea
                        id="promptTemplate"
                        value={formData.promptTemplate}
                        onChange={(e) => {
                          setFormData({ ...formData, promptTemplate: e.target.value });
                          setIsDirty(true);
                        }}
                        placeholder="Enter the prompt template..."
                        className="font-mono text-xs"
                        rows={8}
                      />
                    </div>

                    <div>
                      <Label htmlFor="schema">Expected Response Schema (JSON)</Label>
                      <Textarea
                        id="schema"
                        value={formData.schema}
                        onChange={(e) => {
                          setFormData({ ...formData, schema: e.target.value });
                          setIsDirty(true);
                        }}
                        placeholder='{"field": "type"}'
                        className="font-mono text-xs"
                        rows={4}
                      />
                    </div>
                  </div>

                  {previewResult && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Preview Result:</strong>
                        <pre className="mt-2 text-xs whitespace-pre-wrap">{previewResult}</pre>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePreview}
                      disabled={previewMutation.isPending}
                    >
                      {previewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4 mr-2" />
                      )}
                      Preview
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending || !isDirty}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save Template"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
    </EffectivenessErrorBoundary>
  );
}