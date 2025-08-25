import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Eye, Info, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SOVPromptTemplate, UpdateSOVPromptTemplate } from "@shared/schema";

// Default template for new installations
const DEFAULT_TEMPLATE = `Based on these competing brands in the {vertical} industry:
{brandContext}

Generate 15 questions following these guidelines:

AWARENESS STAGE (5 questions)
3 ORGANIC questions (brand-agnostic): Focus on broad categories, problems, outcomes.
1 ORGANIC discovery question: Explicitly seek vendors, providers, or solutions (e.g., "What are the main providers for…?").
1 PROMPTED question: Mention category leaders or "top providers."

CONSIDERATION STAGE (5 questions)
3 ORGANIC questions: Compare features, criteria, trade-offs without naming brands.
2 PROMPTED questions: Direct brand comparisons (side-by-side).

DECISION STAGE (5 questions)  
2 ORGANIC questions: Pricing, implementation, support, practical concerns.
3 PROMPTED questions: Head-to-head comparisons using these brands: {brandName}, {competitors}

Requirements:
Use natural buyer language.
Cover features, cost, scalability, integration, ease of use, support, results.
Ensure variety in question forms (who/what/how/why, lists, comparisons).
Include services as well as platforms.
Tag each question as [ORGANIC] or [PROMPTED].

Output: Numbered list with tags.
1. [ORGANIC] Question here  
2. [PROMPTED] Question here`;

interface PreviewData {
  questions: Array<{ question: string; type: 'organic' | 'prompted' }>;
  previewData: {
    brandName: string;
    vertical: string;
    competitors: string[];
  };
}

export function SOVPromptTemplateForm() {
  const [template, setTemplate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current template
  const { data: currentTemplate, isLoading } = useQuery<SOVPromptTemplate>({
    queryKey: ['/api/admin/sov-prompt-template'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sov-prompt-template');
      if (!response.ok) {
        throw new Error('Failed to fetch SOV prompt template');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: UpdateSOVPromptTemplate) => {
      const response = await fetch('/api/admin/sov-prompt-template', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update SOV prompt template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sov-prompt-template'] });
      setIsDirty(false);
      toast({
        title: "Template Saved",
        description: "SOV prompt template has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save SOV prompt template.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  // Preview generation mutation
  const previewMutation = useMutation({
    mutationFn: async (promptTemplate: string) => {
      const response = await fetch('/api/admin/sov-prompt-template/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promptTemplate }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }
      return response.json();
    },
    onSuccess: (data: PreviewData) => {
      setPreviewData(data);
      setShowPreviewDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate preview questions.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsPreviewing(false);
    },
  });

  // Initialize template from server data
  useEffect(() => {
    if (currentTemplate) {
      setTemplate(currentTemplate.promptTemplate || DEFAULT_TEMPLATE);
    } else if (!isLoading) {
      // No template exists, use default
      setTemplate(DEFAULT_TEMPLATE);
    }
  }, [currentTemplate, isLoading]);

  const handleTemplateChange = (value: string) => {
    setTemplate(value);
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!template.trim()) {
      toast({
        title: "Invalid Template",
        description: "Template cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    updateTemplateMutation.mutate({
      promptTemplate: template,
    });
  };

  const handlePreview = () => {
    if (!template.trim()) {
      toast({
        title: "Invalid Template",
        description: "Template cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsPreviewing(true);
    previewMutation.mutate(template);
  };

  const handleCancel = () => {
    if (currentTemplate) {
      setTemplate(currentTemplate.promptTemplate || DEFAULT_TEMPLATE);
    } else {
      setTemplate(DEFAULT_TEMPLATE);
    }
    setIsDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading template...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Template Variables Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Available Template Variables:</p>
              <div className="grid grid-cols-2 gap-2 text-blue-700">
                <div><code className="bg-blue-100 px-1 rounded">{"{vertical}"}</code> - Industry vertical</div>
                <div><code className="bg-blue-100 px-1 rounded">{"{brandName}"}</code> - Client brand name</div>
                <div><code className="bg-blue-100 px-1 rounded">{"{competitors}"}</code> - Competitor names</div>
                <div><code className="bg-blue-100 px-1 rounded">{"{brandContext}"}</code> - AI research summary</div>
              </div>
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">SOV Question Generation Template</label>
            {isDirty && (
              <Badge variant="secondary" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </div>
          <Textarea
            value={template}
            onChange={(e) => handleTemplateChange(e.target.value)}
            placeholder="Enter your SOV question generation prompt template..."
            className="min-h-[400px] font-mono text-sm"
            data-testid="textarea-sov-template"
          />
          <p className="text-xs text-slate-500">
            This template is used to generate buyer journey questions for Share of Voice analysis.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving || isPreviewing}
            className="flex-1"
            data-testid="button-save-sov-template"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>

          <Button
            onClick={handlePreview}
            disabled={!template.trim() || isSaving || isPreviewing}
            variant="outline"
            className="flex-1"
            data-testid="button-preview-sov-template"
          >
            {isPreviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview Questions
              </>
            )}
          </Button>

          {isDirty && (
            <Button
              onClick={handleCancel}
              variant="ghost"
              disabled={isSaving || isPreviewing}
              data-testid="button-cancel-sov-template"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generated Questions Preview
            </DialogTitle>
            <DialogDescription>
              Preview of questions generated using your template with current client data
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-4">
              {/* Preview Context */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 mb-2">Preview Context:</h4>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
                  <div><strong>Brand:</strong> {previewData.previewData.brandName}</div>
                  <div><strong>Industry:</strong> {previewData.previewData.vertical}</div>
                  <div><strong>Competitors:</strong> {previewData.previewData.competitors.join(', ')}</div>
                </div>
              </div>

              {/* Generated Questions */}
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="space-y-6">
                  {["awareness", "consideration", "decision"].map((stage) => {
                    const stageQuestions = previewData.questions.filter(
                      (_, index) => {
                        if (stage === "awareness") return index < 5;
                        if (stage === "consideration") return index >= 5 && index < 10;
                        return index >= 10;
                      }
                    );
                    return (
                      <div key={stage} className="space-y-3">
                        <h4 className="font-semibold capitalize text-primary border-b border-primary/20 pb-1">
                          {stage} Stage ({stageQuestions.length} questions)
                        </h4>
                        <ul className="space-y-2">
                          {stageQuestions.map((q, i) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 pl-4 border-l-2 border-slate-200 flex items-start gap-2"
                            >
                              <Badge 
                                variant={q.type === 'prompted' ? 'default' : 'secondary'} 
                                className="text-xs mt-0.5 flex-shrink-0"
                              >
                                {q.type.toUpperCase()}
                              </Badge>
                              <span className="flex-1">{q.question}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}