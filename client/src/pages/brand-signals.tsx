import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  LogOut, 
  TrendingUp, 
  RefreshCw,
  ArrowLeft,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PdfExportButton from "@/components/pdf/PdfExportButton";
import clearLogoPath from "@assets/Clear_Primary_RGB_Logo_2Color_1753909931351.png";

export default function BrandSignals() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  
  // Get client and competitors from existing dashboard data
  const { client, competitors } = useDashboardData({
    clientId: user?.clientId || '',
    timePeriod: 'Last Month',
    businessSize: 'All',
    industryVertical: 'All'
  });

  // Function to run SoV analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/sov/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: {
            name: client?.name || 'Unknown',
            url: client?.websiteUrl || 'unknown.com'
          },
          competitors: competitors.map((c: any) => ({
            name: c.name || c.domain,
            url: c.domain
          })),
          vertical: client?.industryVertical || 'General'
        })
      });
      
      const data = await response.json();
      setAnalysisResults(data);
      
      toast({
        title: "Analysis Complete",
        description: "Share of Voice analysis has been completed.",
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Could not complete the analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Same style as dashboard */}
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
                Brand Signals
              </h1>
              <div className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5 truncate">
                {client?.name || "Loading..."} | Share of Voice Analysis
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline ml-2">Back to Dashboard</span>
              </Button>
            </Link>
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        
        {/* Analysis Control Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 mr-3 text-primary" />
              Share of Voice Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                <p><strong>Client:</strong> {client?.name || 'Loading...'}</p>
                <p><strong>Website:</strong> {client?.websiteUrl || 'Loading...'}</p>
                <p><strong>Competitors:</strong> {competitors?.length || 0} configured</p>
                {competitors?.length > 0 && (
                  <ul className="mt-2 ml-4">
                    {competitors.map((c: any) => (
                      <li key={c.id} className="text-xs">
                        • {c.domain}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <Button 
                className="w-full h-10"
                onClick={runAnalysis}
                disabled={isAnalyzing || !client}
              >
                {isAnalyzing ? (
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
            </div>
          </CardContent>
        </Card>

        {/* Results Display - TEXT ONLY FOR NOW */}
        {analysisResults && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Results (Text Output)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-50 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(analysisResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Placeholder for future sections */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-slate-400">Brand Perception - Coming Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Track how AI platforms describe your brand with sentiment analysis and competitive positioning.
            </p>
          </CardContent>
        </Card>
        
      </div>
    </div>
  );
}