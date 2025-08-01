import { useState, useEffect } from "react";
import { Info, Sparkles, TrendingUp, Lightbulb, Copy, RotateCcw, Check, X, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import TypewriterText from "./typewriter-text";

// Function to render text with bold formatting and numbered lists
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

interface AIInsightsProps {
  context?: string;
  insight?: string;
  recommendation?: string;
  status?: 'success' | 'needs_improvement' | 'warning';
  isTyping?: boolean;
  onRegenerate?: () => void;
  onClear?: () => void;
}

// Status icon component
function StatusIcon({ status }: { status?: 'success' | 'needs_improvement' | 'warning' }) {
  if (!status) return null;
  
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />;
    case 'needs_improvement':
      return <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />;
    case 'warning':
      return <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    default:
      return null;
  }
}

export default function AIInsights({ context, insight, recommendation, status, isTyping = false, onRegenerate, onClear }: AIInsightsProps) {
  const [contextComplete, setContextComplete] = useState(!isTyping);
  const [insightComplete, setInsightComplete] = useState(!isTyping);
  const [showInsight, setShowInsight] = useState(!isTyping);
  const [showRecommendation, setShowRecommendation] = useState(!isTyping);
  const [recommendationComplete, setRecommendationComplete] = useState(!isTyping);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [contentKey, setContentKey] = useState(Date.now());
  const { toast } = useToast();

  // Reset typing states when content changes or isTyping changes
  useEffect(() => {
    console.debug('🎭 AIInsights effect triggered - isTyping:', isTyping);
    setContextComplete(!isTyping);
    setInsightComplete(!isTyping);
    setShowInsight(!isTyping);
    setShowRecommendation(!isTyping);
    setRecommendationComplete(!isTyping);
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
                    console.debug('🎭 Context typing complete');
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
              Insight
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isTyping && showInsight && !insightComplete ? (
                <TypewriterText 
                  key={`insight-${contentKey}`}
                  text={insight} 
                  speed={5}
                  onComplete={() => {
                    console.debug('🎭 Insight typing complete');
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
              Recommendation
            </h4>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              {isTyping && showRecommendation && !recommendationComplete ? (
                <TypewriterText 
                  key={`recommendation-${contentKey}`}
                  text={recommendation} 
                  speed={5}
                  onComplete={() => {
                    console.debug('🎭 Recommendation typing complete');
                    setRecommendationComplete(true);
                  }}
                  className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                />
              ) : (
                renderTextWithBold(recommendation, true)
              )}
            </div>
            
            {/* Timestamp and Action Buttons - Only show after recommendation is complete */}
            {(!isTyping || recommendationComplete) && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-400">
                {timestamp}
              </div>
              <div className="flex items-center space-x-2">
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
                    <X className="h-3 w-3" />
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