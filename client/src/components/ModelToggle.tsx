import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Loader2 } from "lucide-react";
import { ModelSelectionModal } from "./ModelSelectionModal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ModelConfig {
  currentModel: string;
  availableModels: string[];
}

export function ModelToggle() {
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: modelConfig, isLoading } = useQuery<ModelConfig>({
    queryKey: ['/api/admin/openai-model'],
    retry: false
  });

  const updateModelMutation = useMutation({
    mutationFn: async (model: string) => {
      return await apiRequest('POST', '/api/admin/openai-model', { model });
    },
    onSuccess: (data) => {
      toast({
        title: "Model Updated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/openai-model'] });
      setModalOpen(false);
      setPendingModel(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update AI model",
        variant: "destructive",
      });
      setModalOpen(false);
      setPendingModel(null);
    }
  });

  const handleToggleChange = (checked: boolean) => {
    if (!modelConfig) return;
    
    const newModel = checked ? "gpt-5" : "gpt-4o";
    
    // If already the current model, do nothing
    if (newModel === modelConfig.currentModel) return;
    
    setPendingModel(newModel);
    setModalOpen(true);
  };

  const handleConfirm = () => {
    if (pendingModel) {
      updateModelMutation.mutate(pendingModel);
    }
  };

  const handleCancel = () => {
    setModalOpen(false);
    setPendingModel(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <Cpu className="h-4 w-4 mr-2" />
            AI Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-slate-600">Loading model configuration...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!modelConfig) {
    return null;
  }

  const isGpt5 = modelConfig.currentModel === "gpt-5";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <Cpu className="h-4 w-4 mr-2" />
            AI Model Configuration
          </CardTitle>
          <p className="text-xs text-slate-600">
            Current model: <strong>{modelConfig.currentModel}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Switch
              id="model-toggle"
              checked={isGpt5}
              onCheckedChange={handleToggleChange}
              disabled={updateModelMutation.isPending}
            />
            <Label htmlFor="model-toggle" className="text-sm font-medium">
              {isGpt5 ? "GPT-5" : "GPT-4o"}
            </Label>
            {updateModelMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Toggle to switch between GPT-4o and GPT-5 models
          </p>
        </CardContent>
      </Card>

      <ModelSelectionModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        currentModel={modelConfig.currentModel}
        selectedModel={pendingModel || modelConfig.currentModel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isChanging={updateModelMutation.isPending}
      />
    </>
  );
}