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
            <CardTitle className="text-lg">
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
                <div className="mb-2">
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
                <div className="mb-2">
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
                  Website Effectiveness Report
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
                <TabsTrigger value="screenshot">
                  Screenshot
                </TabsTrigger>
                <TabsTrigger value="vitals">
                  Web Vitals
                </TabsTrigger>
                <TabsTrigger value="onpage">
                  On-page Signals
                </TabsTrigger>
                <TabsTrigger value="a11y-seo">
                  Accessibility/SEO
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="screenshot">
                  <div className="space-y-4">
                    {evidenceData?.run?.screenshotUrl ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-sm font-medium text-gray-900 mb-3">
                            Above-the-fold Website Screenshot
                          </div>
                          <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={evidenceData.run.screenshotUrl}
                              alt="Website screenshot"
                              className="w-full h-auto max-w-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="text-center p-8">
                                      <div class="text-red-500 text-sm">Screenshot failed to load</div>
                                      <div class="text-xs text-muted-foreground mt-1">URL: ${evidenceData.run.screenshotUrl}</div>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Captured on {formatDate(evidenceData.run.createdAt)} • Shows website as visitors first see it
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Screenshot not available for this analysis run
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Screenshots are captured automatically during website effectiveness analysis
                        </p>
                      </div>
                    )}
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
                                {evidenceData?.run?.webVitals?.lcp ? (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      evidenceData.run.webVitals.lcp <= 2.5 ? "text-green-600 border-green-200" :
                                      evidenceData.run.webVitals.lcp <= 4.0 ? "text-yellow-600 border-yellow-200" : 
                                      "text-red-600 border-red-200"
                                    )}
                                  >
                                    {evidenceData.run.webVitals.lcp.toFixed(1)}s
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not available</Badge>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Cumulative Layout Shift</span>
                                {evidenceData?.run?.webVitals?.cls !== undefined ? (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      evidenceData.run.webVitals.cls <= 0.1 ? "text-green-600 border-green-200" :
                                      evidenceData.run.webVitals.cls <= 0.25 ? "text-yellow-600 border-yellow-200" : 
                                      "text-red-600 border-red-200"
                                    )}
                                  >
                                    {evidenceData.run.webVitals.cls.toFixed(2)}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not available</Badge>
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">First Input Delay</span>
                                {evidenceData?.run?.webVitals?.fid !== undefined ? (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      evidenceData.run.webVitals.fid <= 100 ? "text-green-600 border-green-200" :
                                      evidenceData.run.webVitals.fid <= 300 ? "text-yellow-600 border-yellow-200" : 
                                      "text-red-600 border-red-200"
                                    )}
                                  >
                                    {Math.round(evidenceData.run.webVitals.fid)}ms
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Not available</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Performance Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {categorizedScores.performance.length > 0 && categorizedScores.performance[0].evidence?.details?.performanceScore ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm">PageSpeed Score</span>
                                  <Badge 
                                    variant="outline"
                                    className={cn(
                                      "text-lg font-semibold px-3 py-1",
                                      categorizedScores.performance[0].evidence.details.performanceScore >= 80 ? "text-green-600 border-green-200" :
                                      categorizedScores.performance[0].evidence.details.performanceScore >= 50 ? "text-yellow-600 border-yellow-200" : 
                                      "text-red-600 border-red-200"
                                    )}
                                  >
                                    {Math.round(categorizedScores.performance[0].evidence.details.performanceScore)}/100
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Based on PageSpeed Insights analysis
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Performance metrics will be populated from PageSpeed Insights API integration
                              </p>
                            )}
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