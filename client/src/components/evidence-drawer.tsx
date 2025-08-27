import React, { useState, useEffect } from "react";
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

// Utility function to convert markdown bold (**text**) to HTML
const formatMarkdown = (text: string) => {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

// Generate appropriate messages for failed checks instead of generic "Not found in content"
const getFailedCheckMessage = (check: string): string => {
  const messages: Record<string, string> = {
    // Accessibility checks
    no_skip_links: 'Skip navigation links not implemented',
    no_aria_attributes: 'ARIA attributes missing or insufficient',
    poor_alt_text_coverage: 'Images missing descriptive alt text',
    poor_heading_structure: 'Heading hierarchy not properly structured',
    no_language_declared: 'Page language not declared in HTML',
    no_accessibility_tools: 'Accessibility enhancement tools not detected',
    poor_focus_management: 'Keyboard navigation focus not properly managed',
    
    // Brand Story checks
    no_clear_pov: 'Company point of view or stance not clearly expressed',
    no_clear_approach: 'Methodology or approach not explained',
    no_outcomes_stated: 'Results or achievements not mentioned',
    no_proof_elements: 'Credibility indicators or proof points missing',
    
    // CTAs checks
    few_above_fold_ctas: 'Insufficient call-to-action buttons above the fold',
    no_primary_cta: 'Primary call-to-action not clearly identified',
    no_secondary_paths: 'Alternative engagement options not available',
    message_mismatch: 'CTA messaging inconsistent across the page',
    
    // Positioning checks
    brevity_check: 'Value proposition too lengthy or unclear',
    no_audience_named: 'Target audience not clearly identified',
    no_outcome_present: 'Expected outcome or benefit not stated',
    no_capability_clear: 'Core capabilities or services not clearly defined',
    
    // SEO checks  
    no_sitemap: 'XML sitemap not found or accessible',
    no_structured_data: 'Schema markup or structured data missing',
    poor_title_optimization: 'Page title not optimized for search engines',
    poor_meta_description: 'Meta description missing or not optimized',
    no_unique_h1: 'H1 heading missing or not unique',
    no_canonical_present: 'Canonical URL not specified',
    blocks_indexing: 'Page blocks search engine indexing',
    poor_url_structure: 'URL structure not SEO-friendly',
    poor_social_optimization: 'Open Graph or social media tags incomplete',
    poor_content_optimization: 'Content not optimized for target keywords',
    poor_page_structure: 'Page structure not optimized for SEO',
    
    // Trust checks
    no_third_party_proof: 'Third-party endorsements or testimonials missing',
    weak_trust_language: 'Trust-building language insufficient',
    insufficient_logos: 'Not enough client or partner logos displayed',
    no_recent_proof: 'Recent success stories or case studies missing',
    few_case_stories: 'Limited case studies or client examples',
    
    // Speed checks
    lcp_poor: 'Largest Contentful Paint loading time too slow',
    cls_poor: 'Cumulative Layout Shift causing visual instability',
    fid_poor: 'First Input Delay causing interaction delays',
    
    // UX checks
    poor_heading_hierarchy: 'Heading structure doesn\'t follow proper hierarchy',
    poor_line_length: 'Text line length not optimized for readability',
    limited_interactivity: 'Interactive elements insufficient or missing',
    not_responsive: 'Design not optimized for mobile devices',
    no_css_framework: 'Modern CSS framework not implemented',
    limited_accessibility: 'Accessibility features insufficient',
    no_navigation: 'Navigation structure unclear or missing',
  };
  
  return messages[check] || 'Requirement not met on this page';
};

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

// Component to handle screenshot display with better error handling
function ScreenshotDisplay({ url, runData }: { url: string; runData: any }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [url]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  if (imageError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          Screenshot Not Available
        </p>
        <p className="text-sm text-gray-600 text-center max-w-md mb-4">
          The screenshot could not be loaded. This may be due to:
        </p>
        <ul className="text-sm text-gray-600 text-left space-y-1 mb-4">
          <li>• Browser dependencies not installed on the server</li>
          <li>• Network timeout when accessing the website</li>
          <li>• Website blocking automated screenshots</li>
        </ul>
        {runData?.screenshotMethod && (
          <p className="text-xs text-gray-500">
            Method attempted: {runData.screenshotMethod}
          </p>
        )}
        {runData?.screenshotError && (
          <details className="mt-4 text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">
              Technical details
            </summary>
            <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-x-auto max-w-md">
              {runData.screenshotError}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <>
      {imageLoading && (
        <div className="flex items-center justify-center p-8 bg-gray-50 min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
            <p className="text-sm text-gray-600">Loading screenshot...</p>
          </div>
        </div>
      )}
      <img
        src={url}
        alt="Website screenshot"
        className={cn(
          "w-full h-auto max-w-full",
          imageLoading && "hidden"
        )}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </>
  );
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
              {(() => {
                const formatted = score.criterion.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                // Handle specific acronyms
                return formatted
                  .replace(/\bCtas\b/g, 'CTAs')
                  .replace(/\bUx\b/g, 'UX')
                  .replace(/\bSeo\b/g, 'SEO');
              })()}
            </CardTitle>
            <div className="text-2xl lg:text-3xl font-light text-primary">
              {score.score}
            </div>
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
                <div className="space-y-2">
                  {score.passes.passed.map((check, index) => {
                    // Updated evidence key mapping for new brand story logic
                    let evidenceKey = '';
                    let evidence = null;
                    
                    // Brand story specific mappings
                    if (score.criterion === 'brand_story') {
                      const evidenceMapping: Record<string, string> = {
                        'pov_present': 'pov',
                        'mechanism_described': 'mechanism', 
                        'mechanism_named': 'mechanism',
                        'quantified_outcomes': 'outcomes_quantified',
                        'outcomes_mentioned': 'outcomes',
                        'strong_proof_elements': 'proof',
                        'some_proof_elements': 'proof',
                        'industry_focus': 'bonusPoints',
                        'capability_breadth': 'bonusPoints'
                      };
                      evidenceKey = evidenceMapping[check] || check;
                      evidence = score.evidence.details[evidenceKey];
                      
                      // Special handling for bonus points
                      if (check === 'industry_focus' || check === 'capability_breadth') {
                        evidence = `Bonus points awarded: +${score.evidence.details.bonusPoints || 0}`;
                      }
                    } else {
                      // Legacy evidence key transformation for other criteria
                      evidenceKey = `${check.replace('_named', '_evidence').replace('_present', '_evidence').replace('_clear', '_evidence').replace('_check', '_evidence')}`;
                      evidence = score.evidence.details[evidenceKey];
                    }
                    
                    return (
                      <div key={index} className="flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            {check.replace(/_/g, ' ')}
                          </Badge>
                          {evidence && (
                            <span className="text-xs text-gray-600 italic">
                              "{evidence}"
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {score.passes.failed.length > 0 && (
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-red-600">Failed Checks</span>
                </div>
                <div className="space-y-2">
                  {score.passes.failed.map((check, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {check.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-gray-500 italic">
                        {getFailedCheckMessage(check)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
              <strong>Analysis:</strong>{" "}
              <span 
                dangerouslySetInnerHTML={{
                  __html: formatMarkdown(score.evidence.reasoning)
                }}
              />
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
                  Detailed analysis and evidence for {effectivenessData.overallScore} score • {formatDate(effectivenessData.createdAt)}
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
                    {evidenceData?.run?.screenshotUrl && evidenceData.run.screenshotUrl !== '' ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-sm font-medium text-gray-900 mb-3">
                            Above-the-fold Website Screenshot
                          </div>
                          <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                            <ScreenshotDisplay 
                              url={evidenceData.run.screenshotUrl}
                              runData={evidenceData.run}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Captured on {formatDate(evidenceData.run.createdAt)} • Shows website as visitors first see it
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                        <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          No Screenshot Available
                        </p>
                        <p className="text-sm text-gray-600 mb-4">
                          A screenshot was not captured during this analysis.
                        </p>
                        {evidenceData?.run?.status === 'failed' ? (
                          <p className="text-xs text-red-600">
                            The analysis may have encountered errors.
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Screenshots help visualize the analyzed website but are not required for scoring.
                          </p>
                        )}
                        {evidenceData?.run?.screenshotError && (
                          <details className="mt-4 text-xs text-gray-500">
                            <summary className="cursor-pointer hover:text-gray-700">
                              Why did this happen?
                            </summary>
                            <div className="mt-2 p-3 bg-white rounded border text-left max-w-md mx-auto">
                              <p className="mb-2">Possible reasons:</p>
                              <ul className="space-y-1 ml-4">
                                <li>• Server missing screenshot dependencies</li>
                                <li>• Website blocked automated access</li>
                                <li>• Network timeout occurred</li>
                              </ul>
                            </div>
                          </details>
                        )}
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
                            {/* Check if speed criterion has API error */}
                            {categorizedScores.performance.length > 0 && 
                             categorizedScores.performance[0].evidence?.details?.apiStatus === 'failed' ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                                    Data Unavailable
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {categorizedScores.performance[0].evidence?.details?.error === 'quota_exceeded' 
                                    ? "PageSpeed API quota exceeded. Web Vitals cannot be retrieved at this time."
                                    : "Unable to fetch Core Web Vitals data from PageSpeed API."}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Please try again later or check API configuration.
                                </p>
                              </div>
                            ) : (
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
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Performance Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {categorizedScores.performance.length > 0 ? (
                              categorizedScores.performance[0].evidence?.details?.apiStatus === 'failed' ? (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-red-600 border-red-200">
                                      API Error
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {categorizedScores.performance[0].evidence.description || "Performance data unavailable"}
                                  </p>
                                  {categorizedScores.performance[0].evidence?.details?.error === 'quota_exceeded' && (
                                    <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                                      PageSpeed API quota exceeded. Try again later or check API limits.
                                    </div>
                                  )}
                                </div>
                              ) : categorizedScores.performance[0].evidence?.details?.performanceScore ? (
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
                              )
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Performance metrics will be populated from PageSpeed Insights API integration
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* Speed criterion details removed from Web Vitals tab */}
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