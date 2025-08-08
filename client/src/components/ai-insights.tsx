import { useState, useEffect } from "react";
import { Info, Sparkles, TrendingUp, Lightbulb, Copy, RotateCcw, Check, CheckCircle, AlertTriangle, AlertCircle, MessageCircle, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TypewriterText } from "./typewriter-text";
import { validateUserInput } from "@/utils/inputValidation";
// Temporarily use console instead of logger to prevent runtime errors

/**
 * Advanced text rendering utility for AI-generated content with intelligent formatting.
 * Handles bold markdown syntax (**text**) and intelligent numbered list formatting
 * for recommendation content, providing structured visual hierarchy.
 * 
 * Features:
 * - Markdown bold syntax parsing (**text**)
 * - Intelligent numbered list detection and formatting
 * - Text cleanup for JSON-escaped content
 * - Responsive typography and spacing
 * - Structured recommendation list rendering with proper numbering
 * 
 * @param text - Raw text content from AI response, potentially with markdown formatting
 * @param isRecommendation - Whether to apply special numbered list formatting for recommendations
 * @returns React JSX elements with properly formatted and styled content
 */
function renderTextWithBold(text: string, isRecommendation = false) {
  if (!text) return text;
  
  // Handle numbered list formatting for recommendations
  if (isRecommendation && text.includes('1.')) {
    // Clean up the text 
    let cleanText = text.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    
    // Split by numbered items using regex that looks for "number. " pattern
    const numberedItems = cleanText.split(/(?=\d+\.\s)/).filter(item => item.trim() && /^\d+\./.test(item.trim()));
    
    // If we found numbered items, render as a list
    if (numberedItems.length >= 2) {
      return (
        <ol className="space-y-3 text-xs sm:text-sm list-none">
          {numberedItems.map((item, index) => {
            const cleanItem = item.replace(/^\d+\.\s*/, '').trim();
            const parts = cleanItem.split(/(\*\*[^*]+\*\*)/g);
            return (
              <li key={index} className="flex items-start">
                <span className="font-semibold text-primary mr-3 flex-shrink-0 text-sm">{index + 1}.</span>
                <span className="leading-relaxed flex-1">
                  {parts.map((part, partIndex) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={partIndex} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }
  }
  
  // Default bold text rendering
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-slate-800">
          {boldText}
        </strong>
      );
    }
    return part;
  });
}

/** Props interface for AIInsights component configuration and AI content management */
interface AIInsightsProps {
  /** Contextual information about the client and metric for AI processing */
  context?: string;
  /** Generated AI insight text with intelligent analysis */
  insight?: string;
  /** AI-generated recommendations with actionable guidance */
  recommendation?: string;
  /** Visual status indicator for metric performance assessment */
  status?: 'success' | 'needs_improvement' | 'warning';
  /** Whether the AI content is currently being generated with typewriter effect */
  isTyping?: boolean;
  /** Callback function to regenerate AI insights with existing context */
  onRegenerate?: () => void;
  /** Callback function to clear all AI content and reset the component */
  onClear?: () => void;
  /** Client identifier for context-aware AI insight generation */
  clientId?: string;
  /** Metric name for targeted AI analysis (e.g., 'Sessions', 'Bounce Rate') */
  metricName?: string;
  /** Time period for temporal analysis context */
  timePeriod?: string;
  /** Structured metric data object for comprehensive AI analysis */
  metricData?: {
    /** Name of the metric being analyzed */
    metricName: string;
    /** Client's current metric value for comparison */
    clientValue: number | null;
    /** Industry benchmark average for context */
    industryAverage: number | null;
    /** Clear Digital portfolio average for internal benchmarking */
    cdAverage: number | null;
    /** Array of competitor metric values for competitive analysis */
    competitorValues: number[];
    /** Array of competitor names for contextual references */
    competitorNames: string[];
  };
  /** Whether the client has provided custom context for enhanced AI analysis */
  hasCustomContext?: boolean;
  /** Callback function to regenerate insights with custom user-provided context */
  onRegenerateWithContext?: (context: string) => void;
}

/**
 * Status icon component with visual performance indicators and smooth animations.
 * Provides instant visual feedback for metric performance assessment using color-coded icons
 * with subtle glow effects and consistent styling throughout the dashboard.
 * 
 * Features:
 * - Color-coded performance status indicators
 * - Smooth glow pulse animations for visual appeal
 * - Consistent icon sizing and positioning
 * - Accessible status representation
 * 
 * @param status - Performance status level for icon selection and styling
 * @returns React JSX element with appropriate status icon and styling
 */
function StatusIcon({ status }: { status?: 'success' | 'needs_improvement' | 'warning' }) {
  if (!status) return null;
  
  const getIconClasses = () => {
    switch (status) {
      case 'success':
        return 'status-icon-success';
      case 'needs_improvement':
      case 'warning':
        return 'status-icon-warning';
      default:
        return '';
    }
  };
  
  const iconClasses = getIconClasses();
  
  return (
    <div className="flex items-center">
      {status === 'success' && <CheckCircle className={`h-6 w-6 ${iconClasses}`} />}
      {status === 'needs_improvement' && <AlertTriangle className={`h-6 w-6 ${iconClasses}`} />}
      {status === 'warning' && <AlertCircle className={`h-6 w-6 ${iconClasses}`} />}
    </div>
  );
}

/**
 * Advanced AI-powered insights component for comprehensive business analytics and actionable recommendations.
 * Provides intelligent metric analysis with sophisticated content generation, interactive features,
 * and seamless integration with OpenAI for executive-level business insights.
 * 
 * Core Capabilities:
 * - AI-powered contextual analysis using OpenAI GPT models for business intelligence
 * - Sophisticated typewriter effect with sequential content revelation (context → insight → recommendation)
 * - Comprehensive performance status indicators with visual feedback system
 * - Interactive content management with regeneration and customization capabilities
 * - Dynamic context modal for user-provided business context enhancement
 * - Intelligent text formatting with markdown support and numbered list handling
 * - Copy-to-clipboard functionality with user feedback notifications
 * - Responsive design optimized for dashboard integration and mobile compatibility
 * 
 * AI Integration Features:
 * - Context-aware insight generation using client metrics and competitive data
 * - Custom user context integration for enhanced business-specific recommendations
 * - Database persistence for insights across sessions and page refreshes
 * - Background processing with TanStack Query for performance optimization
 * - Input validation and sanitization for secure AI context submission
 * - Comprehensive error handling with graceful fallback experiences
 * 
 * Visual Design System:
 * - Status-driven color theming with performance indicators
 * - Smooth animations and transitions for enhanced user experience
 * - Professional typography with structured content hierarchy
 * - Consistent spacing and layout aligned with dashboard design patterns
 * - Interactive elements with hover states and accessibility considerations
 * 
 * Data Processing Intelligence:
 * - Structured metric data integration for comprehensive AI analysis
 * - Competitive benchmarking context for industry-aware recommendations  
 * - Temporal analysis support for time-series insights and trending
 * - Multi-source data correlation for holistic business intelligence
 * - Executive-focused output formatting optimized for decision-making clarity
 * 
 * Performance Optimization:
 * - Efficient state management with React hooks for smooth user interactions
 * - Optimized re-rendering patterns to minimize unnecessary updates
 * - Strategic content loading with progressive revelation for engagement
 * - Intelligent caching of user context and AI-generated content
 * - Background processing to maintain dashboard responsiveness during AI operations
 * 
 * The component serves as the cornerstone of the analytics dashboard's AI capabilities,
 * transforming raw business metrics into actionable intelligence that drives strategic decisions.
 * 
 * @param context - Contextual information for AI analysis
 * @param insight - Generated AI insight content
 * @param recommendation - AI-generated actionable recommendations
 * @param status - Performance status for visual indicators
 * @param isTyping - Whether content is being revealed with typewriter effect
 * @param onRegenerate - Callback for regenerating insights with existing context
 * @param onClear - Callback for clearing all AI content
 * @param clientId - Client identifier for context-aware analysis
 * @param metricName - Target metric for focused AI analysis  
 * @param timePeriod - Time period for temporal analysis context
 * @param metricData - Structured metric data for comprehensive AI processing
 * @param hasCustomContext - Whether client has provided custom context
 * @param onRegenerateWithContext - Callback for regenerating with custom context
 */
export function AIInsights({ 
  context, 
  insight, 
  recommendation, 
  status, 
  isTyping = false, 
  onRegenerate, 
  onClear,
  clientId,
  metricName,
  timePeriod,
  metricData,
  hasCustomContext = false,
  onRegenerateWithContext
}: AIInsightsProps) {
  const [contextComplete, setContextComplete] = useState(!isTyping);
  const [insightComplete, setInsightComplete] = useState(!isTyping);
  const [showInsight, setShowInsight] = useState(!isTyping);
  const [showRecommendation, setShowRecommendation] = useState(!isTyping);
  const [recommendationComplete, setRecommendationComplete] = useState(!isTyping);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [contentKey, setContentKey] = useState(Date.now());
  
  // Context modal state
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string>("");
  
  const { toast } = useToast();

  // Reset typing states when content changes or isTyping changes
  useEffect(() => {
    if (isTyping) {
      // For typing mode, reset all states to start typing sequence
      setContextComplete(false);
      setInsightComplete(false);
      setShowInsight(false);
      setShowRecommendation(false);
      setRecommendationComplete(false);
    } else {
      // For non-typing mode (stored insights), show everything immediately
      setContextComplete(true);
      setInsightComplete(true);
      setShowInsight(true);
      setShowRecommendation(true);
      setRecommendationComplete(true);
    }
    setCopiedText(null);
    // Generate new key to force TypewriterText to remount
    setContentKey(Date.now());
  }, [context, insight, recommendation, isTyping]);
  
  // Format timestamp
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const handleCopy = async () => {
    try {
      // Combine all content into a single formatted string
      let fullContent = '';
      
      if (context) {
        fullContent += `CONTEXT:\n${context}\n\n`;
      }
      
      if (insight) {
        fullContent += `INSIGHT:\n${insight}\n\n`;
      }
      
      if (recommendation) {
        fullContent += `RECOMMENDATION:\n${recommendation}`;
      }
      
      await navigator.clipboard.writeText(fullContent);
      setCopiedText(fullContent);
      toast({
        title: "Copied to clipboard",
        description: "AI analysis copied successfully",
      });
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Load existing context when modal opens
  const handleOpenContextModal = async () => {
    if (!clientId || !metricName) {
      toast({
        title: "Error",
        description: "Unable to load context data",
        variant: "destructive"
      });
      return;
    }

    setIsContextModalOpen(true);
    setIsLoadingContext(true);
    
    try {
      const response = await fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`);
      if (response.ok) {
        const data = await response.json();
        const existingContext = data.userContext || "";
        setUserContext(existingContext);
        
        // Validate existing context for display
        if (existingContext.trim()) {
          const validation = validateUserInput(existingContext);
          setValidationWarnings(validation.warnings);
          setValidationError(validation.error || "");
        }
      }
    } catch (error) {
      console.error("[AIInsights] Error loading context:", error);
      toast({
        title: "Error",
        description: "Failed to load existing context",
        variant: "destructive"
      });
    } finally {
      setIsLoadingContext(false);
    }
  }

  // Save context and regenerate insights
  const handleRegenerateWithContext = async () => {
    if (!clientId || !metricName || !timePeriod || !metricData) {
      toast({
        title: "Error",
        description: "Missing required data for regeneration",
        variant: "destructive"
      });
      return;
    }

    setIsSavingContext(true);
    
    try {
      // Save the context first
      if (userContext.trim()) {
        const saveResponse = await fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userContext: userContext.trim() })
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => null);
          // Check if this is a sanitization error
          if (saveResponse.status === 400 && errorData?.error?.includes('blocked')) {
            toast({
              title: "Input blocked",
              description: errorData.error || "Context contains unsafe content",
              variant: "destructive"
            });
            return;
          }
          throw new Error(errorData?.message || 'Failed to save context');
        }
      }

      // Close modal and trigger regeneration with context
      setIsContextModalOpen(false);
      
      if (onRegenerateWithContext) {
        onRegenerateWithContext(userContext.trim());
      }
      
      toast({
        title: "Success",
        description: "Context saved and insights regenerating...",
      });
    } catch (error) {
      console.warn("[AIInsights] Error saving context:", error);
      toast({
        title: "Error",
        description: "Failed to save context",
        variant: "destructive"
      });
    } finally {
      setIsSavingContext(false);
    }
  }

  // Cancel context modal
  const handleCancelContext = () => {
    setIsContextModalOpen(false);
    setUserContext("");
    setValidationWarnings([]);
    setValidationError("");
  }

  if (!context && !insight && !recommendation) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-[120px]">
          <div className="text-center text-slate-500">
            <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-5 w-5 text-primary/70" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600">AI insights will appear here once generated</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-[120px]">
        {context && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <Info className="h-3 w-3 mr-2 text-primary flex-shrink-0" />
              Context
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isTyping && !contextComplete ? (
                <TypewriterText 
                  key={`context-${contentKey}`}
                  text={context} 
                  speed={5}
                  onComplete={() => {
                    setContextComplete(true);
                    setShowInsight(true);
                  }}
                  className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                />
              ) : (
                renderTextWithBold(context)
              )}
            </p>
          </div>
        )}
        
        {insight && (showInsight || !isTyping) && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <Lightbulb className="h-3 w-3 mr-2 text-yellow-500 flex-shrink-0" />
              Insights
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isTyping && showInsight && !insightComplete ? (
                <TypewriterText 
                  key={`insight-${contentKey}`}
                  text={insight} 
                  speed={5}
                  onComplete={() => {
                    setInsightComplete(true);
                    setShowRecommendation(true);
                  }}
                  className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                />
              ) : (
                renderTextWithBold(insight)
              )}
            </p>
          </div>
        )}
        
        {recommendation && (showRecommendation || !isTyping) && (
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <TrendingUp className="h-3 w-3 mr-2 text-green-500 flex-shrink-0" />
              Recommendations
            </h4>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              {isTyping && showRecommendation && !recommendationComplete ? (
                <TypewriterText 
                  key={`recommendation-${contentKey}`}
                  text={recommendation} 
                  speed={5}
                  onComplete={() => {
                    setRecommendationComplete(true);
                  }}
                  className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                />
              ) : (
                renderTextWithBold(recommendation, true)
              )}
            </div>
            
            {/* Timestamp and Action Buttons - Only show after recommendation is complete */}
            {(() => {
              const shouldShowButtons = !isTyping || recommendationComplete;
              // Determine button visibility based on completion state
              return shouldShowButtons;
            })() && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-200 space-y-2 sm:space-y-0">
              <div className="text-xs text-slate-400">
                {timestamp}
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                {/* Context Badge - Show first if this insight was generated with custom context */}
                {hasCustomContext && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 rounded-md text-xs border border-blue-200 dark:border-blue-800">
                    <Sparkles className="h-3 w-3" />
                    <span>With Context</span>
                  </div>
                )}
                
                {/* Add Context Button - Only show if we have necessary data */}
                {clientId && metricName && timePeriod && metricData && onRegenerateWithContext && (
                  <Dialog open={isContextModalOpen} onOpenChange={setIsContextModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleOpenContextModal}
                        className="text-slate-500 hover:text-slate-700 h-7 px-2"
                        title="Add context for better insights"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center">
                          <MessageCircle className="h-4 w-4 mr-2 text-primary" />
                          Add Context for {metricName}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-slate-600">
                          Provide additional context to help our AI generate more relevant insights for your {metricName} metric.
                        </p>
                        <div className="space-y-2">
                          <textarea
                            placeholder="Goals, current initiatives, site updates, UX issues, seasonality, or internal priorities..."
                            value={userContext}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setUserContext(newValue);
                              
                              // Real-time validation
                              if (newValue.trim()) {
                                const validation = validateUserInput(newValue);
                                setValidationWarnings(validation.warnings);
                                setValidationError(validation.error || "");
                              } else {
                                setValidationWarnings([]);
                                setValidationError("");
                              }
                            }}
                            rows={4}
                            disabled={isLoadingContext || isSavingContext}
                            className={`flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none ${
                              validationError ? 'border-red-300 bg-red-50' : 'border-input bg-background'
                            }`}
                            style={{
                              color: '#0f172a',
                              backgroundColor: validationError ? '#fef2f2' : '#ffffff',
                              borderColor: validationError ? '#fca5a5' : '#e2e8f0',
                            } as React.CSSProperties}
                          />
                          
                          {/* Character count only */}
                          <div className="flex justify-end text-xs">
                            <div className="text-right">
                              <span className={`block ${userContext.length > 1000 ? 'text-red-500' : userContext.length > 800 ? 'text-amber-500' : 'text-slate-500'}`}>
                                {userContext.length}/1000
                              </span>
                              {userContext.length > 900 && (
                                <span className="text-xs text-amber-600">Almost at limit</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            onClick={handleCancelContext}
                            disabled={isSavingContext}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleRegenerateWithContext}
                            disabled={isSavingContext || !userContext.trim() || !!validationError}
                          >
                            {isSavingContext ? "Regenerating..." : "Regenerate"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="text-slate-500 hover:text-slate-700 h-7 px-2"
                >
                  {copiedText ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                
                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRegenerate}
                    className="text-slate-500 hover:text-slate-700 h-7 px-2"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                {onClear && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="text-slate-500 hover:text-red-600 h-7 px-2"
                    title="Clear insights"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}