import { useState, useEffect, useMemo } from "react";
import {
  Info,
  TrendingUp,
  Lightbulb,
  Copy,
  RotateCcw,
  Check,
  MessageCircle,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import { validateUserInput } from "@/utils/inputValidation";

// ---------- Text Rendering ----------
function renderTextWithBold(text: string, isRecommendation = false) {
  if (!text) return text;

  if (isRecommendation) {
    let cleanText = text.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\\"/g, '"');
    const numberedItems = cleanText
      .split(/(?=\d+\.\s)/g)
      .filter((item) => item.trim() && /^\d+\.\s/.test(item.trim()));

    if (numberedItems.length >= 2) {
      return (
        <ol className="space-y-3 text-xs sm:text-sm list-none">
          {numberedItems.map((item, index) => {
            const cleanItem = item.replace(/^\d+\.\s*/, "").trim();
            const parts = cleanItem.split(/(\*\*[^*]+(?:\*[^*][^*]*)*\*\*)/g);
            return (
              <li key={index} className="flex items-start">
                <span className="font-semibold text-primary mr-3 flex-shrink-0 text-sm">{index + 1}.</span>
                <span className="leading-relaxed flex-1">
                  {parts.map((part, partIndex) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={partIndex} className="font-semibold text-slate-800">
                        {part.slice(2, -2)}
                      </strong>
                    ) : (
                      part
                    )
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      );
    }
  }

  const parts = text.split(/(\*\*[^*]+(?:\*[^*][^*]*)*\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-slate-800">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}

// ---------- Props ----------
interface AIInsightsProps {
  context?: string;
  insight?: string;
  recommendation?: string;
  status?: "success" | "needs_improvement" | "warning";
  isTyping?: boolean;
  onRegenerate?: () => void;
  onClear?: () => void;
  clientId?: string;
  metricName?: string;
  timePeriod?: string;
  metricData?: {
    metricName: string;
    clientValue: number | null;
    industryAverage: number | null;
    cdAverage: number | null;
    competitorValues: number[];
    competitorNames: string[];
  };
  hasCustomContext?: boolean;
  onRegenerateWithContext?: (context: string) => void;
}

// ---------- Main Component ----------
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
  onRegenerateWithContext,
}: AIInsightsProps) {

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [contentKey, setContentKey] = useState(Date.now());

  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string>("");

  const { toast } = useToast();

  useEffect(() => {
    setCopiedText(null);
    setContentKey(Date.now());
  }, [context, insight, recommendation]);

  const timestamp = useMemo(
    () =>
      new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    []
  );

  const handleCopy = async () => {
    try {
      let fullContent = "";
      if (context) fullContent += `CONTEXT:\n${context}\n\n`;
      if (insight) fullContent += `INSIGHT:\n${insight}\n\n`;
      if (recommendation) fullContent += `RECOMMENDATION:\n${recommendation}`;

      if (navigator.clipboard && (window as any).isSecureContext) {
        await navigator.clipboard.writeText(fullContent);
      } else {
        const tempInput = document.createElement("textarea");
        tempInput.value = fullContent;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
      }

      setCopiedText(fullContent);
      toast({ title: "Copied to clipboard", description: "AI analysis copied successfully" });
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  const handleOpenContextModal = async () => {
    if (!clientId || !metricName) {
      toast({ title: "Error", description: "Unable to load context data", variant: "destructive" });
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

        if (existingContext.trim()) {
          const validation = validateUserInput(existingContext);
          setValidationWarnings(validation.warnings);
          setValidationError(validation.error || "");
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load insight context", variant: "destructive" });
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleRegenerateWithContext = async () => {
    if (!clientId || !metricName || !timePeriod || !metricData) {
      toast({ title: "Error", description: "Missing required data for regeneration", variant: "destructive" });
      return;
    }
    setIsSavingContext(true);

    try {
      if (userContext.trim()) {
        const saveResponse = await fetch(`/api/insight-context/${clientId}/${encodeURIComponent(metricName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userContext: userContext.trim() }),
        });

        if (!saveResponse.ok) {
          let errorMsg = "Failed to save context";
          try {
            const errorData = await saveResponse.json();
            if (saveResponse.status === 400 && errorData?.error?.includes("blocked")) {
              toast({ title: "Input blocked", description: errorData.error || "Context contains unsafe content", variant: "destructive" });
              return;
            }
            errorMsg = errorData?.message || errorMsg;
          } catch {}
          throw new Error(errorMsg);
        }
      }
      setIsContextModalOpen(false);
      onRegenerateWithContext?.(userContext.trim());
      toast({ title: "Success", description: "Context saved and insights regenerating..." });
    } catch {
      toast({ title: "Error", description: "Failed to save context", variant: "destructive" });
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleCancelContext = () => {
    setIsContextModalOpen(false);
    setUserContext("");
    setValidationWarnings([]);
    setValidationError("");
  };

  const shouldShowButtons = true;

  if (!context && !insight && !recommendation) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="p-4 sm:p-6 bg-slate-50 rounded-lg border border-slate-200 min-h-[100px] sm:min-h-[120px]">
          <div className="text-center text-slate-500">
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
              {renderTextWithBold(context)}
            </p>
          </div>
        )}

        {insight && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <Lightbulb className="h-3 w-3 mr-2 text-yellow-500 flex-shrink-0" />
              Insights
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {renderTextWithBold(insight)}
            </p>
          </div>
        )}

        {recommendation && (
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-700 mb-2 flex items-center">
              <TrendingUp className="h-3 w-3 mr-2 text-green-500 flex-shrink-0" />
              Recommendations
            </h4>
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              {renderTextWithBold(recommendation, true)}
            </div>

            {shouldShowButtons && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-200 space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <div className="text-xs text-slate-400">{timestamp}</div>
                  {hasCustomContext === true && (
                    <Badge 
                      className="text-xs px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-md font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      With Context
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
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
                          <textarea
                            placeholder="Goals, current initiatives, site updates, UX issues..."
                            value={userContext}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setUserContext(newValue);
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
                            maxLength={1000}
                            disabled={isLoadingContext || isSavingContext}
                            className={`flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base md:text-sm resize-none ${
                              validationError ? "border-red-300 bg-red-50" : "border-input bg-background"
                            }`}
                          />
                          <div className="flex justify-between text-xs">
                            <div className="space-y-1">
                              {validationWarnings.length > 0 && (
                                <ul className="text-amber-600 list-disc pl-4">
                                  {validationWarnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                </ul>
                              )}
                              {validationError && <div className="text-red-600">{validationError}</div>}
                            </div>
                            <div className="text-right">
                              <span
                                className={`block ${
                                  userContext.length > 1000
                                    ? "text-red-500"
                                    : userContext.length > 800
                                    ? "text-amber-500"
                                    : "text-slate-500"
                                }`}
                              >
                                {userContext.length}/1000
                              </span>
                              {userContext.length > 900 && <span className="text-amber-600">Almost at limit</span>}
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={handleCancelContext} disabled={isSavingContext}>
                              Cancel
                            </Button>
                            <Button onClick={handleRegenerateWithContext} disabled={isSavingContext || !userContext.trim() || !!validationError}>
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
                    {copiedText ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
