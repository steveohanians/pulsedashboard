import { useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useLoadKit } from "@/components/loading";
import LoadKit from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LogOut,
  TrendingUp,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Circle,
  XCircle,
  Info,
  Sparkles,
  Building2,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PdfExportButton from "@/components/pdf/PdfExportButton";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function BrandSignals() {
  const brandSignalsRef = useRef<HTMLDivElement>(null);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [showRawData, setShowRawData] = useState(false);
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);
  const [isTestAnalysis, setIsTestAnalysis] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeAnalysisType, setActiveAnalysisType] = useState<'main' | 'test' | null>(null);

  // Get client and competitors from existing dashboard data
  const { client, competitors } = useDashboardData({
    clientId: user?.clientId || "",
    timePeriod: "Last Month",
    businessSize: "All",
    industryVertical: "All",
  });

  // Add progress with simple string format
  const addProgress = (message: string) => {
    setProgressSteps((prev) => [...prev, message]);
    setCurrentStep((prev) => prev + 1);
  };

  // Function to run SoV analysis with direct response
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setActiveAnalysisType('main');
    setAnalysisResults(null);
    setProgressSteps([]);
    setErrorMessage("");
    setCurrentStep(-1);

    try {
      // Format URLs properly
      const formatUrl = (url: string) => {
        if (!url) return "https://unknown.com";
        let cleanUrl = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
        return `https://${cleanUrl}`;
      };

      // Build the request payload
      const payload = {
        brand: {
          name: client?.name || "Unknown",
          url: formatUrl(client?.websiteUrl || "unknown.com"),
        },
        competitors: competitors.slice(0, 3).map((c: any) => ({
          name: c.label || c.name || c.domain.split(".")[0],
          url: formatUrl(c.domain),
        })),
        vertical: client?.industryVertical || "General",
      };

      // Show progress messages one at a time with delays
      addProgress(`Starting analysis for ${payload.brand.name}...`);

      // Add delay to show progress
      setTimeout(() => {
        addProgress(
          `Analyzing against ${payload.competitors.length} competitors`,
        );
      }, 500);

      setTimeout(() => {
        addProgress(`Processing... This may take 2-3 minutes`);
      }, 1000);

      // Call the API and wait for results
      const response = await fetch("/api/sov/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`,
        );
      }

      const data = await response.json();

      // Check if we got valid results
      if (data.success === false) {
        setErrorMessage(data.error || "Analysis failed");
        return;
      }

      // Set the results
      setAnalysisResults(data);
      addProgress(
        `✅ Analysis complete! Processed ${data.summary?.totalQuestions || 0} questions`,
      );

      toast({
        title: "Analysis Complete",
        description: `Successfully analyzed ${data.summary?.totalQuestions || 0} questions`,
      });
    } catch (error: any) {
      const errorMsg =
        error instanceof Error ? error.message : "Analysis failed";
      setErrorMessage(errorMsg);

      toast({
        title: "Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setActiveAnalysisType(null);
    }
  };

  // Function to run test analysis with well-known brands
  const runTestAnalysis = async () => {
    setIsAnalyzing(true);
    setActiveAnalysisType('test');
    setIsTestAnalysis(true);
    setAnalysisResults(null);
    setProgressSteps([]);
    setErrorMessage("");

    try {
      // Hardcoded test data
      const testPayload = {
        brand: {
          name: "HubSpot",
          url: "https://www.hubspot.com",
        },
        competitors: [
          { name: "Salesforce", url: "https://www.salesforce.com" },
          { name: "Zoho", url: "https://www.zoho.com" },
          { name: "Mailchimp", url: "https://mailchimp.com" },
        ],
        vertical: "Marketing Software",
      };

      // Show progress messages
      setProgressSteps([
        `Starting test analysis for ${testPayload.brand.name}...`,
      ]);

      setTimeout(() => {
        setProgressSteps((prev) => [
          ...prev,
          `Analyzing against well-known competitors`,
        ]);
      }, 500);

      setTimeout(() => {
        setProgressSteps((prev) => [
          ...prev,
          `Processing... This may take 2-3 minutes`,
        ]);
      }, 1000);

      // Call the API with test data
      const response = await fetch("/api/sov/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || `HTTP ${response.status}`,
        );
      }

      const data = await response.json();

      // Check if we got valid results
      if (data.success === false) {
        setErrorMessage(data.error || "Test analysis failed");
        setProgressSteps((prev) => [...prev, `❌ Error: ${data.error}`]);
        return;
      }

      // Set the results
      setAnalysisResults(data);
      setProgressSteps((prev) => [
        ...prev,
        `✅ Test analysis complete! Processed ${data.summary?.totalQuestions || 0} questions`,
      ]);

      toast({
        title: "Test Analysis Complete",
        description: `Successfully analyzed HubSpot vs competitors`,
      });
    } catch (error: any) {
      const errorMsg = error?.message || "Test analysis failed";
      setErrorMessage(errorMsg);
      setProgressSteps((prev) => [...prev, `❌ Error: ${errorMsg}`]);

      toast({
        title: "Test Analysis Failed",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      setActiveAnalysisType(null);
      setIsTestAnalysis(false);
    }
  };

  // LoadKit integration - behavioral cloning
  const { shouldUse: useLoadKitBrandSignals } = useLoadKit('brand-signals');
  
  // LoadKit state preparation - mirror existing exactly
  const brandSignalsLoadingState = {
    isLoading: false, // Brand signals doesn't have general loading, only isAnalyzing
    isAnalyzing,
    progressSteps,
    activeAnalysisType,
    currentStep: progressSteps.length - 1,
    errorMessage: ''
  };

  const mainContent = (
    <div className="min-h-screen bg-slate-50">
      {/* Header - EXACT SAME AS DASHBOARD */}
      <header className="bg-gradient-to-r from-white via-white to-slate-50/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-6 py-3 sm:py-5 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <img
              src={clearLogoPath}
              alt="Clear Digital Logo"
              className="h-6 sm:h-8 md:h-10 w-auto flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Pulse Dashboard™
              </h1>
              <div className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 truncate">
                {client?.name || "Loading..."}
                {client?.websiteUrl && (
                  <>
                    <span className="hidden sm:inline"> | </span>
                    <a
                      href={client.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline inline-flex items-center gap-1 group"
                    >
                      <span className="truncate max-w-32 sm:max-w-none">
                        {client.websiteUrl.replace(/^https?:\/\//, "")}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-6">
            {/* User Avatar and Name - Same as dashboard */}
            {user && (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Avatar className="h-8 w-8">
                  {client?.iconUrl && (
                    <AvatarImage
                      src={client.iconUrl}
                      alt={client?.name || "Client"}
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {(user.name || user.email || "User")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline truncate max-w-24 lg:max-w-32">
                  {user.name || user.email}
                </span>
              </div>
            )}

            <PdfExportButton
              targetRef={brandSignalsRef}
              clientLabel={client?.name}
              clientName={client?.name}
              className="ml-1"
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div
        ref={brandSignalsRef}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
      >
        {/* Back to Dashboard Link - IN BODY NOW */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-slate-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>

        {/* Main Container Card - Similar to Dashboard's Bounce Rate */}
        <Card id="ai-share-of-voice" className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg lg:text-xl">
              AI Share of Voice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50/50 rounded-xl">
              {/* Description */}
              <p className="text-slate-600 text-sm mb-6">
                This analysis shows how OpenAI's ChatGPT positions your brand and competitor brands within the GEO category. Results are drawn from AI responses, not SEO rankings, paid media, or social activity.
              </p>

              {/* Pulse AI Analysis Section - Matching Dashboard's Pulse AI Insight styling */}
              <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-primary/10 border border-primary/10 rounded-2xl p-6">
                <div className="flex items-center mb-4">
                  <Sparkles className="h-5 w-5 text-primary mr-3" />
                  <h3 className="text-lg font-bold text-primary">
                    Pulse AI Analysis
                  </h3>
                </div>

                {/* Enhanced Client/Website/Competitors Info Block */}
                <div className="space-y-4 mb-6">
                  {/* Client Info Section */}
                  <div className="bg-white/50 rounded-lg p-4 border border-slate-200/50">
                    <h4 className="text-lg font-semibold text-slate-800 mb-3">
                      {client?.name || "Loading..."}
                    </h4>
                    
                    {/* Website */}
                    <div className="flex items-center text-sm text-slate-600 mb-3">
                      <Globe className="h-4 w-4 mr-2 text-slate-400" />
                      <span className="text-slate-500">Website:&nbsp;</span>
                      <a 
                        href={client?.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1 group"
                      >
                        <span>
                          {client?.websiteUrl?.replace(/^https?:\/\//, "") || "Loading..."}
                        </span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                      </a>
                    </div>
                    
                    {/* Competitors Section */}
                    <div className="flex items-start text-sm text-slate-600">
                      <Building2 className="h-4 w-4 mr-2 text-slate-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-slate-500">Competitors:</span>
                          <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                            {competitors?.length || 0} configured
                          </span>
                        </div>
                        {competitors?.length > 0 && (
                          <div className="grid gap-2">
                            {competitors.map((c: any) => {
                              const displayName = c.label || c.domain.replace(/^https?:\/\//, "");
                              const cleanDomain = c.domain.replace(/^https?:\/\//, "");
                              return (
                                <div 
                                  key={c.id} 
                                  className="flex items-center justify-between bg-slate-50/50 rounded-md px-3 py-2 border border-slate-200/30"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-700">{displayName}</span>
                                  </div>
                                  <a 
                                    href={c.domain} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary underline inline-flex items-center gap-1 group text-xs"
                                  >
                                    <span>{cleanDomain}</span>
                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two Buttons */}
                <div className="flex gap-4 mb-6">
                  <Button
                    className="flex-1 h-10"
                    onClick={runAnalysis}
                    disabled={isAnalyzing || !client}
                  >
                    {isAnalyzing && activeAnalysisType === 'main' ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run New Analysis
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={runTestAnalysis}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing && activeAnalysisType === 'test' ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Test Analysis
                      </>
                    )}
                  </Button>
                </div>

                {/* Progress Steps - appear below buttons when running */}
                {isAnalyzing && progressSteps.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-700">
                      Analysis Progress:
                    </h4>
                    {progressSteps.map((step, index) => {
                      const isExplicitlyCompleted = step.includes("✅");
                      const isFailed = step.includes("❌");
                      const isCurrentStep =
                        index === progressSteps.length - 1 &&
                        !isExplicitlyCompleted &&
                        !isFailed;
                      const isImplicitlyCompleted =
                        !isExplicitlyCompleted && !isFailed && !isCurrentStep;

                      return (
                        <div
                          key={index}
                          className="flex items-center space-x-3 text-sm"
                        >
                          <div className="flex-shrink-0">
                            {(isExplicitlyCompleted ||
                              isImplicitlyCompleted) && (
                              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 text-xs font-bold">
                                  ✓
                                </span>
                              </div>
                            )}
                            {isFailed && (
                              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-red-600 text-xs font-bold">
                                  ✕
                                </span>
                              </div>
                            )}
                            {isCurrentStep && (
                              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                                <RefreshCw className="h-3 w-3 text-blue-600 animate-spin" />
                              </div>
                            )}
                          </div>
                          <span
                            className={
                              step.includes("❌")
                                ? "text-red-700"
                                : "text-slate-700"
                            }
                          >
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Error Message Display */}
                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <strong>Error:</strong> {errorMessage}
                    </p>
                  </div>
                )}

                {/* Analysis Results - Inside Pulse AI Analysis Box */}
                {analysisResults && (
                  <div className="mt-6">
                    {/* Summary Cards Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <Card className="bg-slate-50">
                        <CardContent className="p-6">
                          <div className="text-xs font-medium text-slate-600 mb-1">
                            Overall ChatGPT SoV
                          </div>
                          <div className="text-2xl font-thin text-primary">
                            {analysisResults.metrics?.overallSoV?.[
                              analysisResults.summary?.brand
                            ] || 0}
                            %
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Data source: AI responses to generated{" "}
                            <button
                              onClick={() => setShowQuestionsDialog(true)}
                              className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                            >
                              questions
                            </button>
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-slate-50">
                        <CardContent className="p-6">
                          <div className="text-xs font-medium text-slate-600 mb-1">
                            Question Coverage
                          </div>
                          <div className="text-2xl font-thin text-black">
                            {analysisResults.metrics?.questionCoverage?.[
                              analysisResults.summary?.brand
                            ] || 0}
                            %
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Data source: AI responses to generated{" "}
                            <button
                              onClick={() => setShowQuestionsDialog(true)}
                              className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                            >
                              questions
                            </button>
                          </p>
                        </CardContent>
                      </Card>

                      <Card className="bg-slate-50">
                        <CardContent className="p-6">
                          <div className="text-xs font-medium text-slate-600 mb-1">
                            AI Visibility Leader
                          </div>
                          <div className="text-lg font-thin text-slate-800 truncate">
                            {(() => {
                              const sov =
                                analysisResults.metrics?.overallSoV || {};
                              const leader = Object.entries(sov).reduce(
                                (a, b) =>
                                  (b[1] as number) > (a[1] as number) ? b : a,
                                ["None", 0],
                              );
                              return leader[0];
                            })()}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Data source: AI responses to generated{" "}
                            <button
                              onClick={() => setShowQuestionsDialog(true)}
                              className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                            >
                              questions
                            </button>
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Two Side-by-Side Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* Performance by Buyer Journey Stage */}
                      {analysisResults.questionResults && (
                        <Card className="bg-slate-50">
                          <CardHeader>
                            <CardTitle className="text-lg">
                              Performance by Buyer Journey Stage
                            </CardTitle>
                            <p className="text-xs text-slate-500 mt-1">
                              Data source: AI responses to generated{" "}
                              <button
                                onClick={() => setShowQuestionsDialog(true)}
                                className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                              >
                                questions
                              </button>
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-6">
                              {["awareness", "consideration", "decision"].map(
                                (stage) => {
                                  const stageQuestions =
                                    analysisResults.questionResults.filter(
                                      (q: any) => q.stage === stage,
                                    );
                                  const brandName =
                                    analysisResults.summary?.brand;

                                  // Calculate average SoV for this stage
                                  const stageSoV =
                                    stageQuestions.reduce(
                                      (sum: number, q: any) => {
                                        return sum + (q.sov?.[brandName] || 0);
                                      },
                                      0,
                                    ) / (stageQuestions.length || 1);

                                  // Find stage leader
                                  const allBrands = new Set<string>();
                                  stageQuestions.forEach((q: any) => {
                                    Object.keys(q.sov || {}).forEach((brand) =>
                                      allBrands.add(brand),
                                    );
                                  });

                                  const brandAverages = Array.from(
                                    allBrands,
                                  ).map((brand) => ({
                                    brand,
                                    avg:
                                      stageQuestions.reduce(
                                        (sum: number, q: any) =>
                                          sum + (q.sov?.[brand] || 0),
                                        0,
                                      ) / (stageQuestions.length || 1),
                                  }));

                                  const stageLeader = brandAverages.reduce(
                                    (a, b) => (b.avg > a.avg ? b : a),
                                    { brand: "None", avg: 0 },
                                  );

                                  return (
                                    <div key={stage} className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium capitalize">
                                            {stage}
                                          </span>
                                        </div>
                                        <div className="text-sm text-slate-600">
                                          Leader:{" "}
                                          <span className="font-medium">
                                            {stageLeader.brand}
                                          </span>{" "}
                                          ({Math.round(stageLeader.avg)}%)
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-sm font-medium text-slate-700 w-20">
                                          Your SoV:
                                        </span>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-200 rounded-full h-3">
                                              <div
                                                className="bg-primary h-3 rounded-full transition-all duration-500"
                                                style={{
                                                  width: `${Math.min(100, Math.round(stageSoV))}%`,
                                                }}
                                              />
                                            </div>
                                            <span className="text-sm font-thin text-slate-800 w-12 text-right">
                                              {Math.round(stageSoV)}%
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* AI Share of Voice by Competitor */}
                      <Card className="bg-slate-50">
                        <CardHeader>
                          <CardTitle className="text-lg">
                            AI Share of Voice by Competitor
                          </CardTitle>
                          <p className="text-xs text-slate-500 mt-1">
                            Data source: AI responses to generated{" "}
                            <button
                              onClick={() => setShowQuestionsDialog(true)}
                              className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                            >
                              questions
                            </button>
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {Object.entries(
                              analysisResults.metrics?.overallSoV || {},
                            ).map(([brand, percentage]) => (
                              <div
                                key={brand}
                                className="flex items-center gap-4"
                              >
                                <div className={`w-32 text-sm font-medium truncate ${
                                  brand === analysisResults.summary?.brand
                                    ? "text-pink-600"
                                    : "text-slate-700"
                                }`}>
                                  {brand}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-3">
                                      <div
                                        className={`h-3 rounded-full transition-all duration-500 ${
                                          brand ===
                                          analysisResults.summary?.brand
                                            ? "bg-primary"
                                            : "bg-slate-400"
                                        }`}
                                        style={{
                                          width: `${String(percentage)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-thin text-slate-800 w-16 text-right">
                                      {String(percentage)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Strategic Insights & Recommendations - Full Width */}
                    <Card className="mb-6 bg-slate-50">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Strategic Insights & Recommendations
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                          Data source: AI responses to generated{" "}
                          <button
                            onClick={() => setShowQuestionsDialog(true)}
                            className="text-slate-500 hover:text-slate-400 underline cursor-pointer"
                          >
                            questions
                          </button>
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          {analysisResults.summary?.strategicInsights ? (
                            (() => {
                              // Parse strategic insights into individual insight objects
                              const parseInsights = (insightsText: string) => {
                                const insights = insightsText.split('\n\n').map(insight => {
                                  const lines = insight.split('\n');
                                  if (lines.length < 3) return null;
                                  
                                  const title = lines[0].trim();
                                  const description = lines[1].trim();
                                  const actionLine = lines.find(line => line.startsWith('Action:'));
                                  const deliverablesLine = lines.find(line => line.startsWith('Deliverables:'));
                                  
                                  const action = actionLine ? actionLine.replace('Action:', '').trim() : '';
                                  const deliverables = deliverablesLine ? deliverablesLine.replace('Deliverables:', '').trim() : '';
                                  
                                  // Determine performance level from title/content
                                  let performanceLevel = 'ok'; // default orange
                                  if (title.includes('Scale Market Momentum') || title.includes('Strong') || 
                                      description.includes('Strong performance') || description.includes('amplify')) {
                                    performanceLevel = 'good'; // green
                                  } else if (title.includes('Insufficient') || title.includes('Crack') || 
                                            title.includes('Close') || title.includes('invisible') || 
                                            title.includes('Missing') || description.includes('0%')) {
                                    performanceLevel = 'bad'; // red
                                  }
                                  
                                  return { title, description, action, deliverables, performanceLevel };
                                }).filter(Boolean);
                                
                                return insights;
                              };
                              
                              const insights = parseInsights(analysisResults.summary.strategicInsights);
                              
                              return insights.map((insight: any, index: number) => {
                                const bgColorClass = 
                                  insight.performanceLevel === 'good' ? 'bg-green-50 border-green-200' :
                                  insight.performanceLevel === 'bad' ? 'bg-red-50 border-red-200' :
                                  'bg-orange-50 border-orange-200';
                                
                                return (
                                  <div key={index} className={`p-4 rounded-lg border ${bgColorClass}`}>
                                    <h4 className="font-bold text-slate-800 mb-2">{insight.title}</h4>
                                    <p className="text-sm text-slate-700 mb-3">{insight.description}</p>
                                    {insight.action && (
                                      <p className="text-sm text-slate-700 mb-2">
                                        <span className="font-bold">Action:</span> {insight.action}
                                      </p>
                                    )}
                                    {insight.deliverables && (
                                      <p className="text-sm text-slate-700">
                                        <span className="font-bold">Deliverables:</span> {insight.deliverables}
                                      </p>
                                    )}
                                  </div>
                                );
                              });
                            })()
                          ) : (
                            <div className="text-slate-500 text-center py-8">
                              Strategic insights will appear here after running an analysis.
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Dialog */}
        <Dialog
          open={showQuestionsDialog}
          onOpenChange={setShowQuestionsDialog}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generated Questions by Stage</DialogTitle>
              <DialogDescription>
                These are the questions our AI generated to analyze your brand's
                share of voice across the buyer journey.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {analysisResults?.questionResults && (
                <div className="space-y-6">
                  {["awareness", "consideration", "decision"].map((stage) => {
                    const stageQuestions =
                      analysisResults.questionResults.filter(
                        (q: any) => q.stage === stage,
                      );
                    return (
                      <div key={stage} className="space-y-3">
                        <h4 className="font-semibold capitalize text-primary">
                          {stage} Stage
                        </h4>
                        <ul className="space-y-2">
                          {stageQuestions.map((q: any, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-slate-600 pl-4 border-l-2 border-slate-200"
                            >
                              {q.question}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Placeholder for future sections */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-slate-400">
              Brand Perception - Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Track how AI platforms describe your brand with sentiment analysis
              and competitive positioning.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
  
  // LoadKit integration - use if enabled, fallback to existing
  if (useLoadKitBrandSignals) {
    return (
      <LoadKit.BrandSignals state={brandSignalsLoadingState}>
        {mainContent}
      </LoadKit.BrandSignals>
    );
  }
  
  // Return existing content unchanged for safety
  return mainContent;
}
