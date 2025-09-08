import React, { useState, useEffect, useCallback, useRef } from "react";
import { ButtonLoadingSpinner } from "@/components/loading";
import { useEffectivenessEvidence } from "@/hooks/useEffectivenessEvidence";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Tooltip, 
  TooltipTrigger, 
  TooltipContent, 
  TooltipProvider 
} from "@/components/ui/tooltip";
import { 
  X, 
  Image as ImageIcon, 
  Gauge, 
  CheckCircle, 
  AlertTriangle,
  AlertCircle,
  Eye,
  Accessibility,
  Search,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

// Utility function to convert markdown bold (**text**) to HTML
const formatMarkdown = (text: string) => {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
};

// Extract web vitals from speed criterion evidence
const extractWebVitals = (currentRunData: any) => {
  const speedCriterion = currentRunData?.criterionScores?.find((c: any) => c.criterion === 'speed');
  if (speedCriterion?.evidence?.details?.webVitals) {
    return speedCriterion.evidence.details.webVitals;
  }
  return null;
};

// Generate appropriate messages for failed checks instead of generic "Not found in content"
const getFailedCheckMessage = (check: string): string => {
  const messages: Record<string, string> = {
    // Accessibility checks
    no_skip_links: 'Skip navigation links not implemented',
    no_aria_attributes: 'ARIA attributes missing or insufficient',
    insufficient_aria: 'ARIA implementation needs improvement',
    poor_alt_text_coverage: 'Images missing descriptive alt text',
    poor_heading_structure: 'Heading hierarchy not properly structured',
    improper_heading_structure: 'Heading hierarchy not properly structured',
    no_language_declared: 'Page language not declared in HTML',
    no_language_declaration: 'Page language not declared in HTML',
    no_accessibility_tools: 'Accessibility enhancement tools not detected',
    poor_focus_management: 'Keyboard navigation focus not properly managed',
    no_focus_management: 'Focus management for keyboard navigation missing',
    no_semantic_structure: 'Semantic HTML structure missing',
    missing_form_labels: 'Form inputs missing accessible labels',
    improper_button_link_usage: 'Buttons and links not used semantically',
    comprehensive_aria: 'Comprehensive ARIA implementation detected',
    meaningful_alt_text: 'Images have meaningful descriptive text',
    proper_button_link_semantics: 'Buttons and links used semantically correct',
    
    // Brand Story checks
    no_clear_pov: 'Company point of view or stance not clearly expressed',
    no_clear_approach: 'Methodology or approach not explained',
    no_outcomes_stated: 'Results or achievements not mentioned',
    no_proof_elements: 'Credibility indicators or proof points missing',
    visual_story_weak: 'Visual elements do not support the brand story narrative',
    
    // CTAs checks (new advanced system - 5 separate checks)
    no_primary_cta: 'No primary call-to-action found on the page',
    no_above_fold_cta: 'No primary CTA visible above the fold',
    no_page_end_cta: 'No primary CTA at page end or footer',
    no_block_closure: 'Content blocks do not end with primary CTAs',
    no_cta_reinforcement: 'Insufficient CTA reinforcement across the page',
    cta_conflict: 'Conflicting primary CTAs compete for user attention',
    only_secondary_ctas: 'Only secondary CTAs found, no primary conversion actions',
    visual_cta_unassessed: 'Visual CTA elements could not be properly assessed',
    // Legacy CTA checks (for backward compatibility)
    few_above_fold_ctas: 'Insufficient call-to-action buttons above the fold',
    no_secondary_paths: 'Alternative engagement options not available',
    message_mismatch: 'CTA messaging inconsistent across the page',
    no_clear_hierarchy: 'CTA hierarchy not clearly established',
    visual_ctas_weak: 'Visual CTA design not effective for conversion',
    
    // Positioning checks
    no_target_audience: 'Target audience not clearly identified',
    no_specific_value: 'Expected outcome or benefit not stated',
    no_capability_clear: 'Core capabilities or services not clearly defined',
    headline_too_long: 'Headline exceeds recommended word count',
    visual_positioning_weak: 'Visual elements do not support positioning message',
    
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
    poor_h1_structure: 'H1 heading structure needs improvement',
    https_enabled: 'Site uses secure HTTPS protocol',
    mobile_optimized: 'Site optimized for mobile devices',
    performance_optimized: 'Modern performance optimizations detected',
    
    // Trust checks
    no_media_coverage: 'No media mentions or press coverage found',
    media_coverage: 'Media mentions present but not from major outlets',
    major_media_coverage: 'Featured in major media outlets',
    no_third_party_proof: 'Third-party certifications or awards missing',
    some_third_party_proof: 'Some third-party endorsements present',
    third_party_proof: 'Strong third-party certifications or awards present',
    weak_trust_language: 'Trust-building language insufficient',
    some_trust_language: 'Some trust indicators present',
    trust_language: 'Strong trust language and scale indicators',
    insufficient_logos: 'Not enough client or partner logos displayed',
    some_logos: 'Some client or partner logos present',
    sufficient_logos: 'Multiple client or partner logos displayed',
    no_recent_proof: 'Recent dates or current content missing',
    recent_proof: 'Recent dates and current content present',
    no_case_stories: 'No case studies or testimonials found',
    some_case_stories: 'Limited case studies or client examples',
    multiple_case_stories: 'Multiple case studies and testimonials present',
    
    // UX checks (updated for modern patterns)
    poor_layout: 'Page structure and visual hierarchy need improvement',
    basic_layout: 'Basic page structure present but could be enhanced',
    content_width_issues: 'Content width not optimized for readability',
    limited_interactivity: 'Interactive elements insufficient for engagement',
    no_mobile_optimization: 'Design not optimized for mobile devices',
    basic_mobile_support: 'Basic mobile support but not fully optimized',
    basic_styling: 'Modern design patterns not detected',
    poor_interactivity: 'Interactive elements insufficient or missing',
    not_responsive: 'Design not optimized for mobile devices',
    no_accessibility_features: 'Accessibility features missing or insufficient',
    
    // Speed checks
    lcp_poor: 'Largest Contentful Paint loading time too slow',
    cls_poor: 'Cumulative Layout Shift causing visual instability',
    fid_poor: 'First Input Delay causing interaction delays',
  };
  
  return messages[check] || 'Requirement not met on this page';
};

// Smart dynamic evidence mapping function
function findEvidenceForCheck(checkName: string, evidenceDetails: any): string | null {
  // Look in analysis object for evidence patterns first (most common location)
  const analysis = evidenceDetails.analysis || {};
  
  // 1. Pattern-based matching for evidence fields (specific mappings first)
  const evidencePatterns = [
    // Brand story specific mappings (FIRST - highest priority)
    checkName.replace(/^pov_present$/, 'pov_evidence'),
    checkName.replace(/^mechanism_described$/, 'mechanism_evidence'),
    checkName.replace(/^outcomes_stated$/, 'outcomes_evidence'),
    checkName.replace(/^proof_elements$/, 'proof_evidence'),
    checkName.replace(/^visual_supports_story$/, 'visual_supports_evidence'),
    checkName.replace(/^visual_story_weak$/, 'visual_supports_evidence'),
    checkName.replace(/^visual_story_weak$/, 'visual_effectiveness'),
    
    // CTA specific mappings (advanced system - 5 separate checks)
    checkName.replace(/^cta_present$/, 'cta_evidence'),
    checkName.replace(/^cta_above_fold$/, 'cta_evidence'),
    checkName.replace(/^cta_page_end$/, 'cta_evidence'),
    checkName.replace(/^cta_block_closure$/, 'cta_evidence'),
    checkName.replace(/^cta_reinforcement$/, 'cta_evidence'),
    checkName.replace(/^cta_conflict$/, 'cta_evidence'),
    // Legacy CTA mappings
    checkName.replace(/^above_fold_present$/, 'above_fold_evidence'),
    checkName.replace(/^clear_hierarchy$/, 'hierarchy_evidence'),
    checkName.replace(/^message_match$/, 'message_evidence'),
    checkName.replace(/^secondary_paths$/, 'secondary_evidence'),
    checkName.replace(/^visual_supports_ctas$/, 'visual_supports_evidence'),
    checkName.replace(/^visual_ctas_weak$/, 'visual_supports_evidence'),
    checkName.replace(/^visual_ctas_weak$/, 'visual_effectiveness'),
    
    // Positioning specific mappings
    checkName.replace(/^audience_identified$/, 'audience_evidence'),
    checkName.replace(/^value_stated$/, 'outcome_evidence'),
    checkName.replace(/^capability_clear$/, 'capability_evidence'),
    checkName.replace(/^concise_messaging$/, 'brevity_evidence'),
    checkName.replace(/^visual_supports_positioning$/, 'visual_supports_evidence'),
    checkName.replace(/_positioning$/, '_evidence'),
    
    // UX specific mappings
    checkName === 'excellent_layout' ? 'modernUXScore' : null,
    checkName === 'good_layout' ? 'modernUXScore' : null,
    checkName === 'readable_content' ? 'hasReadableWidth' : null,
    checkName === 'rich_interactivity' ? 'interactiveElements' : null,
    checkName === 'adequate_interactivity' ? 'interactiveElements' : null,
    checkName === 'mobile_optimized' ? 'hasMobileOptimization' : null,
    checkName === 'modern_styling' ? 'hasFramework' : null,
    checkName === 'accessibility_features' ? 'hasAltTexts' : null,
    
    // Generic mappings (lower priority)
    checkName.replace(/_identified$/, '_evidence'),
    checkName.replace(/_clear$/, '_evidence').replace(/_present$/, '_evidence').replace(/_named$/, '_evidence').replace(/_check$/, '_evidence').replace(/_described$/, '_evidence').replace(/_stated$/, '_evidence').replace(/_elements$/, '_evidence'),
    
    // Direct evidence field match (last resort)
    checkName + '_evidence'
  ];
  
  // Try evidence patterns in analysis object (filter out nulls)
  for (const pattern of evidencePatterns.filter(p => p !== null)) {
    if (analysis[pattern] && typeof analysis[pattern] === 'string') {
      return analysis[pattern];
    }
  }
  
  // 2. Try evidence patterns at root level (filter out nulls)
  for (const pattern of evidencePatterns.filter(p => p !== null)) {
    if (evidenceDetails[pattern] && typeof evidenceDetails[pattern] === 'string') {
      return evidenceDetails[pattern];
    }
  }
  
  return null;
}

// Fallback detection logic
const isFallbackScore = (criterion: CriterionScore): boolean => {
  return !!(criterion.evidence?.details?.fallback || 
           criterion.evidence?.details?.fallbackUsed ||
           criterion.evidence?.details?.screenshotQuality === 'placeholder' ||
           criterion.evidence?.details?.htmlQuality === 'fallback' ||
           criterion.evidence?.details?.apiStatus === 'fallback_used');
};

// Helper function to explain fallback reason
const getFallbackReason = (criterion: CriterionScore): string => {
  const details = criterion.evidence?.details;
  if (details?.screenshotQuality === 'placeholder') {
    return 'Screenshot unavailable - visual analysis limited';
  }
  if (details?.htmlQuality === 'fallback') {
    return 'Website content unavailable - using estimated data';
  }
  if (details?.apiStatus === 'fallback_used') {
    return 'Performance data estimated - API unavailable';
  }
  if (details?.fallback || details?.fallbackUsed) {
    return 'Analyzed using backup methods due to service limitations';
  }
  return 'Score calculated with limited data';
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
  clientRun: {
    id: string;
    overallScore: number;
    criterionScores: CriterionScore[];
    createdAt: string;
    screenshotUrl?: string;
    fullPageScreenshotUrl?: string;
    webVitals?: any;
    screenshotError?: string;
    fullPageScreenshotError?: string;
    status: string;
    progress?: string;
  };
  competitorData?: {
    competitor: {
      id: string;
      domain: string;
      label: string;
    };
    run: {
      id: string;
      overallScore: number;
      criterionScores: CriterionScore[];
      createdAt: string;
      screenshotUrl?: string;
      fullPageScreenshotUrl?: string;
      webVitals?: any;
      screenshotError?: string;
      fullPageScreenshotError?: string;
      status: string;
      progress?: string;
    };
  }[];
}

// RunSelector component for switching between client and competitor data
interface RunSelectorProps {
  clientRun: any;
  competitorData: any[];
  selectedRunId: string;
  onRunChange: (runId: string, runType: 'client' | 'competitor') => void;
}

function RunSelector({ clientRun, competitorData, selectedRunId, onRunChange }: RunSelectorProps) {
  const handleValueChange = (runId: string) => {
    const runType = runId === clientRun.id ? 'client' : 'competitor';
    onRunChange(runId, runType);
  };

  const selectOptions = [
    {
      value: clientRun.id,
      label: `Your Site (${clientRun.overallScore})`
    },
    ...competitorData.map(compData => ({
      value: compData.run.id,
      label: `${compData.competitor.label} (${compData.run.overallScore})`
    }))
  ];

  return (
    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
      <label className="text-sm font-medium text-gray-700">Viewing data for:</label>
      <NativeSelect
        value={selectedRunId}
        onChange={(e) => handleValueChange(e.target.value)}
        options={selectOptions}
        className="w-64"
        placeholder="Select data source"
      />
    </div>
  );
}

// ErrorDisplay component for showing errors with technical details
interface ErrorDisplayProps {
  title: string;
  message: string;
  details?: string;
  type?: 'warning' | 'error';
}

function ErrorDisplay({ title, message, details, type = 'warning' }: ErrorDisplayProps) {
  const isError = type === 'error';
  
  return (
    <Alert variant={isError ? 'destructive' : 'default'} className={cn(!isError && "border-yellow-200 bg-yellow-50")}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className={cn(!isError && "text-yellow-800")}>{title}</AlertTitle>
      <AlertDescription className={cn(!isError && "text-yellow-700")}>
        {message}
        {details && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm hover:opacity-80">
              Technical Details
            </summary>
            <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-x-auto max-w-full">
              {details}
            </pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
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
            <ButtonLoadingSpinner size="md" className="mb-4 mx-auto" />
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
  clientRun,
  competitorData = []
}: EvidenceDrawerProps) {
  const [activeTab, setActiveTab] = useState("screenshot");
  const [selectedRunId, setSelectedRunId] = useState(clientRun.id);
  const [selectedRunType, setSelectedRunType] = useState<'client' | 'competitor'>('client');
  const isUnmountedRef = useRef(false);

  // Find current run data
  const currentRunData = selectedRunType === 'client' 
    ? clientRun
    : competitorData.find(comp => comp.run.id === selectedRunId)?.run;
  
  // Reset selection when drawer opens with cleanup
  useEffect(() => {
    if (isOpen && !isUnmountedRef.current) {
      setSelectedRunId(clientRun.id);
      setSelectedRunType('client');
      setActiveTab("screenshot");
    }
  }, [isOpen, clientRun.id]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // Use embedded evidence from criterion scores (no API call needed)
  const { 
    evidence: evidenceData, 
    isLoading, 
    error, 
    refetch 
  } = useEffectivenessEvidence(
    currentRunData?.criterionScores || null, // Use embedded criterion scores
    undefined, // Get all evidence, not specific criterion
    {
      enabled: isOpen && !!currentRunData
    }
  );

  // Group criteria by category for different tabs
  const categorizedScores = React.useMemo(() => {
    const scores = currentRunData?.criterionScores || [];
    
    return {
      onPage: scores.filter(s => ['positioning', 'ux', 'brand_story', 'trust', 'ctas'].includes(s.criterion)),
      performance: scores.filter(s => s.criterion === 'speed'),
      accessibility: scores.filter(s => s.criterion === 'accessibility'),
      seo: scores.filter(s => s.criterion === 'seo')
    };
  }, [currentRunData?.criterionScores]);

  // Memoized callback for safe run selection
  const handleRunSelection = useCallback((runId: string, runType: 'client' | 'competitor') => {
    if (!isUnmountedRef.current) {
      setSelectedRunId(runId);
      setSelectedRunType(runType);
    }
  }, []);

  // Memoized callback for safe tab changes
  const handleTabChange = useCallback((tabValue: string) => {
    if (!isUnmountedRef.current) {
      setActiveTab(tabValue);
    }
  }, []);

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
    const isUsingFallback = isFallbackScore(score);
    
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
            <div className="flex items-center gap-2">
              <div className={cn(
                "text-2xl lg:text-3xl font-light text-primary",
                isUsingFallback ? "opacity-75" : ""
              )}>
                {score.score}
              </div>
              {isUsingFallback && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Limited Data
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Score based on limited data - some services were unavailable</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {isUsingFallback && (
            <div className="mt-1 text-xs text-muted-foreground">
              {getFallbackReason(score)}
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {score.evidence?.description && (
              <p className="text-sm text-muted-foreground">
                {score.evidence.description}
              </p>
            )}
            
            {score.passes?.passed?.length > 0 && (
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-green-600">Passed Checks</span>
                </div>
                <div className="space-y-2">
                  {score.passes?.passed?.map((check, index) => {
                    // Updated evidence key mapping for new brand story logic
                    let evidenceKey = '';
                    let evidence = null;
                    
                    // Brand story specific mappings
                    if (score.criterion === 'brand_story') {
                      const evidenceMapping: Record<string, string> = {
                        'pov_present': 'pov_evidence',
                        'mechanism_described': 'mechanism_evidence', 
                        'mechanism_named': 'mechanism_evidence',
                        'outcomes_stated': 'outcomes_evidence',
                        'proof_elements': 'proof_evidence',
                        'visual_supports_story': 'visual_supports_evidence',
                        'quantified_outcomes': 'outcomes_quantified',
                        'outcomes_mentioned': 'outcomes',
                        'strong_proof_elements': 'proof',
                        'some_proof_elements': 'proof',
                        'industry_focus': 'bonusPoints',
                        'capability_breadth': 'bonusPoints'
                      };
                      evidenceKey = evidenceMapping[check] || check;
                      evidence = score.evidence?.details?.[evidenceKey];
                    } else if (score.criterion === 'ctas') {
                      // CTA specific mappings (advanced system - 5 separate checks)
                      const evidenceMapping: Record<string, string> = {
                        'cta_present': 'cta_evidence',
                        'cta_above_fold': 'cta_evidence',
                        'cta_page_end': 'cta_evidence',
                        'cta_block_closure': 'cta_evidence',
                        'cta_reinforcement': 'cta_evidence',
                        'cta_conflict': 'cta_evidence',
                        // Legacy CTA mappings for backward compatibility
                        'above_fold_present': 'above_fold_evidence',
                        'clear_hierarchy': 'hierarchy_evidence',
                        'message_match': 'message_evidence', 
                        'secondary_paths': 'secondary_evidence',
                        'visual_supports_ctas': 'visual_supports_evidence',
                        'multiple_above_fold_ctas': 'above_fold_evidence',
                        'above_fold_cta_present': 'above_fold_evidence',
                        'clear_cta_hierarchy': 'hierarchy_evidence',
                        'primary_cta_present': 'hierarchy_evidence',
                        'secondary_paths_available': 'secondary_evidence',
                        'message_match_verified': 'message_evidence',
                        'ctas_present': 'message_evidence'
                      };
                      evidenceKey = evidenceMapping[check] || check;
                      evidence = score.evidence?.details?.[evidenceKey];
                      
                      // Enhanced CTA evidence handling
                      if (check === 'cta_present' && score.evidence?.details.cta_primary_examples) {
                        const primaryCTAs = score.evidence?.details.cta_primary_examples;
                        const secondaryCTAs = score.evidence?.details.cta_secondary_examples || [];
                        const groups = score.evidence?.details.primary_cta_groups_used || [];
                        
                        let ctaDetails = `Primary CTAs: ${primaryCTAs.join(', ')}`;
                        if (secondaryCTAs.length > 0) {
                          ctaDetails += ` | Secondary: ${secondaryCTAs.join(', ')}`;
                        }
                        if (groups.length > 0) {
                          ctaDetails += ` | Groups: [${groups.join(', ')}]`;
                        }
                        evidence = ctaDetails;
                      } else if (check === 'cta_above_fold') {
                        // Show primary CTAs found above fold
                        const primaryCTAs = score.evidence?.details.cta_primary_examples || [];
                        evidence = primaryCTAs.length > 0 
                          ? `Above-fold primary CTAs: ${primaryCTAs.join(', ')}`
                          : 'Primary CTA found above the fold';
                      } else if (check === 'cta_page_end') {
                        // Show page-end specific evidence
                        const primaryCTAs = score.evidence?.details.cta_primary_examples || [];
                        evidence = `Page-end CTAs: ${primaryCTAs.join(', ')}`;
                      } else if (check === 'cta_block_closure') {
                        // Show block closure specific evidence
                        const blockExamples = score.evidence?.details.cta_block_examples || [];
                        const primaryCTAs = score.evidence?.details.cta_primary_examples || [];
                        
                        if (blockExamples.length > 0) {
                          evidence = `Block closure in: ${blockExamples.join(', ')} with CTAs: ${primaryCTAs.join(', ')}`;
                        } else {
                          evidence = `Block closure with CTAs: ${primaryCTAs.join(', ')}`;
                        }
                      } else if (check === 'cta_reinforcement') {
                        // Show reinforcement evidence
                        const strengthScore = score.evidence?.details.cta_strength_score || 0;
                        evidence = `Reinforcement detected (strength: ${(strengthScore * 10).toFixed(1)}/10)`;
                      }
                      
                      // Special handling for trust media coverage
                      if (check === 'major_media_coverage' || check === 'media_coverage') {
                        const featuredCount = score.evidence?.details.featuredInSections || 0;
                        const hasMajor = score.evidence?.details.hasMajorMedia || false;
                        if (hasMajor) {
                          evidence = `Featured in major media outlets (${featuredCount} sections found)`;
                        } else if (featuredCount > 0) {
                          evidence = `Media mentions found (${featuredCount} sections)`;
                        }
                      }
                      
                      // Special handling for trust metrics
                      if (check === 'sufficient_logos' || check === 'some_logos') {
                        const logoCount = score.evidence?.details.customerLogos || 0;
                        evidence = `${logoCount} client/partner logos found`;
                      }
                      
                      if (check === 'multiple_case_stories' || check === 'some_case_stories') {
                        const testimonials = score.evidence?.details.testimonials || 0;
                        const caseStudies = score.evidence?.details.caseStudies || 0;
                        evidence = `${testimonials} testimonials, ${caseStudies} case studies`;
                      }
                      
                      if (check === 'trust_language' || check === 'some_trust_language') {
                        const metrics = score.evidence?.details.numberMatches || [];
                        if (metrics.length > 0) {
                          evidence = `Trust indicators: ${metrics.slice(0, 2).join(', ')}`;
                        }
                      }
                      
                      // Special handling for bonus points
                      if (check === 'industry_focus' || check === 'capability_breadth') {
                        evidence = `Bonus points awarded: +${score.evidence?.details.bonusPoints || 0}`;
                      }
                    } else if (score.criterion === 'ux') {
                      // Special handling for UX metrics
                      if (check === 'excellent_layout' || check === 'good_layout') {
                        const modernScore = score.evidence?.details.modernUXScore || 0;
                        evidence = `${modernScore} modern UX patterns detected`;
                      } else if (check === 'readable_content') {
                        evidence = 'Optimized content width for readability';
                      } else if (check === 'rich_interactivity' || check === 'adequate_interactivity') {
                        const elements = score.evidence?.details.interactiveElements || 0;
                        const buttons = score.evidence?.details.meaningfulButtons || 0;
                        evidence = `${elements} interactive elements${buttons > 0 ? ` (${buttons} CTAs)` : ''}`;
                      } else if (check === 'mobile_optimized' || check === 'basic_mobile_support') {
                        evidence = 'Mobile viewport and responsive design detected';
                      } else if (check === 'modern_styling') {
                        evidence = 'Modern CSS patterns and framework detected';
                      } else if (check === 'accessibility_features' || check === 'some_accessibility') {
                        const altTexts = score.evidence?.details.altTexts || 0;
                        const ariaLabels = score.evidence?.details.ariaLabels || 0;
                        evidence = `${altTexts} alt texts, ${ariaLabels} ARIA labels`;
                      }
                    } else {
                      // Smart dynamic evidence mapping for all other criteria
                      evidence = findEvidenceForCheck(check, score.evidence?.details);
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
            
            {score.passes?.failed?.length > 0 && (
              <div>
                <div className="mb-2">
                  <span className="text-sm font-medium text-red-600">Failed Checks</span>
                </div>
                <div className="space-y-2">
                  {score.passes?.failed?.map((check, index) => (
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
              {score.evidence?.reasoning && (
                <span 
                  dangerouslySetInnerHTML={{
                    __html: formatMarkdown(score.evidence.reasoning)
                  }}
                />
              )}
              {score.criterion === 'ctas' && score.evidence?.details.cta_strength_score !== undefined && (
                <span className="ml-2 font-medium">
                  | Strength Score: {(score.evidence?.details.cta_strength_score * 10).toFixed(1)}/10
                </span>
              )}
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
                  Detailed analysis and evidence for <span className="font-bold text-black">{currentRunData?.overallScore}</span> score • {formatDate(currentRunData?.createdAt || '')}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Competitor Selector */}
          {competitorData && competitorData.length > 0 && (
            <div className="px-4">
              <RunSelector
                clientRun={clientRun}
                competitorData={competitorData}
                selectedRunId={selectedRunId}
                onRunChange={handleRunSelection}
              />
            </div>
          )}


          <div className="p-4 pb-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <ButtonLoadingSpinner size="md" className="mb-4" />
                  <p className="text-sm text-muted-foreground">Loading evidence data...</p>
                </div>
              </div>
            ) : (
            <Tabs value={activeTab} onValueChange={handleTabChange}>
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
                {/* Fallback Summary Alert */}
                {(() => {
                  const fallbackCount = (currentRunData?.criterionScores || []).filter(isFallbackScore).length;
                  return fallbackCount > 0 ? (
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Limited Data Available</AlertTitle>
                      <AlertDescription>
                        {fallbackCount} {fallbackCount === 1 ? 'criterion was' : 'criteria were'} scored 
                        using backup methods due to temporary service limitations. Scores may be more 
                        conservative than usual.
                      </AlertDescription>
                    </Alert>
                  ) : null;
                })()}
                
                <TabsContent value="screenshot">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {/* Add error display for screenshot errors */}
                      {currentRunData?.screenshotError && (
                        <ErrorDisplay
                          title="Screenshot Capture Failed"
                          message="Unable to capture website screenshot"
                          details={currentRunData.screenshotError}
                          type="warning"
                        />
                      )}
                      
                      {/* Add timeout error display */}
                      {currentRunData?.progress?.includes('timeout') && (
                        <ErrorDisplay
                          title="Analysis Timeout"
                          message="Website analysis timed out during processing"
                          details={evidenceData.run.progress}
                          type="error"
                        />
                      )}

                      {/* Add general query error display with retry */}
                      {error && (
                        <div className="space-y-3">
                          <ErrorDisplay
                            title="Failed to Load Evidence"
                            message="Unable to fetch evidence data for this analysis"
                            details={error instanceof Error ? error.message : String(error)}
                            type="error"
                          />
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refetch()}
                              className="gap-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Retry Loading Evidence
                            </Button>
                          </div>
                        </div>
                      )}

                    {currentRunData?.screenshotUrl && currentRunData.screenshotUrl !== '' ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border bg-white p-4">
                          <div className="text-sm font-medium text-gray-900 mb-3">
                            Above-the-fold Website Screenshot
                          </div>
                          <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                            <ScreenshotDisplay 
                              url={currentRunData.screenshotUrl}
                              runData={currentRunData}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Captured on {formatDate(currentRunData.createdAt)} • Shows website as visitors first see it
                          </p>
                        </div>

                        {/* Full-Page Screenshot Section */}
                        {currentRunData?.fullPageScreenshotUrl && currentRunData.fullPageScreenshotUrl !== '' ? (
                          <div className="rounded-lg border bg-white p-4">
                            <div className="text-sm font-medium text-gray-900 mb-3">
                              Full-Page Website Screenshot
                            </div>
                            <div className="relative border rounded-lg overflow-hidden bg-gray-50">
                              <ScreenshotDisplay 
                                url={currentRunData.fullPageScreenshotUrl}
                                runData={currentRunData}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Captured on {formatDate(currentRunData.createdAt)} • Shows complete website layout and content flow
                            </p>
                          </div>
                        ) : currentRunData?.fullPageScreenshotError && (
                          <div className="rounded-lg border bg-yellow-50 p-4">
                            <div className="text-sm font-medium text-yellow-800 mb-2">
                              Full-Page Screenshot Unavailable
                            </div>
                            <p className="text-xs text-yellow-700">
                              {evidenceData.run.fullPageScreenshotError}
                            </p>
                          </div>
                        )}
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
                        {currentRunData?.screenshotError && (
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
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="vitals">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {/* Add PageSpeed API error display */}
                      {categorizedScores.performance.length > 0 && 
                       categorizedScores.performance[0].evidence?.details?.error && (
                        <ErrorDisplay
                          title="Performance Data Unavailable"
                          message={
                            categorizedScores.performance[0].evidence.details.error === 'quota_exceeded'
                              ? "PageSpeed API quota exceeded"
                              : "PageSpeed API request failed"
                          }
                          details={categorizedScores.performance[0].evidence.details.message || categorizedScores.performance[0].evidence.description}
                          type="warning"
                        />
                      )}
                      
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Speed</CardTitle>
                            {categorizedScores.performance.length > 0 && (
                              <div className="text-2xl lg:text-3xl font-light text-primary">
                                {categorizedScores.performance[0].score}
                              </div>
                            )}
                          </div>
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
                                  ? "PageSpeed API quota exceeded. Performance metrics cannot be retrieved at this time."
                                  : "Unable to fetch performance data from PageSpeed API."}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Please try again later or check API configuration.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {/* Performance Score */}
                              {categorizedScores.performance.length > 0 && 
                               categorizedScores.performance[0].evidence?.details?.performanceScore && (
                                <div className="pb-3 border-b">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">PageSpeed Score</span>
                                    <Badge 
                                      variant="outline"
                                      className={cn(
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
                              )}
                              
                              {/* Core Web Vitals */}
                              <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Largest Contentful Paint</span>
                                {(() => {
                                  const webVitals = extractWebVitals(currentRunData);
                                  return webVitals?.lcp ? (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        webVitals.lcp <= 2.5 ? "text-green-600 border-green-200" :
                                        webVitals.lcp <= 4.0 ? "text-yellow-600 border-yellow-200" : 
                                        "text-red-600 border-red-200"
                                      )}
                                    >
                                      {webVitals.lcp.toFixed(1)}s
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Not available</Badge>
                                  );
                                })()}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Cumulative Layout Shift</span>
                                {(() => {
                                  const webVitals = extractWebVitals(currentRunData);
                                  return webVitals?.cls !== undefined ? (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        webVitals.cls <= 0.1 ? "text-green-600 border-green-200" :
                                        webVitals.cls <= 0.25 ? "text-yellow-600 border-yellow-200" : 
                                        "text-red-600 border-red-200"
                                      )}
                                    >
                                      {webVitals.cls.toFixed(2)}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Not available</Badge>
                                  );
                                })()}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">First Input Delay</span>
                                {(() => {
                                  const webVitals = extractWebVitals(currentRunData);
                                  return webVitals?.fid !== undefined ? (
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        webVitals.fid <= 100 ? "text-green-600 border-green-200" :
                                        webVitals.fid <= 300 ? "text-yellow-600 border-yellow-200" : 
                                        "text-red-600 border-red-200"
                                      )}
                                    >
                                      {Math.round(webVitals.fid)}ms
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Not available</Badge>
                                  );
                                })()}
                              </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

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
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}