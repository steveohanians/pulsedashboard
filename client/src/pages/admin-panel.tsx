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
import { ArrowLeft, Settings, Plus, Edit, Trash2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Building, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Form refs for controlled form handling
  const clientFormRef = useRef<HTMLFormElement>(null);
  const companyFormRef = useRef<HTMLFormElement>(null);

  // Extract tab from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tab = urlParams.get('tab');
    if (tab && ['users', 'clients', 'benchmark', 'system'].includes(tab)) {
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
    <TableHead 
      className="cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center justify-between">
        {label}
        {sortConfig?.key === sortKey ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
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
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center">
              <Settings className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Panel</h1>
              <p className="text-sm text-slate-600">System Management</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </nav>

      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="users">Users Manager</TabsTrigger>
            <TabsTrigger value="clients">Clients Manager</TabsTrigger>
            <TabsTrigger value="benchmark">Benchmark Companies</TabsTrigger>
            <TabsTrigger value="filters">Filters Editor</TabsTrigger>
          </TabsList>
              {/* Users Manager */}
              <TabsContent value="users">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Users Management</h2>
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Name" sortKey="name" />
                        <SortableHeader label="Email" sortKey="email" />
                        <SortableHeader label="Client" sortKey="clientId" />
                        <SortableHeader label="Role" sortKey="role" />
                        <TableHead>Status</TableHead>
                        <SortableHeader label="Last Login" sortKey="lastLogin" />
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData(users, 'users')?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{clients?.find((c: any) => c.id === user.clientId)?.name || "No Client"}</TableCell>
                          <TableCell>
                            <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                          <TableCell>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Dialog open={isDialogOpen && editingItem?.id === user.id} onOpenChange={(open) => {
                                setIsDialogOpen(open);
                                if (!open) setEditingItem(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(user);
                                      setIsDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
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
              </TabsContent>

              {/* Clients Manager */}
              <TabsContent value="clients">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Clients Management</h2>
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
                            placeholder="https://example.com"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="client-industryVertical">Industry Vertical *</Label>
                          <Select name="industryVertical" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Technology">Technology</SelectItem>
                              <SelectItem value="Technology - Artificial Intelligence">Technology - AI</SelectItem>
                              <SelectItem value="Technology - Cloud">Technology - Cloud</SelectItem>
                              <SelectItem value="Technology - Cybersecurity">Technology - Cybersecurity</SelectItem>
                              <SelectItem value="Technology - SaaS">Technology - SaaS</SelectItem>
                              <SelectItem value="Financial Services & Insurance">Financial Services</SelectItem>
                              <SelectItem value="Healthcare">Healthcare</SelectItem>
                              <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                              <SelectItem value="Consumer Goods">Consumer Goods</SelectItem>
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
                              <SelectItem value="Medium Business (100–500 employees)">Medium Business</SelectItem>
                              <SelectItem value="Large Business (500–1,000 employees)">Large Business</SelectItem>
                              <SelectItem value="Enterprise (1,000–5,000 employees)">Enterprise</SelectItem>
                              <SelectItem value="Large Enterprise (5,000+ employees)">Large Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="client-ga4PropertyId">GA4 Property ID</Label>
                          <Input 
                            id="client-ga4PropertyId"
                            name="ga4PropertyId" 
                            placeholder="GA4-XXXXXXXX (optional)"
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
                            disabled={createClientMutation.isPending}
                          >
                            {createClientMutation.isPending ? "Creating..." : "Create Client"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Name" sortKey="name" />
                        <SortableHeader label="Website" sortKey="websiteUrl" />
                        <SortableHeader label="Industry" sortKey="industryVertical" />
                        <SortableHeader label="Business Size" sortKey="businessSize" />
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData(clients, 'clients')?.map((client: any) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.websiteUrl}</TableCell>
                          <TableCell>{client.industryVertical}</TableCell>
                          <TableCell>{client.businessSize}</TableCell>
                          <TableCell>
                            <Badge variant={client.active ? "secondary" : "destructive"}>
                              {client.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
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
                                          <SelectItem value="Medium Business (100–500 employees)">Medium Business (100–500 employees)</SelectItem>
                                          <SelectItem value="Large Business (500–1,000 employees)">Large Business (500–1,000 employees)</SelectItem>
                                          <SelectItem value="Enterprise (1,000–5,000 employees)">Enterprise (1,000–5,000 employees)</SelectItem>
                                          <SelectItem value="Large Enterprise (5,000+ employees)">Large Enterprise (5,000+ employees)</SelectItem>
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
              </TabsContent>

              {/* Benchmark Companies */}
              <TabsContent value="benchmark">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Benchmark Companies</h2>
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
                          Add a new company to the benchmark dataset
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
                            placeholder="https://example.com"
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
                              <SelectItem value="Technology">Technology</SelectItem>
                              <SelectItem value="Technology - Artificial Intelligence">Technology - AI</SelectItem>
                              <SelectItem value="Technology - Cloud">Technology - Cloud</SelectItem>
                              <SelectItem value="Technology - Cybersecurity">Technology - Cybersecurity</SelectItem>
                              <SelectItem value="Technology - SaaS">Technology - SaaS</SelectItem>
                              <SelectItem value="Financial Services & Insurance">Financial Services</SelectItem>
                              <SelectItem value="Healthcare">Healthcare</SelectItem>
                              <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                              <SelectItem value="Consumer Goods">Consumer Goods</SelectItem>
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
                              <SelectItem value="Medium Business (100–500 employees)">Medium Business</SelectItem>
                              <SelectItem value="Large Business (500–1,000 employees)">Large Business</SelectItem>
                              <SelectItem value="Enterprise (1,000–5,000 employees)">Enterprise</SelectItem>
                              <SelectItem value="Large Enterprise (5,000+ employees)">Large Enterprise</SelectItem>
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader label="Name" sortKey="name" />
                        <SortableHeader label="Website" sortKey="websiteUrl" />
                        <SortableHeader label="Industry" sortKey="industryVertical" />
                        <SortableHeader label="Business Size" sortKey="businessSize" />
                        <SortableHeader label="Verified" sortKey="sourceVerified" />
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
                                if (!open) setEditingItem(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setEditingItem(company);
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
                                      <Select name="businessSize" defaultValue={company.businessSize}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Medium Business (100–500 employees)">Medium Business (100–500 employees)</SelectItem>
                                          <SelectItem value="Large Business (500–1,000 employees)">Large Business (500–1,000 employees)</SelectItem>
                                          <SelectItem value="Enterprise (1,000–5,000 employees)">Enterprise (1,000–5,000 employees)</SelectItem>
                                          <SelectItem value="Large Enterprise (5,000+ employees)">Large Enterprise (5,000+ employees)</SelectItem>
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

              {/* Filters Editor */}
              <TabsContent value="filters">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Filters Configuration</h2>
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
                      <form onSubmit={(e) => {
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
                        
                        toast({
                          title: "Filter option added",
                          description: `Added "${value}" to ${category} filters.`,
                        });
                        setIsDialogOpen(false);
                        setEditingItem(null);
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
                              <SelectItem value="timePeriods">Time Periods</SelectItem>
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
                        {[
                          "Medium Business (100–500 employees)",
                          "Large Business (500–1,000 employees)",
                          "Enterprise (1,000–5,000 employees)",
                          "Large Enterprise (5,000+ employees)"
                        ].map((size) => (
                          <div key={size} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <span>{size}</span>
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
                                    <Input id="business-size" defaultValue={size} />
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <Button variant="outline">Cancel</Button>
                                    <Button>Save Changes</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Industry Verticals</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[
                          "Technology",
                          "Technology - Artificial Intelligence",
                          "Technology - Cloud",
                          "Technology - Cybersecurity", 
                          "Technology - SaaS",
                          "Technology - Services",
                          "Financial Services & Insurance",
                          "Healthcare",
                          "Manufacturing",
                          "Semiconductor",
                          "Consumer Goods",
                          "Renewable Energy"
                        ].map((industry) => (
                          <div key={industry} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <span>{industry}</span>
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
                                    <Label htmlFor="industry">Industry Vertical</Label>
                                    <Input id="industry" defaultValue={industry} />
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <Button variant="outline">Cancel</Button>
                                    <Button>Save Changes</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
