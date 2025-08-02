import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Settings, Plus, Edit, Trash2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Building, BarChart3, Upload } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/Footer";
import { CSVImportModal } from "@/components/csv-import-modal";
import { GlobalPromptTemplateForm } from "@/components/global-prompt-template-form";

export default function AdminPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCSVImportOpen, setIsCSVImportOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form refs for controlled form handling
  const clientFormRef = useRef<HTMLFormElement>(null);
  const companyFormRef = useRef<HTMLFormElement>(null);
  
  // State for controlled form fields
  const [editingBusinessSize, setEditingBusinessSize] = useState<string>("");

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

  const { data: clients } = useQuery<any[]>({
    queryKey: ["/api/admin/clients"],
    enabled: user?.role === "Admin",
  });

  const { data: benchmarkCompanies } = useQuery<any[]>({
    queryKey: ["/api/admin/benchmark-companies"],
    enabled: user?.role === "Admin",
  });

  const { data: users } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    enabled: user?.role === "Admin",
  });

  // Query for CD portfolio companies (independent from clients)
  const { data: cdPortfolioCompanies } = useQuery<any[]>({
    queryKey: ["/api/admin/cd-portfolio"],
    enabled: user?.role === "Admin",
  });

  // Query for filter options to populate dropdowns dynamically
  const { data: filterOptions } = useQuery<any[]>({
    queryKey: ["/api/admin/filter-options"],
    enabled: user?.role === "Admin",
  });

  // Query for metric prompts
  const { data: metricPrompts } = useQuery<any[]>({
    queryKey: ["/api/admin/metric-prompts"],
    enabled: user?.role === "Admin",
  });

  // Mutations for client management
  const updateClientMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutations for benchmark company management
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/benchmark-companies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/benchmark-companies"] });
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
      await apiRequest("DELETE", `/api/admin/benchmark-companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/benchmark-companies"] });
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
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
      const res = await apiRequest("POST", `/api/admin/users/${userId}/send-password-reset`);
      return res.json();
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

  // Create mutations for adding new items
  const createClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
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
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/benchmark-companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/benchmark-companies"] });
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
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users/invite", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/cd-portfolio", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cd-portfolio"] });
      setIsDialogOpen(false);
      setEditingItem(null);
      toast({
        title: "Company added to portfolio",
        description: "Company has been successfully added to Clear Digital portfolio.",
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

  const updateCdPortfolioCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/cd-portfolio/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cd-portfolio"] });
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
      await apiRequest("DELETE", `/api/admin/cd-portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cd-portfolio"] });
      toast({
        title: "Company removed from portfolio",
        description: "Company has been removed from Clear Digital portfolio.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove company",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Metric Prompts mutations
  const createMetricPromptMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/metric-prompts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metric-prompts"] });
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
    mutationFn: async ({ metricName, data }: { metricName: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/metric-prompts/${metricName}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metric-prompts"] });
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
      industryVertical: formData.get("industry") as string,
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

  const handleSaveUser = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      role: formData.get("role") as string,
      clientId: (formData.get("clientId") as string) === "none" ? null : formData.get("clientId") as string,
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
      websiteUrl: formData.get("websiteUrl") as string,
      industryVertical: formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
      ga4PropertyId: formData.get("ga4PropertyId") as string || null,
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
  const handleCreateMetricPrompt = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const data = {
      metricName: formData.get("metricName") as string,
      description: formData.get("description") as string,
      promptTemplate: formData.get("promptTemplate") as string,
    };
    
    if (!data.metricName || !data.promptTemplate) {
      toast({
        title: "Validation error",
        description: "Metric name and prompt template are required.",
        variant: "destructive",
      });
      return;
    }
    
    createMetricPromptMutation.mutate(data);
  };

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
    console.debug("Form data:", { metricName, data });
    
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
      industryVertical: formData.get("industryVertical") as string,
      businessSize: formData.get("businessSize") as string,
      description: formData.get("description") as string || null,
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
      industryVertical: formData.get("industry") as string,
      businessSize: formData.get("businessSize") as string,
      description: formData.get("description") as string || null,
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
      role: formData.get("role") as string,
      clientId: (formData.get("clientId") as string) === "none" ? null : formData.get("clientId") as string,
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

  const sortedData = (data: any[] | undefined, _tab: string) => {
    if (!data || !sortConfig) return data || [];
    
    return [...data].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
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
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
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

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="w-full mb-4 sm:mb-6">
            <div className="flex overflow-x-auto pb-2 sm:pb-0">
              <TabsList className="grid grid-cols-7 min-w-max w-full text-xs sm:text-sm">
                <TabsTrigger value="users" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">User Management</span>
                  <span className="sm:hidden">Users</span>
                </TabsTrigger>
                <TabsTrigger value="clients" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">Client Management</span>
                  <span className="sm:hidden">Clients</span>
                </TabsTrigger>
                <TabsTrigger value="cd-clients" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">CD Portfolio</span>
                  <span className="sm:hidden">Portfolio</span>
                </TabsTrigger>
                <TabsTrigger value="benchmark" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">Benchmark Companies</span>
                  <span className="sm:hidden">Benchmark</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">Filter Management</span>
                  <span className="sm:hidden">Filters</span>
                </TabsTrigger>
                <TabsTrigger value="global-template" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">Global Template</span>
                  <span className="sm:hidden">Global</span>
                </TabsTrigger>
                <TabsTrigger value="prompts" className="px-2 sm:px-4 py-2 whitespace-nowrap">
                  <span className="hidden sm:inline">AI Prompts</span>
                  <span className="sm:hidden">Prompts</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
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
                          <Select name="role" defaultValue="User">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Admin">Admin</SelectItem>
                              <SelectItem value="User">User</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="invite-clientId">Assigned Client</Label>
                          <Select name="clientId" defaultValue="none">
                            <SelectTrigger>
                              <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Client (Admin Only)</SelectItem>
                              {clients?.map((client: any) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-40"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden sm:table-cell min-w-48"><SortableHeader label="Email" sortKey="email" /></TableHead>
                          <TableHead className="hidden sm:table-cell min-w-32">
                            <SortableHeader label="Client" sortKey="clientId" />
                          </TableHead>
                          <TableHead className="min-w-20"><SortableHeader label="Role" sortKey="role" /></TableHead>
                          <TableHead className="hidden md:table-cell min-w-20">Status</TableHead>
                          <TableHead className="hidden lg:table-cell min-w-36">
                            <SortableHeader label="Last Login" sortKey="lastLogin" />
                          </TableHead>
                          <TableHead className="min-w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {sortedData(users, 'users')?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium min-w-40">
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-xs text-gray-500 sm:hidden">{user.email}</div>
                              <div className="text-xs text-gray-500 sm:hidden">
                                {clients?.find((c: any) => c.id === user.clientId)?.name || "No Client"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell min-w-48">{user.email}</TableCell>
                          <TableCell className="hidden sm:table-cell min-w-32">{clients?.find((c: any) => c.id === user.clientId)?.name || "No Client"}</TableCell>
                          <TableCell className="min-w-20">
                            <Badge variant={user.role === "Admin" ? "default" : "secondary"} className="text-xs">
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell min-w-36 text-xs">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</TableCell>
                          <TableCell className="min-w-24">
                            <div className="flex space-x-1 sm:space-x-2">
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
                                    <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
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
                                      <Select name="role" defaultValue={user.role}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Admin">Admin</SelectItem>
                                          <SelectItem value="User">User</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label htmlFor="clientId">Assigned Client</Label>
                                      <Select name="clientId" defaultValue={user.clientId || "none"}>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select a client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No Client (Admin Only)</SelectItem>
                                          {clients?.map((client: any) => (
                                            <SelectItem key={client.id} value={client.id}>
                                              {client.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              {/* Client Management */}
              <TabsContent value="clients">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">Client Management</h2>
                  <Dialog open={isDialogOpen && editingItem?.type === 'add-client'} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setEditingItem(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingItem({ type: 'add-client' });
                        setIsDialogOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Client
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Client</DialogTitle>
                        <DialogDescription>
                          Create a new client for analytics tracking
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateClient} className="space-y-4">
                        <div>
                          <Label htmlFor="client-name">Name *</Label>
                          <Input 
                            id="client-name" 
                            name="name"
                            placeholder="Enter client name"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="client-websiteUrl">Website URL *</Label>
                          <Input 
                            id="client-websiteUrl"
                            name="websiteUrl" 
                            type="url"
                            placeholder="https://client-website.com"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="client-gaPropertyId">GA4 Property ID</Label>
                          <Input 
                            id="client-gaPropertyId"
                            name="gaPropertyId" 
                            placeholder="123456789"
                            className="font-mono"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Google Analytics 4 property ID for data collection
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="client-industryVertical">Industry Vertical *</Label>
                          <Select name="industryVertical" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => (
                                <SelectItem key={option.id} value={option.value}>
                                  {option.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="client-businessSize">Business Size *</Label>
                          <Select name="businessSize" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business size" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => (
                                <SelectItem key={option.id} value={option.value}>
                                  {option.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                            disabled={createClientMutation.isPending}
                          >
                            {createClientMutation.isPending ? "Creating..." : "Create Client"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-40"><SortableHeader label="Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden sm:table-cell min-w-48"><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                          <TableHead className="hidden lg:table-cell min-w-32"><SortableHeader label="GA4 Property" sortKey="gaPropertyId" /></TableHead>
                          <TableHead className="min-w-32"><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                          <TableHead className="hidden md:table-cell min-w-36"><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>
                          <TableHead className="min-w-20">Status</TableHead>
                          <TableHead className="min-w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                    <TableBody>
                      {sortedData(clients, 'clients')?.map((client: any) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium min-w-40">
                            <div>
                              <div className="font-medium">{client.name}</div>
                              <div className="text-xs text-slate-500 sm:hidden">{client.websiteUrl}</div>
                              <div className="text-xs text-slate-500 md:hidden">{client.businessSize}</div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell min-w-48">
                            <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              {client.websiteUrl}
                            </a>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell min-w-32 font-mono text-sm">{client.ga4PropertyId || "Not set"}</TableCell>
                          <TableCell className="min-w-32">{client.industryVertical}</TableCell>
                          <TableCell className="hidden md:table-cell min-w-36">{client.businessSize}</TableCell>
                          <TableCell className="min-w-20">
                            <Badge variant={client.active ? "secondary" : "destructive"} className="text-xs">
                              {client.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-24">
                            <div className="flex space-x-1 sm:space-x-2">
                              <Dialog open={isDialogOpen && editingItem?.id === client.id} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) setEditingItem(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(client);
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Client</DialogTitle>
                                    <DialogDescription>
                                      Update client information and settings
                                    </DialogDescription>
                                  </DialogHeader>
                                  <form onSubmit={handleSaveClient} className="space-y-4">
                                    <div>
                                      <Label htmlFor="name">Name *</Label>
                                      <Input 
                                        id="name" 
                                        name="name"
                                        defaultValue={client.name} 
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="website">Website *</Label>
                                      <Input 
                                        id="website" 
                                        name="website"
                                        type="url"
                                        defaultValue={client.websiteUrl} 
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="gaPropertyId">GA4 Property ID</Label>
                                      <Input 
                                        id="gaPropertyId" 
                                        name="gaPropertyId"
                                        defaultValue={client.gaPropertyId || ""} 
                                        placeholder="ex: 412345678901"
                                        className="font-mono"
                                      />
                                      <p className="text-xs text-slate-500 mt-1">
                                        Google Analytics 4 property ID for data collection
                                      </p>
                                    </div>
                                    <div>
                                      <Label htmlFor="industry">Industry</Label>
                                      <Input 
                                        id="industry" 
                                        name="industry"
                                        defaultValue={client.industryVertical} 
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="businessSize">Business Size</Label>
                                      <Select name="businessSize" defaultValue={client.businessSize}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                            .sort((a, b) => a.order - b.order)
                                            .map((option) => (
                                            <SelectItem key={option.id} value={option.value}>
                                              {option.value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                                        disabled={updateClientMutation.isPending}
                                      >
                                        {updateClientMutation.isPending ? "Saving..." : "Save Changes"}
                                      </Button>
                                    </div>
                                  </form>
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Delete Client
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
                          <Select name="industryVertical" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => (
                                <SelectItem key={option.id} value={option.value}>
                                  {option.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="company-businessSize">Business Size *</Label>
                          <Select name="businessSize" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business size" />
                            </SelectTrigger>
                            <SelectContent>
                              {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                .sort((a, b) => a.order - b.order)
                                .map((option) => (
                                <SelectItem key={option.id} value={option.value}>
                                  {option.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                      <div className={`text-2xl font-bold ${(benchmarkCompanies?.length || 0) > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                        {(benchmarkCompanies?.length || 0) > 0 ? '100%' : '0%'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortableHeader label="Name" sortKey="name" /></TableHead>
                        <TableHead><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                        <TableHead><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                        <TableHead><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>
                        <TableHead><SortableHeader label="Verified" sortKey="sourceVerified" /></TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData(benchmarkCompanies, 'benchmark')?.map((company: any) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>{company.websiteUrl}</TableCell>
                          <TableCell>{company.industryVertical}</TableCell>
                          <TableCell>{company.businessSize}</TableCell>
                          <TableCell>
                            <Badge variant={company.sourceVerified ? "secondary" : "outline"}>
                              {company.sourceVerified ? "Verified" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={company.active ? "secondary" : "destructive"}>
                              {company.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Dialog open={isDialogOpen && editingItem?.id === company.id} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) {
                                  setEditingItem(null);
                                  setEditingBusinessSize(""); // Reset state when dialog closes
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(company);
                                      setEditingBusinessSize(company.businessSize); // Initialize state with current value
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
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
                                      <Label htmlFor="industry">Industry</Label>
                                      <Input 
                                        id="industry" 
                                        name="industry"
                                        defaultValue={company.industryVertical} 
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor="businessSize">Business Size</Label>
                                      <Select 
                                        value={editingBusinessSize || company.businessSize} 
                                        onValueChange={setEditingBusinessSize}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                            .sort((a, b) => a.order - b.order)
                                            .map((option) => (
                                            <SelectItem key={option.id} value={option.value}>
                                              {option.value}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
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
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
                            <Label htmlFor="cd-company-description">Description</Label>
                            <Input 
                              id="cd-company-description"
                              name="description" 
                              placeholder="Optional company description"
                            />
                          </div>
                          <div>
                            <Label htmlFor="cd-company-industryVertical">Industry Vertical *</Label>
                            <Select name="industryVertical" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                              <SelectContent>
                                {filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                  .sort((a, b) => a.order - b.order)
                                  .map((option) => (
                                  <SelectItem key={option.id} value={option.value}>
                                    {option.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="cd-company-businessSize">Business Size *</Label>
                            <Select name="businessSize" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select business size" />
                              </SelectTrigger>
                              <SelectContent>
                                {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                  .sort((a, b) => a.order - b.order)
                                  .map((option) => (
                                  <SelectItem key={option.id} value={option.value}>
                                    {option.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="cd-company-description">Description</Label>
                            <Textarea 
                              id="cd-company-description"
                              name="description" 
                              placeholder="Optional description of the company"
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
                            <Button 
                              type="submit"
                              disabled={createCdPortfolioCompanyMutation.isPending}
                            >
                              {createCdPortfolioCompanyMutation.isPending ? "Adding..." : "Add Company"}
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

                <div className="rounded-md border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead><SortableHeader label="Company Name" sortKey="name" /></TableHead>
                          <TableHead className="hidden sm:table-cell"><SortableHeader label="Website" sortKey="websiteUrl" /></TableHead>
                          <TableHead><SortableHeader label="Industry" sortKey="industryVertical" /></TableHead>
                          <TableHead className="hidden md:table-cell"><SortableHeader label="Business Size" sortKey="businessSize" /></TableHead>
                          <TableHead className="hidden lg:table-cell">Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData(cdPortfolioCompanies, 'cd-portfolio')?.map((company: any) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium min-w-40">
                              <div>
                                <div className="font-medium">{company.name}</div>
                                <div className="text-xs text-slate-500 sm:hidden">{company.websiteUrl}</div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell min-w-48">
                              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {company.websiteUrl}
                              </a>
                            </TableCell>
                            <TableCell className="min-w-32">{company.industryVertical}</TableCell>
                            <TableCell className="hidden md:table-cell min-w-36">{company.businessSize}</TableCell>
                            <TableCell className="hidden lg:table-cell min-w-32 text-xs">
                              {company.description || "No description"}
                            </TableCell>
                            <TableCell className="min-w-20">
                              <Badge variant={company.active ? "secondary" : "outline"} className="text-xs">
                                {company.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="min-w-24">
                              <div className="flex space-x-1 sm:space-x-2">
                                <Dialog open={isDialogOpen && editingItem?.type === 'edit-cd-company' && editingItem?.id === company.id} onOpenChange={(open) => {
                                  setIsDialogOpen(open);
                                  if (!open) setEditingItem(null);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={() => {
                                      setEditingItem({ type: 'edit-cd-company', id: company.id, ...company });
                                      setIsDialogOpen(true);
                                    }}>
                                      <Edit className="h-4 w-4" />
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
                                        <Select name="industry" defaultValue={editingItem?.industryVertical}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {filterOptions?.filter(option => option.category === 'industryVerticals' && option.active)
                                              .sort((a, b) => a.order - b.order)
                                              .map((option) => (
                                              <SelectItem key={option.id} value={option.value}>
                                                {option.value}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-cd-businessSize">Business Size *</Label>
                                        <Select name="businessSize" defaultValue={editingItem?.businessSize}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {filterOptions?.filter(option => option.category === 'businessSizes' && option.active)
                                              .sort((a, b) => a.order - b.order)
                                              .map((option) => (
                                              <SelectItem key={option.id} value={option.value}>
                                                {option.value}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label htmlFor="edit-cd-description">Description</Label>
                                        <Textarea 
                                          id="edit-cd-description"
                                          name="description" 
                                          defaultValue={editingItem?.description || ""}
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
                                        <Button 
                                          type="submit"
                                          disabled={updateCdPortfolioCompanyMutation.isPending}
                                        >
                                          {updateCdPortfolioCompanyMutation.isPending ? "Saving..." : "Save Changes"}
                                        </Button>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteCdPortfolioCompanyMutation.mutate(company.id)}
                                        disabled={deleteCdPortfolioCompanyMutation.isPending}
                                      >
                                        {deleteCdPortfolioCompanyMutation.isPending ? "Removing..." : "Remove from Portfolio"}
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
                          const response = await fetch('/api/admin/filter-options', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ category, value }),
                          });

                          if (!response.ok) {
                            throw new Error('Failed to create filter option');
                          }

                          toast({
                            title: "Filter option added",
                            description: `Added "${value}" to ${category} filters.`,
                          });
                          setIsDialogOpen(false);
                          setEditingItem(null);
                          
                          // Refresh filter options data if needed
                          queryClient.invalidateQueries({ queryKey: ['/api/admin/filter-options'] });
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
                          <Select name="category" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="businessSizes">Business Sizes</SelectItem>
                              <SelectItem value="industryVerticals">Industry Verticals</SelectItem>
                            </SelectContent>
                          </Select>
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
                      <CardTitle>Business Sizes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filterOptions && filterOptions.filter(option => option.category === 'businessSizes').length > 0 ? (
                          filterOptions
                            .filter(option => option.category === 'businessSizes')
                            .map((option) => (
                              <div key={option.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span>{option.value}</span>
                                <div className="flex space-x-1">
                                  <Dialog>
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
                                      <div className="space-y-4">
                                        <div>
                                          <Label htmlFor="business-size">Business Size</Label>
                                          <Input id="business-size" defaultValue={option.value} />
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                          <Button variant="outline">Cancel</Button>
                                          <Button>Save Changes</Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await fetch(`/api/admin/filter-options/${option.id}`, {
                                          method: 'DELETE',
                                        });
                                        toast({
                                          title: "Filter option deleted",
                                          description: `Removed "${option.value}" from business sizes.`,
                                        });
                                        queryClient.invalidateQueries({ queryKey: ['/api/admin/filter-options'] });
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
                      <CardTitle>Industry Verticals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {filterOptions && filterOptions.filter(option => option.category === 'industryVerticals').length > 0 ? (
                          filterOptions
                            .filter(option => option.category === 'industryVerticals')
                            .map((option) => (
                              <div key={option.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                                <span>{option.value}</span>
                                <div className="flex space-x-1">
                                  <Dialog>
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
                                      <div className="space-y-4">
                                        <div>
                                          <Label htmlFor="industry-vertical">Industry Vertical</Label>
                                          <Input id="industry-vertical" defaultValue={option.value} />
                                        </div>
                                        <div className="flex justify-end space-x-2">
                                          <Button variant="outline">Cancel</Button>
                                          <Button>Save Changes</Button>
                                        </div>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await fetch(`/api/admin/filter-options/${option.id}`, {
                                          method: 'DELETE',
                                        });
                                        toast({
                                          title: "Filter option deleted",
                                          description: `Removed "${option.value}" from industry verticals.`,
                                        });
                                        queryClient.invalidateQueries({ queryKey: ['/api/admin/filter-options'] });
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

              {/* Metric Prompts Management */}
              <TabsContent value="prompts">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                  <h2 className="text-base sm:text-lg font-semibold text-slate-900">AI Metric Prompts</h2>
                  <Dialog open={isDialogOpen && editingItem?.type === 'add-prompt'} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) setEditingItem(null);
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingItem({ type: 'add-prompt' });
                        setIsDialogOpen(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Custom Prompt
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Add Custom Metric Prompt</DialogTitle>
                        <DialogDescription>
                          Create a custom AI prompt template for a specific metric analysis
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleCreateMetricPrompt} className="space-y-4">
                        <div>
                          <Label htmlFor="prompt-metric">Metric Name *</Label>
                          <Input 
                            id="prompt-metric"
                            name="metricName" 
                            placeholder="e.g., Bounce Rate, Session Duration, Traffic Channels"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="prompt-description">Description</Label>
                          <Input 
                            id="prompt-description"
                            name="description" 
                            placeholder="Brief description of this prompt's purpose"
                          />
                        </div>
                        <div>
                          <Label htmlFor="prompt-template">Prompt Template *</Label>
                          <Textarea 
                            id="prompt-template"
                            name="promptTemplate" 
                            placeholder="Use variables like {{clientName}}, {{industry}}, {{clientValue}}, {{industryAverage}}, {{cdPortfolioAverage}}, {{competitors}}"
                            rows={12}
                            className="font-mono text-sm"
                            required
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            Available variables: clientName, industry, businessSize, clientValue, industryAverage, cdPortfolioAverage, competitors
                          </p>
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
                            Create Prompt
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {metricPrompts && metricPrompts.length > 0 ? (
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
                        {metricPrompts.map((prompt: any) => (
                          <TableRow key={prompt.metricName}>
                            <TableCell className="font-medium">{prompt.metricName}</TableCell>
                            <TableCell className="max-w-xs truncate">{prompt.description || 'No description'}</TableCell>
                            <TableCell>
                              <Badge variant={prompt.isActive ? "default" : "secondary"}>
                                {prompt.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(prompt.updatedAt).toLocaleDateString()}</TableCell>
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
                                        <input type="checkbox" id="edit-prompt-active" name="isActive" defaultChecked={prompt.isActive} />
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
              </TabsContent>

              {/* Global Prompt Template Management */}
              <TabsContent value="global-template">
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                    <div>
                      <h2 className="text-base sm:text-lg font-semibold text-slate-900">Global Prompt Template</h2>
                      <p className="text-sm text-slate-600 mt-1">
                        Configure the global AI prompt template that applies to all metric insights
                      </p>
                    </div>
                  </div>

                  <Card>
                    <CardContent className="p-6">
                      <GlobalPromptTemplateForm />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
        </Tabs>

        {/* CSV Import Modal */}
        <CSVImportModal 
          open={isCSVImportOpen}
          onOpenChange={setIsCSVImportOpen}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/benchmark-companies"] });
          }}
        />
      </div>
      <Footer />
    </div>
  );
}
