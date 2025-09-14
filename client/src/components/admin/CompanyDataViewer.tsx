import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BarChart3, Building, Gauge, Users, MousePointer, Target } from "lucide-react";
import { transformCompanyDataCanonically, getCategoryDescriptionCanonical } from '@/utils/canonicalDataProcessor';
import { portfolioService, benchmarkService } from '@/services/api';
import { AdminQueryKeys } from "@/lib/adminQueryKeys";

interface CompanyDataViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: { id: string; name: string } | null;
  companyType: 'portfolio' | 'benchmark';
}

export function CompanyDataViewer({ open, onOpenChange, company, companyType }: CompanyDataViewerProps) {
  // Fetch company data based on type
  const companyDataQuery = useQuery({
    queryKey: companyType === 'portfolio' 
      ? AdminQueryKeys.cdPortfolioData(company?.id || '')
      : AdminQueryKeys.benchmarkCompanyData(company?.id || ''),
    queryFn: async () => {
      if (!company?.id) return null;
      if (companyType === 'portfolio') {
        return await portfolioService.getCompanyData(company.id);
      } else {
        return await benchmarkService.getCompanyData(company.id);
      }
    },
    enabled: !!company?.id && open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Business Insights{company?.name ? `: ${company.name}` : ''}</DialogTitle>
          <DialogDescription>
            Performance metrics and business insights organized by category
          </DialogDescription>
        </DialogHeader>

        {companyDataQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading company insights...
          </div>
        ) : companyDataQuery.error ? (
          <div className="text-center py-8 text-red-600">
            <p>Error loading company insights</p>
            <p className="text-sm text-red-500 mt-1">{(companyDataQuery.error as Error).message}</p>
          </div>
        ) : companyDataQuery.data ? (
          (() => {
            const businessInsights = transformCompanyDataCanonically(companyDataQuery.data);
            
            return (
              <div className="space-y-6">
                {/* Company Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Company Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-gray-600">Company Name</span>
                          <p className="font-medium">{companyDataQuery.data.company.name}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Website</span>
                          <p className="font-medium text-blue-600">{companyDataQuery.data.company.websiteUrl}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-gray-600">Industry</span>
                          <p className="font-medium">{companyDataQuery.data.company.industryVertical}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Business Size</span>
                          <p className="font-medium">{companyDataQuery.data.company.businessSize}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Data Status */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-gray-600">Data Status</span>
                          <p className="font-medium">{businessInsights.overview.dataAvailability}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Total Metrics</span>
                          <p className="font-medium">{businessInsights.overview.totalMetrics}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Last Updated</span>
                          <p className="font-medium">{businessInsights.overview.lastUpdated}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Insights */}
                {businessInsights.overview.totalMetrics === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <div className="text-gray-500">
                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No Performance Data Available</p>
                        <p className="text-sm">This company hasn't been synced with SEMrush data yet.</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Website Performance (Engagement Metrics) */}
                    {businessInsights.categories.engagementMetrics.metrics.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {businessInsights.categories.engagementMetrics.displayName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{getCategoryDescriptionCanonical('engagementMetrics')}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {businessInsights.categories.engagementMetrics.metrics.map((metric, index) => (
                              <div key={index} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                                <div className="text-sm text-gray-600 mb-1">{metric.name}</div>
                                <div className="text-2xl font-bold text-blue-700 mb-1">{metric.value}</div>
                                {metric.description ? (
                                  <div className="text-xs text-gray-500">{metric.description}</div>
                                ) : metric.period && (
                                  <div className="text-xs text-gray-400 mt-1">from {metric.period}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Traffic Sources */}
                    {businessInsights.categories.trafficSources.metrics.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {businessInsights.categories.trafficSources.displayName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{getCategoryDescriptionCanonical('trafficSources')}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {businessInsights.categories.trafficSources.metrics.map((metric, index) => (
                              <div key={index} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
                                <div className="text-sm text-gray-600 mb-1">{metric.name}</div>
                                <div className="text-2xl font-bold text-green-700 mb-1">{metric.value}</div>
                                {metric.description ? (
                                  <div className="text-xs text-gray-500">{metric.description}</div>
                                ) : metric.period && (
                                  <div className="text-xs text-gray-400 mt-1">from {metric.period}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* User Behavior */}
                    {businessInsights.categories.userBehavior.metrics.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {businessInsights.categories.userBehavior.displayName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{getCategoryDescriptionCanonical('userBehavior')}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {businessInsights.categories.userBehavior.metrics.map((metric, index) => (
                              <div key={index} className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-100">
                                <div className="text-sm text-gray-600 mb-1">{metric.name}</div>
                                <div className="text-2xl font-bold text-purple-700 mb-1">{metric.value}</div>
                                {metric.description ? (
                                  <div className="text-xs text-gray-500">{metric.description}</div>
                                ) : metric.period && (
                                  <div className="text-xs text-gray-400 mt-1">from {metric.period}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Engagement Metrics */}
                    {businessInsights.categories.engagement.metrics.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {businessInsights.categories.engagement.displayName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{getCategoryDescriptionCanonical('engagement')}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {businessInsights.categories.engagement.metrics.map((metric, index) => (
                              <div key={index} className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
                                <div className="text-sm text-gray-600 mb-1">{metric.name}</div>
                                <div className="text-2xl font-bold text-orange-700 mb-1">{metric.value}</div>
                                {metric.description ? (
                                  <div className="text-xs text-gray-500">{metric.description}</div>
                                ) : metric.period && (
                                  <div className="text-xs text-gray-400 mt-1">from {metric.period}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Technical Metrics (if any, shown in a collapsed state) */}
                    {businessInsights.categories.technical.metrics.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            {businessInsights.categories.technical.displayName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{getCategoryDescriptionCanonical('technical')}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {businessInsights.categories.technical.metrics.map((metric, index) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                <div className="text-xs text-gray-600 mb-1">{metric.name}</div>
                                <div className="text-lg font-semibold text-gray-700">{metric.value}</div>
                                {metric.period && (
                                  <div className="text-xs text-gray-400 mt-1">from {metric.period}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            );
          })()
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No company data available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}