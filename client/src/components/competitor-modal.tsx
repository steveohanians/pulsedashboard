import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Trash2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompetitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitors: any[];
  clientId: string;
}

export default function CompetitorModal({ isOpen, onClose, competitors, clientId }: CompetitorModalProps) {
  const [domain, setDomain] = useState("");
  const [label, setLabel] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addCompetitorMutation = useMutation({
    mutationFn: async (data: { domain: string; label: string; clientId: string }) => {
      const res = await apiRequest("POST", "/api/competitors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", clientId] });
      setDomain("");
      setLabel("");
      toast({
        title: "Competitor added",
        description: "The competitor has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add competitor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCompetitorMutation = useMutation({
    mutationFn: async (competitorId: string) => {
      await apiRequest("DELETE", `/api/competitors/${competitorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard", clientId] });
      toast({
        title: "Competitor removed",
        description: "The competitor has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove competitor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddCompetitor = () => {
    if (!domain.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter a domain.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    const urlPattern = /^https:\/\/.+\..+/;
    const fullDomain = domain.startsWith('https://') ? domain : `https://${domain}`;
    
    if (!urlPattern.test(fullDomain)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL starting with https://",
        variant: "destructive",
      });
      return;
    }

    addCompetitorMutation.mutate({
      domain: fullDomain,
      label: label.trim() || new URL(fullDomain).hostname,
      clientId,
    });
  };

  const handleDeleteCompetitor = (competitorId: string) => {
    deleteCompetitorMutation.mutate(competitorId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage Competitors</DialogTitle>
          <DialogDescription>
            Add and manage competitor websites for benchmarking analysis
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Add Competitor Form */}
          <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-900 mb-4">Add New Competitor</h3>
            <div className="flex gap-4">
              <Input
                placeholder="Enter competitor URL (e.g., https://competitor.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAddCompetitor}
                disabled={addCompetitorMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Current Competitors */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-900">Current Competitors</h3>
            {competitors.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No competitors added yet</p>
                <p className="text-sm">Add competitors to see benchmark comparisons</p>
              </div>
            ) : (
              competitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{competitor.label}</div>
                      <div className="text-sm text-slate-600">{competitor.domain}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={competitor.status === "Active" ? "secondary" : "outline"}
                    >
                      {competitor.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCompetitor(competitor.id)}
                      disabled={deleteCompetitorMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}