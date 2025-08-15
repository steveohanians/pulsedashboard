import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building, BarChart3, Loader2, ExternalLink, Globe, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { portfolioService } from '@/services/api';
import { AdminQueryKeys } from '@/lib/adminQueryKeys';
// import { useEvent } from '@/hooks/use-events';

interface CDPortfolioTabProps {
  filterOptions: any[];
  sortedData: (data: any[], type: string) => any[];
  SortableHeader: React.FC<{ label: string; sortKey: string }>;
  user: any;
}

export function CDPortfolioTab({ filterOptions, sortedData, SortableHeader, user }: CDPortfolioTabProps) {
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [editingCdIndustryVertical, setEditingCdIndustryVertical] = useState<string>("");
  const [dataViewerOpen, setDataViewerOpen] = useState<boolean>(false);
  const [viewingCompanyData, setViewingCompanyData] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form refs for controlled form handling
  const companyFormRef = useRef<HTMLFormElement>(null);

  // Query for CD portfolio companies
  const { data: cdPortfolioCompanies, isLoading: cdPortfolioLoading } = useQuery<any[]>({
    queryKey: AdminQueryKeys.cdPortfolio(),
    enabled: user?.role === "Admin",
  });

  // Query for company data viewer
  const companyDataQuery = useQuery({
    queryKey: AdminQueryKeys.cdPortfolioData(viewingCompanyData?.id || ''),
    queryFn: async () => {
      if (!viewingCompanyData?.id) return null;
      return await portfolioService.getCompanyData(viewingCompanyData.id);
    },
    enabled: !!viewingCompanyData?.id && dataViewerOpen
  });

  // Event listeners (temporarily disabled)
  /*
  useEvent('portfolio.company.added', (payload) => {
    toast({
      title: "Company added - data syncing",
      description: "SEMrush integration started. Charts will update automatically.",
      duration: 4000,
    });
  });

  useEvent('semrush.integration.completed', (payload) => {
    toast({
      title: "Portfolio Integration Complete",
      description: "✅ Company added successfully! Dashboard data refreshed.",
      duration: 10000,
    });
  });
  */

  // Create CD Portfolio Company Mutation
  const createCdPortfolioCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      return await portfolioService.create(data);
    },
    onSuccess: (response) => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "📊 Company added to portfolio",
        description: "SEMrush integration starting. Fetching 15 months of historical data...",
        duration: 5000,
      });
      
      // Show detailed integration status after a brief delay
      setTimeout(() => {
        toast({
          title: "📊 Data sync in progress",
          description: "Fetching 15 months of historical data. Dashboard will refresh when complete.",
          duration: 8000,
        });
      }, 2000);
      
      // Event system will handle completion notifications automatically
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update CD Portfolio Company Mutation
  const updateCdPortfolioCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await portfolioService.update(id, data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Portfolio company updated",
        description: "Portfolio company information has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete CD Portfolio Company Mutation
  const deleteCdPortfolioCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      await portfolioService.delete(id);
    },
    onSuccess: () => {
      setDeletingCompanyId(null);
      toast({
        title: "Company removed from portfolio",
        description: "Portfolio averages recalculated and dashboard data refreshed automatically.",
        duration: 10000,
      });
    },
    onError: (error: Error) => {
      setDeletingCompanyId(null);
      toast({
        title: "Failed to remove company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test SEMrush Mutation
  const testSemrushMutation = useMutation({
    mutationFn: async (id: string) => {
      return await portfolioService.testSemrush(id);
    },
    onSuccess: (data, id) => {
      toast({
        title: data.success ? "SEMrush connection successful" : "SEMrush connection failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
        duration: 8000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to test SEMrush connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resync SEMrush Mutation
  const resyncSemrushMutation = useMutation({
    mutationFn: async (id: string) => {
      return await portfolioService.resyncSemrush(id);
    },
    onSuccess: (data, id) => {
      toast({
        title: "SEMrush resync started",
        description: data.message || "Portfolio data will update automatically when complete.",
        duration: 8000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resync SEMrush data",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const handleCreateCdPortfolioCompany = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      domain: formData.get("domain") as string,
      industryVertical: formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
    };
    
    if (!data.name || !data.domain || !data.industryVertical || !data.businessSize) {
      toast({
        title: "Validation error",
        description: "Name, domain, industry, and business size are required.",
        variant: "destructive",
      });
      return;
    }
    
    createCdPortfolioCompanyMutation.mutate(data);
  };

  const handleSaveCdPortfolioCompany = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      domain: formData.get("domain") as string,
      industryVertical: editingCdIndustryVertical || formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
    };
    
    if (!data.name || !data.domain) {
      toast({
        title: "Validation error",
        description: "Name and domain are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateCdPortfolioCompanyMutation.mutate({ id: editingItem.id, data });
  };

  const handleDeleteCdPortfolioCompany = (id: string) => {
    deleteCdPortfolioCompanyMutation.mutate(id);
  };

  // Get business sizes for dropdowns
  const businessSizes = filterOptions?.filter(option => option.type === 'business_size').map(option => ({
    value: option.value,
    label: option.value
  })) || [];

  // Get industry verticals for dropdowns
  const industryVerticals = filterOptions?.filter(option => option.type === 'industry_vertical').map(option => ({
    value: option.value,
    label: option.value
  })) || [];

  if (cdPortfolioLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            CD Portfolio Companies
            {cdPortfolioCompanies && (
              <Badge variant="secondary">{cdPortfolioCompanies.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Manage Clear Digital's portfolio companies used for benchmarking averages.
            </p>
            <Dialog open={isDialogOpen && editingItem?.type === 'add-cd-company'} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingItem(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingItem({ type: 'add-cd-company' });
                  setIsDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Portfolio Company
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Portfolio Company</DialogTitle>
                  <DialogDescription>
                    Add a new company to Clear Digital's portfolio for benchmarking.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateCdPortfolioCompany} className="space-y-4">
                  <div>
                    <Label htmlFor="cd-company-name">Company Name *</Label>
                    <Input
                      id="cd-company-name"
                      name="name"
                      type="text"
                      required
                      placeholder="Enter company name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cd-company-domain">Domain *</Label>
                    <Input
                      id="cd-company-domain"
                      name="domain"
                      type="text"
                      required
                      placeholder="example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cd-company-industry">Industry Vertical *</Label>
                    <NativeSelect
                      name="industryVertical"
                      required
                      options={industryVerticals}
                      placeholder="Select industry"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cd-company-size">Business Size *</Label>
                    <NativeSelect
                      name="businessSize"
                      required
                      options={businessSizes}
                      placeholder="Select business size"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCdPortfolioCompanyMutation.isPending}>
                      {createCdPortfolioCompanyMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Company'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Company" sortKey="name" />
                  <SortableHeader label="Domain" sortKey="domain" />
                  <SortableHeader label="Industry" sortKey="industryVertical" />
                  <SortableHeader label="Size" sortKey="businessSize" />
                  <TableHead>SEMrush</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cdPortfolioCompanies && sortedData(cdPortfolioCompanies, 'cd-companies').map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={`https://${company.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {company.domain}
                        </a>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>{company.industryVertical}</TableCell>
                    <TableCell>{company.businessSize}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={company.semrushConnected ? "default" : "secondary"}>
                          {company.semrushConnected ? "Connected" : "Pending"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => testSemrushMutation.mutate(company.id)}
                          disabled={testSemrushMutation.isPending}
                        >
                          {testSemrushMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog open={isDialogOpen && editingItem?.id === company.id} onOpenChange={(open) => {
                          setIsDialogOpen(open);
                          if (!open) {
                            setEditingItem(null);
                            setEditingCdIndustryVertical("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItem(company);
                                setEditingCdIndustryVertical(company.industryVertical);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Portfolio Company</DialogTitle>
                              <DialogDescription>
                                Update portfolio company information.
                              </DialogDescription>
                            </DialogHeader>
                            <form ref={companyFormRef} onSubmit={handleSaveCdPortfolioCompany} className="space-y-4">
                              <div>
                                <Label htmlFor="edit-cd-company-name">Company Name *</Label>
                                <Input
                                  id="edit-cd-company-name"
                                  name="name"
                                  type="text"
                                  required
                                  defaultValue={editingItem?.name}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-cd-company-domain">Domain *</Label>
                                <Input
                                  id="edit-cd-company-domain"
                                  name="domain"
                                  type="text"
                                  required
                                  defaultValue={editingItem?.domain}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-cd-company-industry">Industry Vertical *</Label>
                                <NativeSelect
                                  name="industryVertical"
                                  required
                                  options={industryVerticals}
                                  value={editingCdIndustryVertical}
                                  onValueChange={setEditingCdIndustryVertical}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-cd-company-size">Business Size *</Label>
                                <NativeSelect
                                  name="businessSize"
                                  required
                                  options={businessSizes}
                                  defaultValue={editingItem?.businessSize}
                                />
                              </div>
                              <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={updateCdPortfolioCompanyMutation.isPending}>
                                  {updateCdPortfolioCompanyMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    'Save Changes'
                                  )}
                                </Button>
                              </div>
                            </form>
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resyncSemrushMutation.mutate(company.id)}
                          disabled={resyncSemrushMutation.isPending}
                          title="Resync SEMrush data"
                        >
                          {resyncSemrushMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BarChart3 className="h-3 w-3" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setViewingCompanyData(company);
                            setDataViewerOpen(true);
                          }}
                          title="View company data"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingCompanyId(company.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Portfolio Company</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{company.name}" from the CD portfolio? This will trigger automatic portfolio averages recalculation and cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeletingCompanyId(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCdPortfolioCompany(company.id)}
                                disabled={deleteCdPortfolioCompanyMutation.isPending}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {deleteCdPortfolioCompanyMutation.isPending ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  'Remove Company'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!cdPortfolioCompanies || cdPortfolioCompanies.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No portfolio companies found. Add companies to enable portfolio benchmarking.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Company Data Viewer Dialog */}
      <Dialog open={dataViewerOpen} onOpenChange={setDataViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company Data: {viewingCompanyData?.name}</DialogTitle>
            <DialogDescription>
              Historical data and metrics for this portfolio company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {companyDataQuery.isLoading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading company data...</span>
              </div>
            )}
            {companyDataQuery.data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Basic Information</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Name:</strong> {viewingCompanyData.name}</p>
                      <p><strong>Domain:</strong> {viewingCompanyData.domain}</p>
                      <p><strong>Industry:</strong> {viewingCompanyData.industryVertical}</p>
                      <p><strong>Size:</strong> {viewingCompanyData.businessSize}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Data Status</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>SEMrush Connected:</strong> {viewingCompanyData.semrushConnected ? 'Yes' : 'No'}</p>
                      <p><strong>Last Updated:</strong> {viewingCompanyData.updatedAt ? new Date(viewingCompanyData.updatedAt).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                </div>
                
                {companyDataQuery.data.metrics && companyDataQuery.data.metrics.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recent Metrics</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Period</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {companyDataQuery.data.metrics.slice(0, 10).map((metric: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{metric.metricName}</TableCell>
                              <TableCell>{metric.value}</TableCell>
                              <TableCell>{metric.timePeriod}</TableCell>
                              <TableCell>{metric.sourceType}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {companyDataQuery.error && (
              <div className="text-center py-8 text-muted-foreground">
                Failed to load company data. Please try again.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}