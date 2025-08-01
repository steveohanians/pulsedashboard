import { useState } from "react";
import { Info, Sparkles, TrendingUp, Lightbulb } from "lucide-react";
import TypewriterText from "./typewriter-text";

// Function to render text with bold formatting
function renderTextWithBold(text: string) {
  if (!text) return text;
  
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
  isTyping?: boolean;
}

export default function AIInsights({ context, insight, recommendation, isTyping = false }: AIInsightsProps) {
  const [contextComplete, setContextComplete] = useState(!isTyping);
  const [insightComplete, setInsightComplete] = useState(!isTyping);
  const [showInsight, setShowInsight] = useState(!isTyping);
  const [showRecommendation, setShowRecommendation] = useState(!isTyping);
  if (!context && !insight && !recommendation) {
    return (
      <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
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
    <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
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
                  text={context} 
                  speed={10}
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
              Insight
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isTyping && showInsight && !insightComplete ? (
                <TypewriterText 
                  text={insight} 
                  speed={10}
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
              Recommendation
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {isTyping && showRecommendation ? (
                <TypewriterText 
                  text={recommendation} 
                  speed={10}
                  className="text-xs sm:text-sm text-slate-600 leading-relaxed"
                />
              ) : (
                renderTextWithBold(recommendation)
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}