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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Settings, Plus, Edit, Trash2, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.clientId || "N/A"}</TableCell>
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
                                        disabled={updateUserMutation.isPending}
                                      >
                                        {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
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
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Business Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients?.map((client: any) => (
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
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Company
                  </Button>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Website</TableHead>
                        <TableHead>Industry</TableHead>
                        <TableHead>Business Size</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {benchmarkCompanies?.map((company: any) => (
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
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter Option
                  </Button>
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
