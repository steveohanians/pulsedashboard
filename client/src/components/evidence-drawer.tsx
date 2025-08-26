import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Image as ImageIcon, 
  Gauge, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Accessibility,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CriterionScore {
  id: string;
  criterion: string;
  score: number;
  evidence: {
    description: string;
    details: Record<string, any>;
    reasoning: string;
  };
  passes: {
    passed: string[];
    failed: string[];
  };
}

interface EffectivenessData {
  overallScore: number;
  criterionScores: CriterionScore[];
  createdAt: string;
}

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  runId: string;
  effectivenessData: EffectivenessData;
}

export function EvidenceDrawer({
  isOpen,
  onClose,
  clientId,
  runId,
  effectivenessData
}: EvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState("screenshot");

  // Fetch detailed evidence when drawer opens
  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['effectiveness-evidence', clientId, runId],
    queryFn: async () => {
      const response = await fetch(`/api/effectiveness/evidence/${clientId}/${runId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    enabled: isOpen && !!runId
  });

  // Group criteria by category for different tabs
  const categorizedScores = React.useMemo(() => {
    const scores = effectivenessData.criterionScores;
    
    return {
      onPage: scores.filter(s => ['positioning', 'ux', 'brand_story', 'trust', 'ctas'].includes(s.criterion)),
      performance: scores.filter(s => s.criterion === 'speed'),
      accessibility: scores.filter(s => s.criterion === 'accessibility'),
      seo: scores.filter(s => s.criterion === 'seo')
    };
  }, [effectivenessData.criterionScores]);

  // Get criterion color based on score
  const getCriterionColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get criterion icon
  const getCriterionIcon = (criterion: string) => {
    const icons = {
      positioning: CheckCircle,
      ux: Eye,
      brand_story: CheckCircle,
      trust: CheckCircle,
      ctas: CheckCircle,
      speed: Gauge,
      accessibility: Accessibility,
      seo: Search
    };
    
    const Icon = icons[criterion as keyof typeof icons] || CheckCircle;
    return Icon;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const renderCriterionCard = (score: CriterionScore) => {
    const Icon = getCriterionIcon(score.criterion);
    
    return (
      <Card key={score.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {score.criterion.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn(
                "text-lg font-semibold px-3 py-1",
                getCriterionColor(score.score)
              )}
            >
              {score.score}/10
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {score.evidence.description}
            </p>
            
            {score.passes.passed.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Passed Checks</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {score.passes.passed.map((check, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {check.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {score.passes.failed.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Failed Checks</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {score.passes.failed.map((check, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                      {check.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
              <strong>Analysis:</strong> {score.evidence.reasoning}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-left">
                  Website Effectiveness Evidence
                </DrawerTitle>
                <DrawerDescription className="text-left">
                  Detailed analysis and evidence for {effectivenessData.overallScore}/10 score • {formatDate(effectivenessData.createdAt)}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="p-4 pb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="screenshot" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Screenshot
                </TabsTrigger>
                <TabsTrigger value="vitals" className="flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Web Vitals
                </TabsTrigger>
                <TabsTrigger value="onpage" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  On-page Signals
                </TabsTrigger>
                <TabsTrigger value="a11y-seo" className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4" />
                  A11y/SEO
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="screenshot">
                  <div className="space-y-4">
                    <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Above-fold screenshot capture will be implemented with Playwright integration
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        This will show the website as visitors first see it with annotations for key elements
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vitals">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Core Web Vitals</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Largest Contentful Paint</span>
                                <Badge variant="outline">Not available</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Cumulative Layout Shift</span>
                                <Badge variant="outline">Not available</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">First Input Delay</span>
                                <Badge variant="outline">Not available</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Performance Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              Performance metrics will be populated from PageSpeed Insights API integration
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Speed criterion details */}
                      {categorizedScores.performance.map(renderCriterionCard)}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="onpage">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {categorizedScores.onPage.map(renderCriterionCard)}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="a11y-seo">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {[...categorizedScores.accessibility, ...categorizedScores.seo].map(renderCriterionCard)}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}