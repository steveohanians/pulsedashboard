import { Info, Lightbulb, TrendingUp } from "lucide-react";

interface AIInsightsProps {
  context?: string;
  insight?: string;
  recommendation?: string;
}

export default function AIInsights({ context, insight, recommendation }: AIInsightsProps) {
  if (!context && !insight && !recommendation) {
    return (
      <div className="space-y-3 sm:space-y-4 border-t border-slate-200 pt-3 sm:pt-4">
        <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-[120px]">
          <div className="text-center text-slate-500 py-4 sm:py-6">
            <Lightbulb className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">AI insights will appear here once data is analyzed</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 border-t border-slate-200 pt-3 sm:pt-4">
      <div className="p-3 sm:p-4 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-[120px]">
        {context && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <Info className="h-3 w-3 mr-2 text-primary flex-shrink-0" />
              Context
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{context}</p>
          </div>
        )}
        
        {insight && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <Lightbulb className="h-3 w-3 mr-2 text-yellow-500 flex-shrink-0" />
              Insight
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{insight}</p>
          </div>
        )}
        
        {recommendation && (
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <TrendingUp className="h-3 w-3 mr-2 text-green-500 flex-shrink-0" />
              Recommendation
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}