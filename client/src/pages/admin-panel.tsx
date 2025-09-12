import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings, Plus, Edit, Trash2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Building, BarChart3, Upload, Users, Building2, TrendingUp, Filter, Sparkles, X, ChevronRight, Menu, Briefcase, Key, Loader2, Image, RefreshCw, CheckCircle, XCircle, Calculator, Activity } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useBenchmarkSyncStream } from "@/hooks/useBenchmarkSyncStream";

import { CSVImportModal } from "@/components/csv-import-modal";
import { GlobalPromptTemplateForm } from "@/components/global-prompt-template-form";
import { SOVPromptTemplateForm } from "@/components/sov-prompt-template-form";
import { EffectivenessPromptTemplateForm } from "@/components/effectiveness-prompt-template-form";
import { GA4IntegrationPanel } from "@/components/admin/GA4IntegrationPanel";
import { ServiceAccountForm } from "@/components/admin/ServiceAccountForm";
import { ServiceAccountsTable } from "@/components/admin/ServiceAccountsTable";
import { UserActivityModal } from "@/components/UserActivityModal";
import { logger } from "@/utils/logger";
import { AdminQueryKeys } from "@/lib/adminQueryKeys";
import { QueryError } from '@/components/QueryError';
import {
  clientService,
  userService,
  benchmarkService,
  portfolioService,
  filterService,
  competitorService,
  insightService,
  metricService,
  ga4Service,
  cacheManager
} from '@/services/api';
// import { useEvent, useEventEmitter } from '@/hooks/use-events';
import type { 
  Client, 
  User, 
  BenchmarkCompany, 
  CDPortfolioCompany, 
  FilterOption, 
  MetricPrompt,
  CreateClientData,
  UpdateClientData,
  CreateUserData,
  UpdateUserData,
  CreateBenchmarkCompanyData,
  CreateCDPortfolioCompanyData,
  CreateFilterOptionData
} from '@/types/api.types';
import { APP_CONFIG, getConfig } from '@/config/app.config';

// Dialog component for editing business size with controlled state
function BusinessSizeEditDialog({ option }: { option: { id: string; value: string; label: string } }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const value = formData.get('value') as string;
    
    try {
      await filterService.update(option.id, { value });
      toast({
        title: "Business size updated",
        description: `Updated to "${value}".`,
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update business size.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Business Size</DialogTitle>
          <DialogDescription>
            Update business size category
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="business-size">Business Size</Label>
            <Input id="business-size" name="value" defaultValue={option.value} required />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Dialog component for editing industry vertical with controlled state
function IndustryVerticalEditDialog({ option }: { option: { id: string; value: string; label: string } }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.target as HTMLFormElement);
    const value = formData.get('value') as string;
    
    try {
      await filterService.update(option.id, { value });
      toast({
        title: "Industry vertical updated",
        description: `Updated to "${value}".`,
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update industry vertical.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Industry Vertical</DialogTitle>
          <DialogDescription>
            Update industry vertical category
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="industry-vertical">Industry Vertical</Label>
            <Input id="industry-vertical" name="value" defaultValue={option.value} required />
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Event listeners for real-time updates (temporarily disabled for debugging)
  // Note: Will re-enable after confirming admin panel loads successfully
  
  // Form refs for controlled form handling
  const clientFormRef = useRef<HTMLFormElement>(null);
  const companyFormRef = useRef<HTMLFormElement>(null);
  
  // State for controlled form fields
  const [editingBusinessSize, setEditingBusinessSize] = useState<string>("");
  const [editingIndustryVertical, setEditingIndustryVertical] = useState<string>("");
  const [editingCdIndustryVertical, setEditingCdIndustryVertical] = useState<string>("");
  const [integratingCompany, setIntegratingCompany] = useState<string | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [dataViewerOpen, setDataViewerOpen] = useState<boolean>(false);
  const [viewingCompanyData, setViewingCompanyData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for client data check dialog
  const [showDataCheckDialog, setShowDataCheckDialog] = useState(false);
  const [dataCheckResults, setDataCheckResults] = useState<any>(null);
  const [isCheckingData, setIsCheckingData] = useState(false);
  
  // Activity tracking states
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<User | null>(null);

  // Real-time benchmark sync status tracking
  const benchmarkSyncStream = useBenchmarkSyncStream({
    enabled: user?.role === "Admin" && activeTab === "benchmark",
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 2000
  });

  // Track bulk sync state
  const [isBulkSyncInProgress, setIsBulkSyncInProgress] = useState(false);
  
  // Helper function to get real-time sync status for a company
  const getCompanySyncStatus = (companyId: string, company: BenchmarkCompany) => {
    // First check real-time status from SSE
    const realtimeStatus = benchmarkSyncStream.getCompanyStatus(companyId);
    if (realtimeStatus) {
      return realtimeStatus;
    }
    
    // Fall back to company.syncStatus or default to pending
    return company.syncStatus || "pending";
  };
  
  // Get sync status badge variant
  const getSyncStatusVariant = (status: "pending" | "processing" | "verified" | "error") => {
    switch (status) {
      case "processing": return "default";
      case "verified": return "secondary";
      case "error": return "destructive";
      case "pending":
      default: return "outline";
    }
  };
  
  // Get sync status display text
  const getSyncStatusText = (status: "pending" | "processing" | "verified" | "error") => {
    switch (status) {
      case "processing": return "Processing";
      case "verified": return "Verified";
      case "error": return "Error";
      case "pending":
      default: return "Pending";
    }
  };

  // Query for fetching portfolio company data
  const companyDataQuery = useQuery({
    queryKey: AdminQueryKeys.cdPortfolioData(viewingCompanyData?.id || ''),
    queryFn: async () => {
      if (!viewingCompanyData?.id) return null;
      return await portfolioService.getCompanyData(viewingCompanyData.id);
    },
    enabled: !!viewingCompanyData?.id && dataViewerOpen
  });

  // Extract tab from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tab = urlParams.get('tab');
    if (tab && ['users', 'clients', 'benchmark', 'cd-clients', 'system', 'prompts'].includes(tab)) {
      // Map 'system' to 'filters' for the internal tab state
      const mappedTab = tab === 'system' ? 'filters' : tab;
      setActiveTab(mappedTab);
    }
  }, [location]);

  // Handle persistent sync state and SSE connection status
  useEffect(() => {
    if (activeTab !== "benchmark" || user?.role !== "Admin") return;
    
    // Check for active sync jobs when SSE connection is established
    if (benchmarkSyncStream.connectionStatus === "connected") {
      // Check if there's ongoing bulk sync activity
      const hasActiveSyncs = benchmarkSyncStream.totalProgress.total > 0;
      if (hasActiveSyncs && !isBulkSyncInProgress) {
        setIsBulkSyncInProgress(true);
      } else if (!hasActiveSyncs && isBulkSyncInProgress) {
        // Bulk sync completed while we were away
        setIsBulkSyncInProgress(false);
        
        // Show completion notification if we missed it
        if (benchmarkSyncStream.totalProgress.completed > 0) {
          toast({
            title: "Sync Process Restored",
            description: `Found ongoing sync progress: ${benchmarkSyncStream.totalProgress.completed}/${benchmarkSyncStream.totalProgress.total} completed`,
            duration: 5000,
          });
        }
      }
    }
  }, [benchmarkSyncStream.connectionStatus, benchmarkSyncStream.totalProgress, activeTab, user?.role, isBulkSyncInProgress]);

  // Auto-refresh companies when sync completes
  useEffect(() => {
    if (benchmarkSyncStream.totalProgress.total > 0 && 
        benchmarkSyncStream.totalProgress.completed === benchmarkSyncStream.totalProgress.total) {
      // All syncs completed, refresh the data
      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.benchmarkCompanies() });
      
      if (isBulkSyncInProgress) {
        setIsBulkSyncInProgress(false);
        toast({
          title: "Bulk Sync Complete",
          description: `Successfully synced ${benchmarkSyncStream.totalProgress.completed} companies`,
          duration: 5000,
        });
      }
    }
  }, [benchmarkSyncStream.totalProgress, queryClient, isBulkSyncInProgress]);

  // Always-loaded queries for dropdowns and cross-tab functionality
  const { data: clients, isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useQuery<Client[]>({
    queryKey: AdminQueryKeys.clients(),
    queryFn: () => clientService.getAll(),
    enabled: user?.role === "Admin", // Always load for admin - used in dropdowns
  });

  // Query for GA4 service accounts (needed for client edit dropdown)
  const { data: ga4ServiceAccounts, isLoading: ga4ServiceAccountsLoading } = useQuery<any[]>({
    queryKey: AdminQueryKeys.ga4ServiceAccounts(),
    enabled: user?.role === "Admin", // Always load for admin, not just on specific tab
  });

  // Tab-specific queries - only load when needed for performance
  const { data: benchmarkCompanies, isLoading: benchmarkLoading, isError: benchmarkError, refetch: refetchBenchmark } = useQuery<BenchmarkCompany[]>({
    queryKey: AdminQueryKeys.benchmarkCompanies(),
    queryFn: () => benchmarkService.getAll(),
    enabled: user?.role === "Admin" && activeTab === "benchmark",
  });

  // Fetch benchmark companies statistics for Data Coverage
  const { data: benchmarkStats } = useQuery({
    queryKey: AdminQueryKeys.benchmarkCompaniesStats(),
    queryFn: () => benchmarkService.getStats(),
    enabled: user?.role === "Admin" && activeTab === "benchmark",
  });

  const { data: users, isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useQuery<User[]>({
    queryKey: AdminQueryKeys.users(),
    queryFn: () => userService.getAll(),
    enabled: user?.role === "Admin" && activeTab === "users",
  });

  // Query for CD portfolio companies (independent from clients)
  const { data: cdPortfolioCompanies, isLoading: cdPortfolioLoading, isError: cdPortfolioError, refetch: refetchCdPortfolio } = useQuery<CDPortfolioCompany[]>({
    queryKey: AdminQueryKeys.cdPortfolio(),
    queryFn: () => portfolioService.getAll(),
    enabled: user?.role === "Admin" && activeTab === "cd-clients",
  });

  // Query for filter options to populate dropdowns dynamically - always loaded
  const { data: filterOptions, isLoading: filterOptionsLoading, isError: filterOptionsError, refetch: refetchFilters } = useQuery<FilterOption[]>({
    queryKey: AdminQueryKeys.filterOptions(),
    queryFn: () => filterService.getAll(),
    enabled: user?.role === "Admin", // Always load for admin - used in dropdowns across tabs
  });

  // Query for metric prompts
  const { data: metricPrompts, isLoading: metricPromptsLoading, isError: metricPromptsError, refetch: refetchMetricPrompts } = useQuery<MetricPrompt[]>({
    queryKey: AdminQueryKeys.metricPrompts(),
    queryFn: () => metricService.getPrompts(),
    enabled: user?.role === "Admin",
  });

  // Mutations for client management
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateClientData }) => {
      return await clientService.update<Client>(id, data);
    },
    onSuccess: (data) => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Client updated",
        description: "Client information has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update client",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      await clientService.delete(id);
      return id;
    },
    onSuccess: (deletedId) => {
      toast({
        title: "Client deleted",
        description: "Client has been permanently deleted from the database.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutations for benchmark company management
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      return await benchmarkService.update(id, data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Company updated",
        description: "Benchmark company has been successfully updated.",
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

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      await benchmarkService.delete(id);
    },
    onSuccess: () => {
      toast({
        title: "Company deleted",
        description: "Benchmark company has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutations for user management
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserData }) => {
      return await userService.update<User>(id, data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "User updated",
        description: "User information has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await userService.delete(id);
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await userService.sendPasswordReset(userId);
    },
    onSuccess: () => {
      toast({
        title: "Password reset sent",
        description: "Password reset email has been sent to the user.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send password reset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "Active" | "Inactive" }) => {
      return await userService.update(userId, { status });
    },
    onSuccess: () => {
      toast({
        title: "User status updated",
        description: "User access has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create mutations for adding new items
  const createClientMutation = useMutation({
    mutationFn: async (data: CreateClientData) => {
      return await clientService.create(data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Client created",
        description: "New client has been successfully created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createBenchmarkCompanyMutation = useMutation({
    mutationFn: async (data: CreateBenchmarkCompanyData) => {
      return await benchmarkService.create(data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Company added",
        description: "New benchmark company has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      return await userService.invite(data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "User invited",
        description: "User invitation has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to invite user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // CD Portfolio Company mutations
  const createCdPortfolioCompanyMutation = useMutation({
    mutationFn: async (data: CreateCDPortfolioCompanyData) => {
      return await portfolioService.create(data);
    },
    onSuccess: (response) => {
      setIsDialogOpen(false);
      setEditingItem(null);
      
      // Show immediate success message
      toast({
        title: "Company added - data syncing",
        description: "SEMrush integration started. Charts will update automatically when data is ready (30-60 seconds).",
        duration: APP_CONFIG.toast.success,
      });
      
      // Show detailed integration status after a brief delay
      setTimeout(() => {
        toast({
          title: "📊 Data sync in progress",
          description: "Fetching 15 months of historical data. Dashboard will refresh when complete.",
          duration: APP_CONFIG.polling.semrushIntegration,
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

  // Removed polling function - replaced with event-driven system

  const updateCdPortfolioCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CDPortfolioCompany> }) => {
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

  const deleteCdPortfolioCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      await portfolioService.delete(id);
    },
    onSuccess: () => {
      setDeletingCompanyId(null);
      toast({
        title: "Company removed from portfolio",
        description: "✅ Portfolio averages recalculated and dashboard data refreshed automatically. Navigate to dashboard to see updated numbers.",
        duration: APP_CONFIG.toast.important,
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

  // Metric Prompts mutations
  const createMetricPromptMutation = useMutation({
    mutationFn: async (data: { metricName: string; promptTemplate: string; isActive?: boolean }) => {
      return await metricService.createPrompt(data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Custom prompt created",
        description: "Metric prompt has been successfully created.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create prompt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMetricPromptMutation = useMutation({
    mutationFn: async ({ metricName, data }: { metricName: string; data: Partial<MetricPrompt> }) => {
      return await metricService.updatePrompt(metricName, data);
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Prompt updated",
        description: "Metric prompt has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update prompt",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  // Handle save operations
  const handleSaveClient = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: formData.get("website") as string,
      ga4PropertyId: formData.get("gaPropertyId") as string,
      industryVertical: formData.get("industry") as string,
      businessSize: formData.get("businessSize") as string,
    };
    

    
    if (!data.name || !data.websiteUrl) {
      toast({
        title: "Validation error",
        description: "Name and website URL are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateClientMutation.mutate({ id: editingItem.id, data });
  };

  const handleSaveCompany = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: formData.get("website") as string,
      industryVertical: editingIndustryVertical || formData.get("industry") as string,
      businessSize: editingBusinessSize || editingItem?.businessSize, // Use state value instead of FormData
    };
    
    if (!data.name || !data.websiteUrl) {
      toast({
        title: "Validation error",
        description: "Name and website URL are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateCompanyMutation.mutate({ id: editingItem.id, data });
  };

  const handleDeleteCompany = (id: string) => {
    deleteCompanyMutation.mutate(id);
  };

  const handleDeleteCdPortfolioCompany = (id: string) => {
    deleteCdPortfolioCompanyMutation.mutate(id);
  };

  const handleSaveUser = (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const statusSwitch = form.querySelector('input[name="status"]') as HTMLInputElement;
    
    // Get status value - Switch component provides checked state
    const isActive = statusSwitch?.checked;
    const status = isActive ? "Active" : "Inactive";
    
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as "Admin" | "User",
      clientId: (formData.get("clientId") as string) === "none" ? undefined : formData.get("clientId") as string,
      status: status as "Active" | "Inactive",
    };
    

    
    if (!data.name || !data.email) {
      toast({
        title: "Validation error",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateUserMutation.mutate({ id: editingItem.id, data });
  };

  const handleCreateClient = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: formData.get("website") as string,
      industryVertical: formData.get("industry") as string,
      businessSize: formData.get("businessSize") as string,
      ga4PropertyId: formData.get("gaPropertyId") as string || null,
      serviceAccountId: formData.get("serviceAccountId") as string || null,
    };
    
    if (!data.name || !data.websiteUrl || !data.industryVertical || !data.businessSize) {
      toast({
        title: "Validation error",
        description: "Name, website URL, industry, and business size are required.",
        variant: "destructive",
      });
      return;
    }
    
    createClientMutation.mutate(data);
  }

  // Metric prompts handlers

  const handleUpdateMetricPrompt = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const metricName = formData.get("metricName") as string;
    const data = {
      description: formData.get("description") as string,
      promptTemplate: formData.get("promptTemplate") as string,
      isActive: formData.has("isActive"),
    };
    
    // Debug logging
    logger.debug("Form data:", { metricName, data });
    
    if (!data.promptTemplate || !metricName) {
      toast({
        title: "Validation error",
        description: "Metric name and prompt template are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateMetricPromptMutation.mutate({ metricName, data });
  };



  const handleCreateBenchmarkCompany = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: formData.get("websiteUrl") as string,
      industryVertical: formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
    };
    
    if (!data.name || !data.websiteUrl || !data.industryVertical || !data.businessSize) {
      toast({
        title: "Validation error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }
    
    createBenchmarkCompanyMutation.mutate(data);
  };

  const handleCreateCdPortfolioCompany = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      websiteUrl: formData.get("websiteUrl") as string,
      domain: new URL(formData.get("websiteUrl") as string).hostname,
      industryVertical: formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
      description: formData.get("description") as string || undefined,
    };
    
    if (!data.name || !data.websiteUrl || !data.industryVertical || !data.businessSize) {
      toast({
        title: "Validation error",
        description: "Name, website URL, industry, and business size are required.",
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
      websiteUrl: formData.get("website") as string,
      industryVertical: editingCdIndustryVertical || formData.get("industry") as string,
      businessSize: formData.get("businessSize") as string,
      description: formData.get("description") as string || undefined,
    };
    
    if (!data.name || !data.websiteUrl) {
      toast({
        title: "Validation error",
        description: "Name and website URL are required.",
        variant: "destructive",
      });
      return;
    }
    
    updateCdPortfolioCompanyMutation.mutate({ id: editingItem.id, data });
  };

  const handleInviteUser = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as "Admin" | "User",
      clientId: (formData.get("clientId") as string) === "none" ? undefined : formData.get("clientId") as string,
    };
    
    if (!data.name || !data.email) {
      toast({
        title: "Validation error",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }
    
    inviteUserMutation.mutate(data);
  };

  const handleSendPasswordReset = (userId: string) => {
    sendPasswordResetMutation.mutate(userId);
  };

  // Sorting functionality
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = <T extends Record<string, any>>(data: T[] | undefined, _tab: string): T[] => {
    if (!data || !Array.isArray(data)) {
      return [];
    }
    
    if (!sortConfig) {
      return data;
    }
    
    return [...data].sort((a, b) => {
      let aValue = (a as any)[sortConfig.key];
      let bValue = (b as any)[sortConfig.key];
      
      // Handle null/undefined values - put them at the end
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      // Handle dates/timestamps
      if (aValue instanceof Date || bValue instanceof Date || 
          (typeof aValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(aValue))) {
        const aDate = aValue instanceof Date ? aValue : new Date(aValue);
        const bDate = bValue instanceof Date ? bValue : new Date(bValue);
        const timeDiff = aDate.getTime() - bDate.getTime();
        return sortConfig.direction === 'asc' ? timeDiff : -timeDiff;
      }
      
      // Handle booleans
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        if (aValue === bValue) return 0;
        return sortConfig.direction === 'asc' 
          ? (aValue ? 1 : -1)
          : (aValue ? -1 : 1);
      }
      
      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Default comparison - convert to strings
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  };

  const SortableHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <div 
      className="flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors p-2 -m-2 rounded"
      onClick={() => handleSort(sortKey)}
    >
      {label}
      {sortConfig?.key === sortKey ? (
        sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
      ) : (
        <ArrowUpDown className="h-4 w-4 opacity-50" />
      )}
    </div>
  );

  const handleDeleteUser = (id: string) => {
    deleteUserMutation.mutate(id);
  };

  if (user?.role !== "Admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex-shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Settings className="text-white text-sm sm:text-base lg:text-lg" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">Admin Panel</h1>
              <p className="text-xs sm:text-sm text-slate-600 hidden sm:block">System Management</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>
      </nav>

      <div className="flex">
        {/* Content Area */}
        <div className="flex-1 lg:ml-64 p-4 sm:p-6 w-full">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Admin Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wide">Admin Settings</h3>
              <ul className="space-y-2">
                {[
                  { value: 'users', label: 'User Management', icon: Users },
                  { value: 'clients', label: 'Client Management', icon: Building2 },
                  { value: 'cd-clients', label: 'CD Portfolio', icon: Briefcase },
                  { value: 'benchmark', label: 'Benchmark Companies', icon: TrendingUp },
                  { value: 'filters', label: 'Filter Management', icon: Filter },
                  { value: 'ga4-accounts', label: 'GA4 Accounts', icon: Key },
                  { value: 'prompts', label: 'AI Prompts', icon: Sparkles }
                ].map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <li key={tab.value}>
                      <button
                        onClick={() => {
                          setActiveTab(tab.value);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm transition-all duration-200 rounded-lg group hover:bg-slate-50 ${
                          activeTab === tab.value
                            ? 'bg-primary/10 text-primary font-semibold border-l-4 border-primary shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="flex items-center">
                            <IconComponent className="w-4 h-4 mr-3" />
                            {tab.label}
                          </span>
                          <ChevronRight className={`w-4 h-4 transition-all duration-200 ${
                            activeTab === tab.value ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-50'
                          }`} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <nav className="w-64 bg-white border-r border-slate-200 fixed top-[88px] left-0 bottom-0 z-10 overflow-y-auto hidden lg:block">
        <div className="p-4">
          <h2 className="text-base font-bold text-slate-800 mb-4">Admin Settings</h2>
          <ul className="space-y-2">
            {[
              { value: 'users', label: 'User Management', icon: Users },
              { value: 'clients', label: 'Client Management', icon: Building2 },
              { value: 'cd-clients', label: 'CD Portfolio', icon: Briefcase },
              { value: 'benchmark', label: 'Benchmark Companies', icon: TrendingUp },
              { value: 'filters', label: 'Filter Management', icon: Filter },
              { value: 'ga4-accounts', label: 'GA4 Accounts', icon: Key },
              { value: 'prompts', label: 'AI Prompts', icon: Sparkles }
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <li key={tab.value}>
                  <button
                    onClick={() => setActiveTab(tab.value)}
                    className={`w-full text-left p-2 rounded-lg transition-colors text-xs flex items-center ${
                      activeTab === tab.value
                        ? 'bg-slate-100 text-primary font-medium'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-primary'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
              {/* User Management */}
              <TabsContent value="users">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">User Management</h2>
                  <Dialog open={isDialogOpen && editingItem?.type === 'invite-user'} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setEditingItem(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingItem({ type: 'invite-user' });
                        setIsDialogOpen(true);
                      }}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite New User</DialogTitle>
                        <DialogDescription>
                          Send an invitation to a new user to join the platform
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleInviteUser} className="space-y-4">
                        <div>
                          <Label htmlFor="invite-name">Name *</Label>
                          <Input 
                            id="invite-name" 
                            name="name"
                            placeholder="Enter full name"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-email">Email *</Label>
                          <Input 
                            id="invite-email"
                            name="email" 
                            type="email"
                            placeholder="Enter email address"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-role">Role</Label>
                          <NativeSelect 
                            name="role" 
                            defaultValue="User"
                            options={[
                              { value: "Admin", label: "Admin" },
                              { value: "User", label: "User" }
                            ]}
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-clientId">Assigned Client</Label>
                          <NativeSelect 
                            name="clientId" 
                            defaultValue="none"
                            options={[
                              { value: "none", label: "No Client (Admin Only)" },
                              ...(clients?.map((client: Client) => ({ value: client.id, label: client.name })) || [])
                            ]}
                            placeholder="Select a client"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setEditingItem(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={inviteUserMutation.isPending}
                          >
                            {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {/* Loading State */}
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-slate-600">Loading users...</span>
                  </div>
                ) : usersError ? (
                  <QueryError 
                    message="Failed to load users. Please try again." 
                    onRetry={refetchUsers}
                  />
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden space-y-3">
                      {sortedData(users, 'users')?.map((user) => (
                    <Card key={user.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium text-sm">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            <div className="text-xs text-gray-500">
                              {clients?.find((c: Client) => c.id === user.clientId)?.name || "No Client"}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={user.role === "Admin" ? "default" : "outline"} 
                                className={`text-xs ${user.role === "User" ? "bg-white border-primary text-primary hover:bg-primary/5" : ""}`}
                              >
                                {user.role}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">Active</Badge>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Dialog open={isDialogOpen && editingItem?.id === user.id} onOpenChange={(open) => {
                              setIsDialogOpen(open);
                              if (!open) setEditingItem(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setEditingItem(user);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit User</DialogTitle>
                                  <DialogDescription>
                                    Update user information and permissions
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSaveUser} className="space-y-4">
                                  <div>
                                    <Label htmlFor="name">Name *</Label>
                                    <Input 
                                      id="name" 
                                      name="name"
                                      defaultValue={user.name} 
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="email">Email *</Label>
                                    <Input 
                                      id="email"
                                      name="email" 
                                      type="email"
                                      defaultValue={user.email}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="role">Role</Label>
                                    <NativeSelect 
                                      name="role" 
                                      defaultValue={user.role}
                                      options={[
                                        { value: "Admin", label: "Admin" },
                                        { value: "User", label: "User" }
                                      ]}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="clientId">Assigned Client</Label>
                                    <NativeSelect 
                                      name="clientId" 
                                      defaultValue={user.clientId || "none"}
                                      options={[
                                        { value: "none", label: "No Client (Admin Only)" },
                                        ...(clients?.map((client: Client) => ({ value: client.id, label: client.name })) || [])
                                      ]}
                                      placeholder="Select a client"
                                    />
                                  </div>
                                  <div className="flex justify-between">
                                    <Button 
                                      type="button"
                                      variant="outline"
                                      onClick={() => handleSendPasswordReset(user.id)}
                                      disabled={sendPasswordResetMutation.isPending}
                                    >
                                      {sendPasswordResetMutation.isPending ? "Sending..." : "Send Password Reset"}
                                    </Button>
                                    <div className="flex space-x-2">
                                      <Button 
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setIsDialogOpen(false);
                                          setEditingItem(null);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit"
                                        disabled={updateUserMutation.isPending}
                                      >
                                        {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{user.name}"? This action cannot be undone and will remove the user's access to the system.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            
                            {/* Activity Tracking Button - Mobile */}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedUserForActivity(user);
                                setActivityModalOpen(true);
                              }}
                              title="View User Activity"
                            >
                              <Activity className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-44"><SortableHeader label="Email" sortKey="email" /></TableHead>
                          <TableHead className="hidden md:table-cell w-36">
                            <SortableHeader label="Client" sortKey="clientId" />
                          </TableHead>
                          <TableHead className="w-16"><SortableHeader label="Role" sortKey="role" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-16">Status</TableHead>
                          <TableHead className="hidden xl:table-cell w-36">
                            <SortableHeader label="Last Login" sortKey="lastLogin" />
                          </TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {sortedData(users, 'users')?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium text-xs">
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500 lg:hidden">{user.email}</div>
                              <div className="text-xs text-gray-500 md:hidden">
                                {clients?.find((c: Client) => c.id === user.clientId)?.name || "No Client"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs">{user.email}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{clients?.find((c: Client) => c.id === user.clientId)?.name || "No Client"}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={user.role === "Admin" ? "default" : "outline"} 
                              className={`text-xs ${user.role === "User" ? "bg-white border-primary text-primary hover:bg-primary/5" : ""}`}
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-6 px-2 text-xs ${
                                user.status === 'Active' 
                                  ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                              }`}
                              onClick={() => toggleUserActiveMutation.mutate({ 
                                userId: user.id, 
                                status: user.status === 'Active' ? 'Inactive' : 'Active'
                              })}
                              disabled={toggleUserActiveMutation.isPending}
                            >
                              {user.status}
                            </Button>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-xs">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Dialog open={isDialogOpen && editingItem?.id === user.id} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) setEditingItem(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setEditingItem(user);
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit User</DialogTitle>
                                    <DialogDescription>
                                      Update user information and permissions
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleSaveUser} className="space-y-4">
                                    <div>
                                      <Label htmlFor="name">Name *</Label>
                                      <Input 
                                        id="name" 
                                        name="name"
                                        defaultValue={user.name} 
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="email">Email *</Label>
                                      <Input 
                                        id="email"
                                        name="email" 
                                        type="email"
                                        defaultValue={user.email}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="role">Role</Label>
                                      <NativeSelect 
                                        name="role" 
                                        defaultValue={user.role}
                                        options={[
                                          { value: "Admin", label: "Admin" },
                                          { value: "User", label: "User" }
                                        ]}
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="clientId">Assigned Client</Label>
                                      <NativeSelect 
                                        name="clientId" 
                                        defaultValue={user.clientId || "none"}
                                        options={[
                                          { value: "none", label: "No Client (Admin Only)" },
                                          ...(clients?.map((client: Client) => ({ value: client.id, label: client.name })) || [])
                                        ]}
                                        placeholder="Select a client"
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch id="edit-user-status" name="status" defaultChecked={user.status === 'Active'} />
                                      <Label htmlFor="edit-user-status">Active</Label>
                                    </div>
                                    <div className="flex justify-between">
                                      <Button 
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleSendPasswordReset(user.id)}
                                        disabled={sendPasswordResetMutation.isPending}
                                      >
                                        {sendPasswordResetMutation.isPending ? "Sending..." : "Send Password Reset"}
                                      </Button>
                                      <div className="flex space-x-2">
                                        <Button 
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setIsDialogOpen(false);
                                            setEditingItem(null);
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button 
                                          type="submit"
                                          disabled={updateUserMutation.isPending}
                                        >
                                          {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                                        </Button>
                                      </div>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{user.name}"? This action cannot be undone and will remove the user's access to the system.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteUser(user.id)}
                                      disabled={deleteUserMutation.isPending}
                                    >
                                      {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              
                              {/* Activity Tracking Button */}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedUserForActivity(user);
                                  setActivityModalOpen(true);
                                }}
                                title="View User Activity"
                              >
                                <Activity className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                  </div>
                  </>
                )}
              </TabsContent>

              {/* Client Management */}
              <TabsContent value="clients">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Client Management</h2>
                  <div className="flex gap-2">
                    {/* Check Client Data Button */}
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          setIsCheckingData(true);
                          setShowDataCheckDialog(true);
                          
                          const response = await fetch('/api/debug/verify-client-isolation', {
                            credentials: 'include'
                          });
                          const data = await response.json();
                          
                          // Store results for dialog display
                          setDataCheckResults(data);
                          
                          
                        } catch (error) {
                          toast({
                            title: "Check Failed",
                            description: "Could not retrieve client data.",
                            variant: "destructive",
                          });
                          setShowDataCheckDialog(false);
                        } finally {
                          setIsCheckingData(false);
                        }
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Check Client Data
                    </Button>
                    
                    {/* Original Add Client Button */}
                    <Button onClick={() => {
                      setEditingItem({ type: 'client' });
                      setIsDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Client
                    </Button>
                  </div>
                </div>
                
                {/* Loading State */}
                {clientsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-slate-600">Loading clients...</span>
                  </div>
                ) : clientsError ? (
                  <QueryError 
                    message="Failed to load clients. Please try again." 
                    onRetry={refetchClients}
                  />
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden space-y-3">
                      {sortedData(clients, 'clients')?.map((client) => (
                    <Card key={client.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium text-sm">{client.name}</div>
                            <div className="text-xs text-gray-500">
                              <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {client.websiteUrl}
                              </a>
                            </div>
                            <div className="text-xs text-gray-500">Industry: {client.industryVertical}</div>
                            <div className="text-xs text-gray-500">Size: {client.businessSize}</div>
                            <div className="text-xs text-gray-500">GA4: {client.ga4PropertyId || "Not set"}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant={client.active ? "secondary" : "destructive"} className="text-xs">
                                {client.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setEditingItem({ ...client, type: 'client' });
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Client</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{client.name}"? This action cannot be undone and will remove all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteClientMutation.mutate(client.id)}
                                    disabled={deleteClientMutation.isPending}
                                  >
                                    {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-40"><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                          <TableHead className="hidden xl:table-cell w-36"><SortableHeader label="GA4 Property" sortKey="gaPropertyId" /></TableHead>
                          <TableHead className="w-32"><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                          <TableHead className="hidden md:table-cell w-32"><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>
                          <TableHead className="w-16">Status</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData(clients, 'clients')?.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium text-xs">
                              <div>
                                <div className="font-medium">{client.name}</div>
                                <div className="text-xs text-gray-500 lg:hidden">
                                  <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    {client.websiteUrl}
                                  </a>
                                </div>
                                <div className="text-xs text-gray-500 xl:hidden">GA4: {client.ga4PropertyId && /^\d+$/.test(client.ga4PropertyId) ? client.ga4PropertyId : "Not Set"}</div>
                                <div className="text-xs text-gray-500 md:hidden">{client.businessSize}</div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">
                              <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {client.websiteUrl}
                              </a>
                            </TableCell>
                            <TableCell className="hidden xl:table-cell font-mono text-xs">{client.ga4PropertyId && /^\d+$/.test(client.ga4PropertyId) ? client.ga4PropertyId : "Not Set"}</TableCell>
                            <TableCell className="text-xs">{client.industryVertical}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs">{client.businessSize}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-6 px-2 text-xs cursor-default ${
                                  client.active 
                                    ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                disabled
                              >
                                {client.active ? "Active" : "Inactive"}
                              </Button>
                            </TableCell>
                          <TableCell className="min-w-24">
                            <div className="flex space-x-1">

                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setEditingItem({ ...client, type: 'client' });
                                  setIsDialogOpen(true);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Client</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{client.name}"? This action cannot be undone and will remove all associated data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteClientMutation.mutate(client.id)}
                                      disabled={deleteClientMutation.isPending}
                                    >
                                      {deleteClientMutation.isPending ? "Deleting..." : "Delete Client"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                    </div>
                  </div>
                  </>
                )}

                {/* Unified Client Dialog for Add/Edit */}
                <Dialog open={isDialogOpen && editingItem?.type === 'client'} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) setEditingItem(null);
                }} key={`client-dialog-${editingItem?.id || 'new'}`}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingItem?.id ? "Edit Client" : "Add New Client"}</DialogTitle>
                      <DialogDescription>
                        {editingItem?.id ? "Update client information and settings" : "Create a new client for analytics tracking"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={editingItem?.id ? handleSaveClient : handleCreateClient} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input 
                          id="name" 
                          name="name"
                          defaultValue={editingItem?.name || ""} 
                          placeholder={editingItem?.id ? "" : "Enter client name"}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="website">Website URL *</Label>
                        <Input 
                          id="website" 
                          name="website"
                          type="url"
                          defaultValue={editingItem?.websiteUrl || ""} 
                          placeholder={editingItem?.id ? "" : "https://client-website.com"}
                          required
                        />
                      </div>
                      <GA4IntegrationPanel 
                        clientId={editingItem?.id || null}
                        currentGA4PropertyId={editingItem?.ga4PropertyId && /^\d+$/.test(editingItem.ga4PropertyId) ? editingItem.ga4PropertyId : ""}
                        serviceAccounts={ga4ServiceAccounts || []}
                        onGA4PropertyUpdate={(propertyId) => {
                          // Update hidden form field for submission
                          const hiddenInputId = editingItem?.id ? `hidden-gaPropertyId-${editingItem.id}` : 'hidden-gaPropertyId-new';
                          const input = document.querySelector(`#${hiddenInputId}`) as HTMLInputElement;
                          if (input) {
                            input.value = propertyId;
                          }
                        }}
                        onServiceAccountUpdate={(serviceAccountId) => {
                          // Update hidden form field for service account submission
                          const hiddenInputId = editingItem?.id ? `hidden-serviceAccount-${editingItem.id}` : 'hidden-serviceAccount-new';
                          const input = document.querySelector(`#${hiddenInputId}`) as HTMLInputElement;
                          if (input) {
                            input.value = serviceAccountId;
                          }
                        }}
                      />
                      
                      {/* GA4 Data Sync Button - Only show if client has GA4 property configured */}
                      {editingItem?.id && editingItem?.ga4PropertyId && /^\d+$/.test(editingItem.ga4PropertyId) && (
                        <div className="space-y-3 border-t pt-4">
                          <Label>GA4 Data Synchronization</Label>
                          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-900">Manual Data Sync</p>
                              <p className="text-xs text-blue-700 mt-1">
                                Fetch the latest 15 months of GA4 data for this client
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  setIsLoading(true);
                                  toast({
                                    title: "Starting GA4 sync...",
                                    description: "This may take 30-60 seconds",
                                    duration: 5000,
                                  });
                                  
                                  const endpoint = `/api/ga4-sync/${editingItem.id}`;
                                  const response = await fetch(endpoint, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                  });
                                  
                                  const result = await response.json();
                                  
                                  if (!response.ok || !result.success) {
                                    throw new Error(result.error || 'GA4 sync failed');
                                  }
                                  
                                  // Simply update the lastGA4Sync field with current time
                                  const syncTime = new Date().toISOString();
                                  setEditingItem((prev: any) => ({
                                    ...prev,
                                    lastGA4Sync: syncTime
                                  }));
                                  
                                  toast({
                                    title: "GA4 Sync Complete",
                                    description: `Successfully synced GA4 data. ${result.metricsStored || 0} metrics stored.`,
                                    duration: 5000,
                                  });
                                  
                                  // Refresh the clients list in the background
                                  queryClient.invalidateQueries({ queryKey: AdminQueryKeys.clients() });
                                  
                                } catch (error) {
                                  toast({
                                    title: "GA4 Sync Failed",
                                    description: error instanceof Error ? error.message : "Failed to sync GA4 data",
                                    variant: "destructive",
                                    duration: 5000,
                                  });
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              disabled={isLoading}
                              className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Syncing...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Sync GA4 Data
                                </>
                              )}
                            </Button>
                          </div>
                          
                          {/* Last Sync Status */}
                          {editingItem?.id && editingItem?.ga4PropertyId && (
                            <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700">
                              <p><span className="font-medium">Property ID:</span> {editingItem.ga4PropertyId}</p>
                              <p><span className="font-medium">Last sync:</span> {editingItem.lastGA4Sync ? 
                                new Date(editingItem.lastGA4Sync).toLocaleString() : 
                                'Never'
                              }</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Hidden inputs for form submission */}
                      <input 
                        type="hidden" 
                        id={editingItem?.id ? `hidden-gaPropertyId-${editingItem.id}` : 'hidden-gaPropertyId-new'} 
                        name="gaPropertyId" 
                        defaultValue={editingItem?.ga4PropertyId && /^\d+$/.test(editingItem.ga4PropertyId) ? editingItem.ga4PropertyId : ""} 
                      />
                      <input 
                        type="hidden" 
                        id={editingItem?.id ? `hidden-serviceAccount-${editingItem.id}` : 'hidden-serviceAccount-new'} 
                        name="serviceAccountId" 
                        defaultValue="" 
                      />
                      
                      {/* Icon Section */}
                      <div className="space-y-3">
                        <Label>Client Icon</Label>
                        <div className="flex items-center gap-3">
                          {editingItem?.iconUrl ? (
                            <div className="flex items-center gap-3">
                              <img 
                                src={editingItem.iconUrl} 
                                alt="Client icon" 
                                className="w-10 h-10 rounded-lg object-contain border border-gray-200"
                                style={{ backgroundColor: '#8C8C8C' }}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="text-sm text-gray-600">Icon loaded</div>
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center" style={{ backgroundColor: '#8C8C8C' }}>
                              <Building className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          {editingItem?.iconUrl ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (!editingItem?.id) {
                                  toast({
                                    title: "Save client first",
                                    description: "Please save the client before clearing the icon.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                try {
                                  setIsLoading(true);
                                  await clientService.clearIcon(editingItem.id);
                                  
                                  // Update the editingItem to remove the icon immediately
                                  setEditingItem((prev: Client | null) => prev ? { ...prev, iconUrl: null } : prev);
                                  toast({
                                    title: "Icon cleared successfully",
                                    description: "Client icon has been removed.",
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Failed to clear icon",
                                    description: error instanceof Error ? error.message : "Unable to clear icon.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              disabled={!editingItem?.id}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Clear Icon
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (!editingItem?.id) {
                                  toast({
                                    title: "Save client first",
                                    description: "Please save the client before fetching an icon.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                try {
                                  setIsLoading(true);
                                  const websiteUrl = (document.querySelector('input[name="website"]') as HTMLInputElement)?.value || editingItem.websiteUrl;
                                  if (!websiteUrl) {
                                    throw new Error("Website URL is required");
                                  }
                                  
                                  const domain = new URL(websiteUrl).hostname.replace('www.', '');
                                  const response = await clientService.fetchIcon(editingItem.id, domain);
                                  
                                  if (response.iconUrl) {
                                    setEditingItem((prev: Client | null) => prev ? { ...prev, iconUrl: response.iconUrl } : prev);
                                    toast({
                                      title: "Icon fetched successfully",
                                      description: "Client icon has been updated.",
                                    });
                                  } else {
                                    throw new Error("No icon found");
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Failed to fetch icon",
                                    description: error instanceof Error ? error.message : "Unable to fetch icon from Brandfetch API.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              disabled={!editingItem?.id}
                            >
                              <Image className="w-4 h-4 mr-2" />
                              Fetch Icon
                            </Button>
                          )}
                        </div>
                        <input 
                          type="hidden" 
                          name="iconUrl" 
                          value={editingItem?.iconUrl || ""} 
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="industry">Industry Vertical *</Label>
                        <NativeSelect 
                          name="industry" 
                          defaultValue={editingItem?.industryVertical || ""} 
                          required
                          options={
                            filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                              .sort((a, b) => a.order - b.order)
                              .map((option) => ({ value: option.value, label: option.value })) || []
                          }
                          placeholder="Select industry"
                        />
                      </div>
                      <div>
                        <Label htmlFor="businessSize">Business Size *</Label>
                        <NativeSelect 
                          name="businessSize" 
                          defaultValue={editingItem?.businessSize || ""} 
                          required
                          options={
                            filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                              .sort((a, b) => a.order - b.order)
                              .map((option) => ({ value: option.value, label: option.value })) || []
                          }
                          placeholder="Select business size"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsDialogOpen(false);
                            setEditingItem(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={editingItem?.id ? updateClientMutation.isPending : createClientMutation.isPending}
                        >
                          {editingItem?.id 
                            ? (updateClientMutation.isPending ? "Saving..." : "Save Changes")
                            : (createClientMutation.isPending ? "Creating..." : "Create Client")
                          }
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </TabsContent>

              {/* Benchmark Companies (Industry Reference) */}
              <TabsContent value="benchmark">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Benchmark Companies</h2>
                  <p className="text-sm text-slate-600">Industry reference companies used for Industry_Avg benchmarks</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => setIsCSVImportOpen(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Dialog open={isDialogOpen && editingItem?.type === 'add-company'} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) setEditingItem(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={() => {
                          setEditingItem({ type: 'add-company' });
                          setIsDialogOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Company
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Benchmark Company</DialogTitle>
                        <DialogDescription>
                          Add a new industry reference company to generate Industry_Avg benchmark data
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateBenchmarkCompany} className="space-y-4">
                        <div>
                          <Label htmlFor="company-name">Company Name *</Label>
                          <Input 
                            id="company-name" 
                            name="name"
                            placeholder="Enter company name"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="company-websiteUrl">Website URL *</Label>
                          <Input 
                            id="company-websiteUrl"
                            name="websiteUrl" 
                            type="url"
                            placeholder="https://client-website.com"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="company-industryVertical">Industry Vertical *</Label>
                          <NativeSelect 
                            name="industryVertical" 
                            required
                            options={
                              filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => ({ value: option.value, label: option.value })) || []
                            }
                            placeholder="Select industry"
                          />
                        </div>
                        <div>
                          <Label htmlFor="company-businessSize">Business Size *</Label>
                          <NativeSelect 
                            name="businessSize" 
                            required
                            options={
                              filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => ({ value: option.value, label: option.value })) || []
                            }
                            placeholder="Select business size"
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setEditingItem(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit"
                            disabled={createBenchmarkCompanyMutation.isPending}
                          >
                            {createBenchmarkCompanyMutation.isPending ? "Creating..." : "Add Company"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Total Benchmark Companies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{benchmarkCompanies?.length || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Active Companies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">{benchmarkCompanies?.filter(c => c.active).length || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Data Coverage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${(benchmarkStats?.coveragePercentage || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                        {benchmarkStats?.coveragePercentage || 0}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* SEMrush Sync Controls */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900">SEMrush Data Sync</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Sync benchmark company metrics from SEMrush to calculate Industry averages
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {/* Sync All Button */}
                      <Button
                        variant="default"
                        onClick={async () => {
                          try {
                            setIsBulkSyncInProgress(true);
                            toast({
                              title: "Starting bulk sync...",
                              description: "Syncing all benchmark companies from SEMrush",
                              duration: 10000,
                            });
                            
                            const response = await fetch('/api/admin/benchmark/sync-all', {
                              method: 'POST',
                              credentials: 'include',
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                              toast({
                                title: "Sync Complete",
                                description: result.message,
                                duration: 5000,
                              });
                              
                              // Refresh the companies list
                              queryClient.invalidateQueries({ queryKey: AdminQueryKeys.benchmarkCompanies() });
                            } else {
                              throw new Error(result.error);
                            }
                          } catch (error) {
                            toast({
                              title: "Sync Failed",
                              description: (error as Error).message,
                              variant: "destructive",
                            });
                          } finally {
                            setIsBulkSyncInProgress(false);
                          }
                        }}
                        disabled={isBulkSyncInProgress || benchmarkCompanies?.length === 0}
                        data-testid="sync-all-button"
                      >
                        {isBulkSyncInProgress || benchmarkSyncStream.totalProgress.total > 0 ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {benchmarkSyncStream.totalProgress.total > 0 
                              ? `Syncing... (${benchmarkSyncStream.totalProgress.completed}/${benchmarkSyncStream.totalProgress.total})`
                              : "Syncing..."
                            }
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync All Companies
                          </>
                        )}
                      </Button>
                      
                      {/* Recalculate Averages Button */}
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            toast({
                              title: "Recalculating...",
                              description: "Updating Industry averages from benchmark data",
                              duration: 5000,
                            });
                            
                            const response = await fetch('/api/admin/benchmark/recalculate-averages', {
                              method: 'POST',
                              credentials: 'include',
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                              toast({
                                title: "Recalculation Complete",
                                description: `Updated ${result.data.metricsUpdated} Industry_Avg metrics`,
                                duration: 5000,
                              });
                            } else {
                              throw new Error(result.error);
                            }
                          } catch (error) {
                            toast({
                              title: "Recalculation Failed",
                              description: (error as Error).message,
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        disabled={isLoading}
                      >
                        <Calculator className="h-4 w-4 mr-2" />
                        Recalculate Industry Avg
                      </Button>
                    </div>
                  </div>
                  
                  {/* Sync Status */}
                  {benchmarkCompanies && benchmarkCompanies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <p className="text-xs text-blue-600">
                        {benchmarkCompanies.filter(c => c.active).length} active companies ready for sync
                      </p>
                    </div>
                  )}
                </div>

                {/* Loading State */}
                {benchmarkLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-slate-600">Loading benchmark companies...</span>
                  </div>
                ) : benchmarkError ? (
                  <QueryError 
                    message="Failed to load benchmark companies. Please try again." 
                    onRetry={refetchBenchmark}
                  />
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden space-y-3">
                      {sortedData(benchmarkCompanies, 'benchmark')?.map((company) => (
                    <Card key={company.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium text-sm">{company.name}</div>
                            <div className="text-xs text-gray-500">{company.websiteUrl}</div>
                            <div className="text-xs text-gray-500">Industry: {company.industryVertical}</div>
                            <div className="text-xs text-gray-500">Size: {company.businessSize}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={getSyncStatusVariant(getCompanySyncStatus(company.id, company))} 
                                className="text-xs flex items-center gap-1"
                                data-testid={`sync-status-badge-${company.id}`}
                              >
                                {getCompanySyncStatus(company.id, company) === "processing" && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                {getSyncStatusText(getCompanySyncStatus(company.id, company))}
                              </Badge>
                              <Badge variant={company.active ? "secondary" : "destructive"} className="text-xs">
                                {company.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            {/* Sync Button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                const currentStatus = getCompanySyncStatus(company.id, company);
                                if (currentStatus === "processing") return;
                                
                                try {
                                  toast({
                                    title: "Syncing company...",
                                    description: `Fetching SEMrush data for ${company.name}`,
                                    duration: 5000,
                                  });
                                  
                                  const response = await fetch(`/api/admin/benchmark/sync/${company.id}`, {
                                    method: 'POST',
                                    credentials: 'include',
                                  });
                                  
                                  const result = await response.json();
                                  
                                  if (result.success) {
                                    toast({
                                      title: "Sync Complete",
                                      description: `${company.name}: ${result.data.metricsStored} metrics stored`,
                                      duration: 5000,
                                    });
                                    
                                    // Refresh the companies list
                                    queryClient.invalidateQueries({ queryKey: AdminQueryKeys.benchmarkCompanies() });
                                  } else {
                                    throw new Error(result.error);
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Sync Failed",
                                    description: `Failed to sync ${company.name}: ${(error as Error).message}`,
                                    variant: "destructive",
                                  });
                                }
                              }}
                              title="Sync from SEMrush"
                              className="h-8 w-8 p-0"
                              disabled={getCompanySyncStatus(company.id, company) === "processing" || isBulkSyncInProgress}
                              data-testid={`sync-button-${company.id}`}
                            >
                              {getCompanySyncStatus(company.id, company) === "processing" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            
                            <Dialog open={isDialogOpen && editingItem?.id === company.id} onOpenChange={(open) => {
                              setIsDialogOpen(open);
                              if (!open) {
                                setEditingItem(null);
                                setEditingBusinessSize("");
                                setEditingIndustryVertical("");
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setEditingItem(company);
                                    setEditingBusinessSize(company.businessSize);
                                    setEditingIndustryVertical(company.industryVertical);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Benchmark Company</DialogTitle>
                                  <DialogDescription>
                                    Update company information and verification status
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSaveCompany} className="space-y-4">
                                  <div>
                                    <Label htmlFor="name">Company Name *</Label>
                                    <Input 
                                      id="name" 
                                      name="name"
                                      defaultValue={company.name} 
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="websiteUrl">Website URL *</Label>
                                    <Input 
                                      id="websiteUrl" 
                                      name="websiteUrl"
                                      type="url"
                                      defaultValue={company.websiteUrl} 
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="industryVertical">Industry Vertical *</Label>
                                    <NativeSelect 
                                      name="industryVertical" 
                                      value={editingIndustryVertical} 
                                      onChange={(e) => setEditingIndustryVertical(e.target.value)}
                                      options={
                                        filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                          .sort((a, b) => a.order - b.order)
                                          .map((option) => ({ value: option.value, label: option.value })) || []
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="businessSize">Business Size *</Label>
                                    <NativeSelect 
                                      name="businessSize" 
                                      value={editingBusinessSize} 
                                      onChange={(e) => setEditingBusinessSize(e.target.value)}
                                      options={
                                        filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                          .sort((a, b) => a.order - b.order)
                                          .map((option) => ({ value: option.value, label: option.value })) || []
                                      }
                                    />
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        setIsDialogOpen(false);
                                        setEditingItem(null);
                                        setEditingBusinessSize("");
                                        setEditingIndustryVertical("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      type="submit"
                                      disabled={updateCompanyMutation.isPending}
                                    >
                                      {updateCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                                    </Button>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Benchmark Company</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{company.name}"? This will remove the company from benchmark calculations.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteCompany(company.id)}
                                    disabled={deleteCompanyMutation.isPending}
                                  >
                                    {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */} 
                <div className="hidden sm:block rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-40"><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                          <TableHead className="w-32"><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                          <TableHead className="hidden md:table-cell w-32"><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-20"><SortableHeader label="Verified" sortKey="sourceVerified" /></TableHead>
                          <TableHead className="w-16">Status</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData(benchmarkCompanies, 'benchmark')?.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium text-xs">
                              <div>
                                <div className="font-medium">{company.name}</div>
                                <div className="text-xs text-gray-500 lg:hidden">{company.websiteUrl}</div>
                                <div className="text-xs text-gray-500 md:hidden">{company.businessSize}</div>
                                <div className="text-xs text-gray-500 lg:hidden">
                                  <Badge 
                                    variant={getSyncStatusVariant(getCompanySyncStatus(company.id, company))} 
                                    className="text-xs flex items-center gap-1"
                                    data-testid={`sync-status-badge-mobile-${company.id}`}
                                  >
                                    {getCompanySyncStatus(company.id, company) === "processing" && (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    )}
                                    {getSyncStatusText(getCompanySyncStatus(company.id, company))}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">{company.websiteUrl}</TableCell>
                            <TableCell className="text-xs">{company.industryVertical}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs">{company.businessSize}</TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge 
                                variant={getSyncStatusVariant(getCompanySyncStatus(company.id, company))} 
                                className="text-xs flex items-center gap-1"
                                data-testid={`sync-status-badge-desktop-${company.id}`}
                              >
                                {getCompanySyncStatus(company.id, company) === "processing" && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                {getSyncStatusText(getCompanySyncStatus(company.id, company))}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-6 px-2 text-xs cursor-default ${
                                  company.active 
                                    ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                disabled
                              >
                                {company.active ? "Active" : "Inactive"}
                              </Button>
                            </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              {/* Sync Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={async () => {
                                  const currentStatus = getCompanySyncStatus(company.id, company);
                                  if (currentStatus === "processing") return;
                                  
                                  try {
                                    toast({
                                      title: "Syncing company...",
                                      description: `Fetching SEMrush data for ${company.name}`,
                                      duration: 5000,
                                    });
                                    
                                    const response = await fetch(`/api/admin/benchmark/sync/${company.id}`, {
                                      method: 'POST',
                                      credentials: 'include',
                                    });
                                    
                                    const result = await response.json();
                                    
                                    if (result.success) {
                                      toast({
                                        title: "Sync Complete",
                                        description: `${company.name}: ${result.data.metricsStored} metrics stored`,
                                        duration: 5000,
                                      });
                                      
                                      // Refresh the companies list
                                      queryClient.invalidateQueries({ queryKey: AdminQueryKeys.benchmarkCompanies() });
                                    } else {
                                      throw new Error(result.error);
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Sync Failed",
                                      description: `Failed to sync ${company.name}: ${(error as Error).message}`,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                title="Sync from SEMrush"
                                className="h-8 w-8 p-0"
                                disabled={getCompanySyncStatus(company.id, company) === "processing" || isBulkSyncInProgress}
                                data-testid={`sync-button-desktop-${company.id}`}
                              >
                                {getCompanySyncStatus(company.id, company) === "processing" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              
                              <Dialog open={isDialogOpen && editingItem?.id === company.id} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) {
                                  setEditingItem(null);
                                  setEditingBusinessSize(""); // Reset state when dialog closes
                                  setEditingIndustryVertical(""); // Reset industry vertical state too
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setEditingItem(company);
                                      setEditingBusinessSize(company.businessSize); // Initialize state with current value
                                      setEditingIndustryVertical(company.industryVertical); // Initialize industry state too
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Benchmark Company</DialogTitle>
                                    <DialogDescription>
                                      Update benchmark company details
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleSaveCompany} className="space-y-4">
                                    <div>
                                      <Label htmlFor="name">Name *</Label>
                                      <Input 
                                        id="name" 
                                        name="name"
                                        defaultValue={company.name} 
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="website">Website *</Label>
                                      <Input 
                                        id="website" 
                                        name="website"
                                        type="url"
                                        defaultValue={company.websiteUrl} 
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="industry">Industry Vertical</Label>
                                      <NativeSelect 
                                        value={editingIndustryVertical || company.industryVertical} 
                                        onChange={(e) => setEditingIndustryVertical(e.target.value)}
                                        options={
                                          filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                            .sort((a, b) => a.order - b.order)
                                            .map((option) => ({ value: option.value, label: option.value })) || []
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="businessSize">Business Size</Label>
                                      <NativeSelect 
                                        value={editingBusinessSize || company.businessSize} 
                                        onChange={(e) => setEditingBusinessSize(e.target.value)}
                                        options={
                                          filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                            .sort((a, b) => a.order - b.order)
                                            .map((option) => ({ value: option.value, label: option.value })) || []
                                        }
                                      />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                      <Button 
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setIsDialogOpen(false);
                                          setEditingItem(null);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit"
                                        disabled={updateCompanyMutation.isPending}
                                      >
                                        {updateCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Benchmark Company</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{company.name}"? This action cannot be undone and will remove all associated benchmark data.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDeleteCompany(company.id)}
                                      disabled={deleteCompanyMutation.isPending}
                                    >
                                      {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                </div>
                </>
                )}
              </TabsContent>

              {/* Clear Digital Portfolio Companies */}
              <TabsContent value="cd-clients">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900">Clear Digital Portfolio</h2>
                    <p className="text-sm text-slate-600 mt-1">Clear Digital's client portfolio used for CD_Avg benchmarks</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isDialogOpen && editingItem?.type === 'add-cd-company'} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) setEditingItem(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={() => {
                          setEditingItem({ type: 'add-cd-company' });
                          setIsDialogOpen(true);
                        }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Company
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Company to CD Portfolio</DialogTitle>
                          <DialogDescription>
                            Add a new company to the Clear Digital portfolio to generate CD_Avg benchmark data
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateCdPortfolioCompany} className="space-y-4">
                          <div>
                            <Label htmlFor="cd-company-name">Company Name *</Label>
                            <Input 
                              id="cd-company-name" 
                              name="name"
                              placeholder="Enter company name"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="cd-company-websiteUrl">Website URL *</Label>
                            <Input 
                              id="cd-company-websiteUrl"
                              name="websiteUrl" 
                              type="url"
                              placeholder="https://client-website.com"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="cd-company-industryVertical">Industry Vertical *</Label>
                            <NativeSelect 
                              name="industryVertical" 
                              required
                              options={
                                filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                  .sort((a, b) => a.order - b.order)
                                  .map((option) => ({ value: option.value, label: option.value })) || []
                              }
                              placeholder="Select industry"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cd-company-businessSize">Business Size *</Label>
                            <NativeSelect 
                              name="businessSize" 
                              required
                              options={
                                filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                  .sort((a, b) => a.order - b.order)
                                  .map((option) => ({ value: option.value, label: option.value })) || []
                              }
                              placeholder="Select business size"
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsDialogOpen(false);
                                setEditingItem(null);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit"
                              disabled={createCdPortfolioCompanyMutation.isPending}
                            >
                              {createCdPortfolioCompanyMutation.isPending ? "Adding..." : "Add Company"}
                            </Button>
                          </div>
                          {createCdPortfolioCompanyMutation.isPending && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-sm text-blue-700">
                                  Creating company and initializing SEMrush data integration...
                                </span>
                              </div>
                            </div>
                          )}
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Total Portfolio Companies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-primary">{cdPortfolioCompanies?.length || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Active Companies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-emerald-600">{cdPortfolioCompanies?.filter(c => c.active).length || 0}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-600">Benchmark Coverage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${(cdPortfolioCompanies?.length || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                        {(cdPortfolioCompanies?.length || 0) > 0 ? '100%' : '0%'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Loading State */}
                {cdPortfolioLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-slate-600">Loading portfolio companies...</span>
                  </div>
                ) : cdPortfolioError ? (
                  <QueryError 
                    message="Failed to load portfolio companies. Please try again." 
                    onRetry={refetchCdPortfolio}
                  />
                ) : (
                  <>
                    {/* Mobile Card Layout */}
                    <div className="block sm:hidden space-y-3">
                      {sortedData(cdPortfolioCompanies, 'cd-portfolio')?.map((company) => (
                    <Card key={company.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="font-medium text-sm">{company.name}</div>
                            <div className="text-xs text-gray-500">
                              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {company.websiteUrl}
                              </a>
                            </div>
                            <div className="text-xs text-gray-500">Industry: {company.industryVertical}</div>
                            <div className="text-xs text-gray-500">Size: {company.businessSize}</div>

                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-6 px-2 text-xs cursor-default ${
                                  company.active 
                                    ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                disabled
                              >
                                {company.active ? "Active" : "Inactive"}
                              </Button>
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <Dialog open={isDialogOpen && editingItem?.type === 'edit-cd-company' && editingItem?.id === company.id} onOpenChange={(open) => {
                              setIsDialogOpen(open);
                              if (!open) {
                                setEditingItem(null);
                                setEditingCdIndustryVertical("");
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setEditingItem({ type: 'edit-cd-company', ...company });
                                    setEditingCdIndustryVertical(company.industryVertical);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Portfolio Company</DialogTitle>
                                  <DialogDescription>
                                    Update company information
                                  </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSaveCdPortfolioCompany} className="space-y-4">
                                  <div>
                                    <Label htmlFor="name">Company Name *</Label>
                                    <Input 
                                      id="name" 
                                      name="name"
                                      defaultValue={company.name}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="website">Website URL *</Label>
                                    <Input 
                                      id="website"
                                      name="website" 
                                      type="url"
                                      defaultValue={company.websiteUrl}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="industry">Industry Vertical *</Label>
                                    <NativeSelect 
                                      name="industry"
                                      value={editingCdIndustryVertical} 
                                      onChange={(e) => setEditingCdIndustryVertical(e.target.value)}
                                      options={
                                        filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                          .sort((a, b) => a.order - b.order)
                                          .map((option) => ({ value: option.value, label: option.value })) || []
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="businessSize">Business Size *</Label>
                                    <NativeSelect 
                                      name="businessSize" 
                                      defaultValue={company.businessSize}
                                      options={
                                        filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                          .sort((a, b) => a.order - b.order)
                                          .map((option) => ({ value: option.value, label: option.value })) || []
                                      }
                                    />
                                  </div>

                                  <div className="flex justify-between">
                                    <Button 
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setViewingCompanyData(editingItem);
                                        setDataViewerOpen(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <BarChart3 className="h-4 w-4 mr-2" />
                                      View Data
                                    </Button>
                                    <div className="flex space-x-2">
                                      <Button 
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setIsDialogOpen(false);
                                          setEditingItem(null);
                                          setEditingCdIndustryVertical("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit"
                                        disabled={updateCdPortfolioCompanyMutation.isPending}
                                      >
                                        {updateCdPortfolioCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              </DialogContent>
                            </Dialog>
                            <AlertDialog open={deletingCompanyId === company.id} onOpenChange={(open) => {
                              if (!open && !deleteCdPortfolioCompanyMutation.isPending) {
                                setDeletingCompanyId(null);
                              }
                            }}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Portfolio Company</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{company.name}"? This will remove the company from your portfolio.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={deleteCdPortfolioCompanyMutation.isPending}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <Button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDeleteCdPortfolioCompany(company.id);
                                    }}
                                    disabled={deleteCdPortfolioCompanyMutation.isPending}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {deleteCdPortfolioCompanyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {deleteCdPortfolioCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
                                  </Button>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden lg:table-cell w-40"><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                          <TableHead className="w-32"><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                          <TableHead className="hidden md:table-cell w-32"><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>

                          <TableHead className="w-16">Status</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData(cdPortfolioCompanies, 'cd-portfolio')?.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium text-xs">
                              <div>
                                <div className="font-medium">{company.name}</div>
                                <div className="text-xs text-gray-500 lg:hidden">
                                  <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                    {company.websiteUrl}
                                  </a>
                                </div>
                                <div className="text-xs text-gray-500 md:hidden">{company.businessSize}</div>

                              </div>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">
                              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {company.websiteUrl}
                              </a>
                            </TableCell>
                            <TableCell className="text-xs">{company.industryVertical}</TableCell>
                            <TableCell className="hidden md:table-cell text-xs">{company.businessSize}</TableCell>

                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-6 px-2 text-xs cursor-default ${
                                  company.active 
                                    ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                disabled
                              >
                                {company.active ? "Active" : "Inactive"}
                              </Button>
                            </TableCell>
                            <TableCell className="w-20">
                            <div className="flex space-x-1">
                                <Dialog open={isDialogOpen && editingItem?.type === 'edit-cd-company' && editingItem?.id === company.id} onOpenChange={(open) => {
                                  setIsDialogOpen(open);
                                  if (!open) {
                                    setEditingItem(null);
                                    setEditingCdIndustryVertical(""); // Reset CD industry vertical state
                                  }
                                }}>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                                      setEditingItem({ type: 'edit-cd-company', ...company });
                                      setEditingCdIndustryVertical(company.industryVertical); // Initialize industry state
                                      setIsDialogOpen(true);
                                    }}>
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Portfolio Company</DialogTitle>
                                      <DialogDescription>
                                        Update company information
                                      </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleSaveCdPortfolioCompany} className="space-y-4">
                                      <div>
                                        <Label htmlFor="edit-cd-name">Company Name *</Label>
                                        <Input 
                                          id="edit-cd-name" 
                                          name="name"
                                          defaultValue={editingItem?.name}
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-cd-website">Website URL *</Label>
                                        <Input 
                                          id="edit-cd-website"
                                          name="website" 
                                          type="url"
                                          defaultValue={editingItem?.websiteUrl}
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-cd-industry">Industry Vertical *</Label>
                                        <NativeSelect 
                                          value={editingCdIndustryVertical || editingItem?.industryVertical} 
                                          onChange={(e) => setEditingCdIndustryVertical(e.target.value)}
                                          options={
                                            filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                              .sort((a, b) => a.order - b.order)
                                              .map((option) => ({ value: option.value, label: option.value })) || []
                                          }
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-cd-businessSize">Business Size *</Label>
                                        <NativeSelect 
                                          name="businessSize" 
                                          defaultValue={editingItem?.businessSize}
                                          options={
                                            filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                              .sort((a, b) => a.order - b.order)
                                              .map((option) => ({ value: option.value, label: option.value })) || []
                                          }
                                        />
                                      </div>

                                      <div className="flex justify-between">
                                        <Button 
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setViewingCompanyData(editingItem);
                                            setDataViewerOpen(true);
                                          }}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                          <BarChart3 className="h-4 w-4 mr-2" />
                                          View Data
                                        </Button>
                                        <div className="flex space-x-2">
                                          <Button 
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                              setIsDialogOpen(false);
                                              setEditingItem(null);
                                            }}
                                          >
                                            Cancel
                                          </Button>
                                          <Button 
                                            type="submit"
                                            disabled={updateCdPortfolioCompanyMutation.isPending}
                                          >
                                            {updateCdPortfolioCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                                          </Button>
                                        </div>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                                <AlertDialog open={deletingCompanyId === company.id} onOpenChange={(open) => {
                                  if (!open && !deleteCdPortfolioCompanyMutation.isPending) {
                                    setDeletingCompanyId(null);
                                  }
                                }}>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0"
                                      onClick={() => setDeletingCompanyId(company.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Remove from Portfolio</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to remove "{company.name}" from the Clear Digital portfolio? This will exclude them from CD benchmark calculations.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel disabled={deleteCdPortfolioCompanyMutation.isPending}>Cancel</AlertDialogCancel>
                                      <Button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          handleDeleteCdPortfolioCompany(company.id);
                                        }}
                                        disabled={deleteCdPortfolioCompanyMutation.isPending}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {deleteCdPortfolioCompanyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                        {deleteCdPortfolioCompanyMutation.isPending ? "Removing..." : "Remove from Portfolio"}
                                      </Button>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {(!cdPortfolioCompanies || cdPortfolioCompanies.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <Building className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <h3 className="text-lg font-medium mb-2">No Portfolio Companies</h3>
                      <p className="text-sm mb-4">Add companies to start building your portfolio benchmark.</p>
                      <Button onClick={() => {
                        setEditingItem({ type: 'add-cd-company' });
                        setIsDialogOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Company
                      </Button>
                    </div>
                  )}
                  </div>
                  </>
                )}
              </TabsContent>

              {/* Filters Editor */}
              <TabsContent value="filters">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Filters Configuration</h2>
                  <Dialog open={isDialogOpen && editingItem?.type === 'add-filter'} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setEditingItem(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingItem({ type: 'add-filter' });
                        setIsDialogOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Filter Option
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Filter Option</DialogTitle>
                        <DialogDescription>
                          Add a new option to the filter configuration
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget as HTMLFormElement);
                        const category = formData.get("category") as string;
                        const value = formData.get("value") as string;
                        
                        if (!category || !value) {
                          toast({
                            title: "Validation error",
                            description: "Category and value are required.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        try {
                          await filterService.create({ 
                            type: category === 'businessSizes' ? 'business_size' : 'industry_vertical',
                            value 
                          });

                          toast({
                            title: "Filter option added",
                            description: `Added "${value}" to ${category} filters.`,
                          });
                          setIsDialogOpen(false);
                          setEditingItem(null);
                        } catch (error) {
                          toast({
                            title: "Error",
                            description: "Failed to add filter option. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="filter-category">Category *</Label>
                          <NativeSelect 
                            name="category" 
                            required
                            options={[
                              { value: "businessSizes", label: "Business Sizes" },
                              { value: "industryVerticals", label: "Industry Verticals" }
                            ]}
                            placeholder="Select category"
                          />
                        </div>
                        <div>
                          <Label htmlFor="filter-value">Value *</Label>
                          <Input 
                            id="filter-value" 
                            name="value"
                            placeholder="Enter filter option value"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="filter-description">Description</Label>
                          <Textarea 
                            id="filter-description"
                            name="description" 
                            placeholder="Optional description for this filter option"
                            rows={3}
                          />
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsDialogOpen(false);
                              setEditingItem(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            Add Filter Option
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Business Sizes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filterOptions && filterOptions.filter(option => option.category === 'businessSizes').length > 0 ? (
                          filterOptions
                            .filter(option => option.category === 'businessSizes')
                            .map((option) => (
                              <div key={option.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs">{option.value}</span>
                                <div className="flex space-x-1">
                                  <BusinessSizeEditDialog option={option} />
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await filterService.delete(option.id);
                                        toast({
                                          title: "Filter option deleted",
                                          description: `Removed "${option.value}" from business sizes.`,
                                        });
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to delete filter option.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="text-center text-slate-500 py-4">
                            No business size filters configured. Use "Add Filter Option" to create some.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Industry Verticals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filterOptions && filterOptions.filter(option => option.category === 'industryVerticals').length > 0 ? (
                          filterOptions
                            .filter(option => option.category === 'industryVerticals')
                            .map((option) => (
                              <div key={option.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span className="text-xs">{option.value}</span>
                                <div className="flex space-x-1">
                                  <IndustryVerticalEditDialog option={option} />
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await filterService.delete(option.id);
                                        toast({
                                          title: "Filter option deleted",
                                          description: `Removed "${option.value}" from industry verticals.`,
                                        });
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to delete filter option.",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))
                        ) : (
                          <div className="text-center text-slate-500 py-4">
                            No industry vertical filters configured. Use "Add Filter Option" to create some.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* GA4 Service Account Management */}
              <TabsContent value="ga4-accounts">
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900">Google Analytics Service Accounts</h2>
                      <p className="text-xs text-slate-600 mt-1">
                        Manage Google service accounts for GA4 API access and client property integration
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex">
                      <Key className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-blue-800">GA4 Integration Architecture</h3>
                        <p className="text-xs text-blue-600 mt-1">
                          Each Google service account can access multiple client GA4 properties. Clients must add Clear Digital's service account email as a guest user to their GA4 properties for data access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Service Accounts Table */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-slate-800">Service Accounts</h3>
                      <Dialog open={isDialogOpen && editingItem?.type === 'add-service-account'} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) setEditingItem(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => {
                            setEditingItem({ type: 'add-service-account' });
                            setIsDialogOpen(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Service Account
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Add Google Service Account</DialogTitle>
                            <DialogDescription>
                              Configure a new Google service account for GA4 API access
                            </DialogDescription>
                          </DialogHeader>
                          <ServiceAccountForm onClose={() => setIsDialogOpen(false)} />
                        </DialogContent>
                      </Dialog>
                    </div>

                    <ServiceAccountsTable />
                  </div>
                </div>
              </TabsContent>

              {/* AI Prompts Management */}
              <TabsContent value="prompts">
                <div className="space-y-6">
                  {/* Global Template Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Global Prompt Template
                      </CardTitle>
                      <p className="text-xs text-slate-600">
                        Configure the global AI prompt template that applies to all metric insights
                      </p>
                    </CardHeader>
                    <CardContent>
                      <GlobalPromptTemplateForm />
                    </CardContent>
                  </Card>

                  {/* SOV Template Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        SOV Question Generation Template
                      </CardTitle>
                      <p className="text-xs text-slate-600">
                        Configure the AI prompt template for Share of Voice question generation
                      </p>
                    </CardHeader>
                    <CardContent>
                      <SOVPromptTemplateForm />
                    </CardContent>
                  </Card>

                  {/* Effectiveness Scoring Prompts Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Effectiveness Scoring Templates
                      </CardTitle>
                      <p className="text-xs text-slate-600">
                        Configure AI prompts for website effectiveness analysis
                      </p>
                    </CardHeader>
                    <CardContent>
                      <EffectivenessPromptTemplateForm />
                    </CardContent>
                  </Card>

                  {/* Metric-Specific Prompts Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 sm:gap-0">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900">Custom Metric Prompts</h2>
                      <p className="text-xs text-slate-600">View and manage metric-specific prompt templates</p>
                    </div>
                  </div>

                  {/* Loading State */}
                  {metricPromptsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-sm text-slate-600">Loading metric prompts...</span>
                    </div>
                  ) : metricPrompts && metricPrompts.length > 0 ? (
                  <div className="bg-white rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Updated</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metricPrompts.map((prompt: MetricPrompt) => (
                          <TableRow key={prompt.metricName}>
                            <TableCell className="font-medium text-xs">{prompt.metricName}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs">{prompt.description || 'No description'}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`h-6 px-2 text-xs cursor-default ${
                                  prompt.isActive 
                                    ? 'bg-green-100 text-green-600 border-green-200 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                                }`}
                                disabled
                              >
                                {prompt.isActive ? "Active" : "Inactive"}
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(prompt.updatedAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Dialog open={isDialogOpen && editingItem?.type === 'edit-prompt' && editingItem?.metricName === prompt.metricName} onOpenChange={(open) => {
                                  setIsDialogOpen(open);
                                  if (!open) setEditingItem(null);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setEditingItem({ ...prompt, type: 'edit-prompt' });
                                        setIsDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle>Edit Metric Prompt: {prompt.metricName}</DialogTitle>
                                      <DialogDescription>
                                        Modify the AI prompt template for {prompt.metricName} analysis
                                      </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleUpdateMetricPrompt} className="space-y-4">
                                      <input type="hidden" name="metricName" value={prompt.metricName} />
                                      <div>
                                        <Label htmlFor="edit-prompt-description">Description</Label>
                                        <Input 
                                          id="edit-prompt-description"
                                          name="description" 
                                          defaultValue={prompt.description || ""}
                                          placeholder="Brief description of this prompt's purpose"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-prompt-template">Prompt Template *</Label>
                                        <Textarea 
                                          id="edit-prompt-template"
                                          name="promptTemplate" 
                                          defaultValue={prompt.promptTemplate}
                                          rows={12}
                                          className="font-mono text-sm"
                                          required
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                          Available variables: clientName, industry, businessSize, clientValue, industryAverage, cdPortfolioAverage, competitors
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <Switch id="edit-prompt-active" name="isActive" defaultChecked={prompt.isActive} />
                                        <Label htmlFor="edit-prompt-active">Active</Label>
                                      </div>
                                      <div className="flex justify-end space-x-2">
                                        <Button 
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setIsDialogOpen(false);
                                            setEditingItem(null);
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                        <Button type="submit">
                                          Save Changes
                                        </Button>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>

                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <h3 className="text-lg font-medium mb-2">No Custom Prompts</h3>
                    <p className="text-sm mb-4">Create custom AI prompts to tailor insights for specific metrics.</p>
                    <Button onClick={() => {
                      setEditingItem({ type: 'add-prompt' });
                      setIsDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Prompt
                    </Button>
                  </div>
                  )}
                </div>
              </TabsContent>




        </Tabs>

        {/* CSV Import Modal */}
        <CSVImportModal 
          open={isCSVImportOpen}
          onOpenChange={setIsCSVImportOpen}
          onImportComplete={() => {
            // Invalidate benchmark companies cache to refresh the table
            queryClient.invalidateQueries({ queryKey: AdminQueryKeys.benchmarkCompanies() });
          }}
        />
        </div>
      </div>

      {/* Portfolio Company Data Viewer Modal */}
      <Dialog open={dataViewerOpen} onOpenChange={(open) => {
        setDataViewerOpen(open);
        if (!open) {
          setViewingCompanyData(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Portfolio Company Data{viewingCompanyData?.name ? `: ${viewingCompanyData.name}` : ''}</DialogTitle>
            <DialogDescription>
              View all fetched metrics and data for this portfolio company
            </DialogDescription>
          </DialogHeader>
          
          {companyDataQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading company data...
            </div>
          ) : companyDataQuery.error ? (
            <div className="text-center py-8 text-red-600">
              <p>Error loading company data</p>
              <p className="text-sm text-red-500 mt-1">{(companyDataQuery.error as Error).message}</p>
            </div>
          ) : companyDataQuery.data ? (
            <div className="space-y-6">
              {/* Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Company Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {companyDataQuery.data.company.name}
                    </div>
                    <div>
                      <span className="font-medium">Website:</span> {companyDataQuery.data.company.websiteUrl}
                    </div>
                    <div>
                      <span className="font-medium">Industry:</span> {companyDataQuery.data.company.industryVertical}
                    </div>
                    <div>
                      <span className="font-medium">Business Size:</span> {companyDataQuery.data.company.businessSize}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fetched Metrics ({companyDataQuery.data.totalMetrics} total)</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(companyDataQuery.data.metrics).length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No metrics data found for this company.</p>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(companyDataQuery.data.metrics).map(([metricName, timePeriods]: [string, any]) => (
                        <div key={metricName} className="border rounded-lg p-4">
                          <h4 className="font-medium text-base mb-3">{metricName}</h4>
                          <div className="space-y-3">
                            {Object.entries(timePeriods)
                              .sort(([a], [b]) => b.localeCompare(a)) // Sort periods latest first
                              .map(([timePeriod, metrics]: [string, any]) => (
                              <div key={timePeriod} className="bg-gray-50 rounded p-3">
                                <h5 className="font-medium text-sm mb-2">{timePeriod}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                  {(metrics as any[]).map((metric, index) => {
                                    const value = typeof metric.value === 'object' && metric.value !== null 
                                      ? (metric.value.value ?? metric.value.source ?? JSON.stringify(metric.value))
                                      : metric.value;
                                    
                                    // Create a descriptive label for this metric
                                    const labels = [];
                                    if (metric.channel) labels.push(`${metric.channel}`);
                                    if (metric.deviceType) labels.push(`${metric.deviceType}`);
                                    if (metric.sourceType) labels.push(`${metric.sourceType}`);
                                    
                                    const description = labels.length > 0 ? labels.join(' • ') : 'General';
                                    
                                    // Format creation date for debugging duplicates
                                    const createdDate = metric.createdAt ? new Date(metric.createdAt).toLocaleDateString() : 'Unknown';
                                    const createdTime = metric.createdAt ? new Date(metric.createdAt).toLocaleTimeString() : 'Unknown';
                                    
                                    return (
                                      <div key={index} className="bg-white rounded p-2 border">
                                        <div className="font-medium text-blue-600 mb-1">{description}</div>
                                        <div className="text-lg font-semibold">{value}</div>
                                        <div className="text-xs text-gray-400 mt-1">
                                          <div>Stored: {createdDate}</div>
                                          <div>Time: {createdTime}</div>
                                          {metric.id && <div>ID: {metric.id.slice(0, 8)}...</div>}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Client Data Check Results Dialog */}
      <Dialog open={showDataCheckDialog} onOpenChange={setShowDataCheckDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Client Data Verification Report</DialogTitle>
            <DialogDescription>
              Data isolation and metrics summary for all clients
            </DialogDescription>
          </DialogHeader>
          
          {dataCheckResults && !isCheckingData && (
            <div className="space-y-6">
              {/* Summary Status */}
              <div className={`p-4 rounded-lg border ${
                dataCheckResults.isolation === 'VERIFIED ✅' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {dataCheckResults.isolation === 'VERIFIED ✅' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">
                    Isolation Status: {dataCheckResults.isolation}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Checked {dataCheckResults.clientCount} clients • Period: {dataCheckResults.period}
                </p>
              </div>
              
              {/* Client Data Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold">Client Name</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold">GA4 Property</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold">Total Metrics</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold">Latest Data Period</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold">Last GA4 Sync</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold">Isolation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dataCheckResults.results.map((client: any, index: number) => (
                      <tr key={client.clientId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium">{client.clientName}</div>
                            <div className="text-xs text-gray-500 font-mono">{client.clientId}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {client.ga4PropertyId ? (
                            <span className="text-sm font-mono bg-blue-100 px-2 py-1 rounded">
                              {client.ga4PropertyId}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Not configured</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${
                            client.metricsCount.clientSpecific > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {client.metricsCount.clientSpecific}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {client.latestDataPeriod ? (
                            <span className="text-sm font-medium">
                              {(() => {
                                // Parse the period to show as Month Year
                                if (client.latestDataPeriod === 'Last Month') {
                                  return 'Last Month';
                                } else if (client.latestDataPeriod.includes('-')) {
                                  // Format like "2025-07" to "July 2025"
                                  const [year, month] = client.latestDataPeriod.split('-');
                                  const date = new Date(parseInt(year), parseInt(month) - 1);
                                  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                }
                                return client.latestDataPeriod;
                              })()}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">No data</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {client.lastGA4Sync ? (
                            <span className="text-sm">
                              {new Date(client.lastGA4Sync).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {client.hasCorrectClientId ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Footer Information */}
              <div className="text-sm text-gray-600 space-y-1 border-t pt-4">
                <p>• Client-specific metrics are isolated by clientId</p>
                <p>• Each client can only see their own data when logged in</p>
                <p>• Benchmark metrics (Industry_Avg, CD_Avg) are shared across all clients</p>
              </div>
            </div>
          )}
          
          {isCheckingData && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Checking client data...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* User Activity Modal */}
      <UserActivityModal 
        user={selectedUserForActivity}
        isOpen={activityModalOpen}
        onClose={() => {
          setActivityModalOpen(false);
          setSelectedUserForActivity(null);
        }}
      />
    </div>
  );
}
