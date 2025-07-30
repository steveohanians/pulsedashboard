import { Info, Lightbulb, TrendingUp } from "lucide-react";

interface AIInsightsProps {
  context?: string;
  insight?: string;
  recommendation?: string;
}

export default function AIInsights({ context, insight, recommendation }: AIInsightsProps) {
  if (!context && !insight && !recommendation) {
    return (
      <div className="space-y-4 border-t border-slate-200 pt-4">
        <div className="text-center text-slate-500 py-4">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">AI insights will appear here once data is analyzed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      {context && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <Info className="h-4 w-4 mr-2 text-primary" />
            Context
          </h4>
          <p className="text-sm text-slate-600">{context}</p>
        </div>
      )}
      
      {insight && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
            Insight
          </h4>
          <p className="text-sm text-slate-600">{insight}</p>
        </div>
      )}
      
      {recommendation && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
            Recommendation
          </h4>
          <p className="text-sm text-slate-600">{recommendation}</p>
        </div>
      )}
    </div>
  );
}