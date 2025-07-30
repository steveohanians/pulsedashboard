import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Settings, Plus, Edit, Trash2, UserPlus } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function AdminPanel() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [editingItem, setEditingItem] = useState<any>(null);

  // Extract tab from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tab = urlParams.get('tab');
    if (tab && ['users', 'clients', 'benchmark', 'system'].includes(tab)) {
      setActiveTab(tab);
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
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="users">Users Manager</TabsTrigger>
                <TabsTrigger value="clients">Clients Manager</TabsTrigger>
                <TabsTrigger value="benchmark">Benchmark Companies</TabsTrigger>
                <TabsTrigger value="filters">Filters Editor</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                      <TableRow>
                        <TableCell className="font-medium">John Smith</TableCell>
                        <TableCell>john@acme.com</TableCell>
                        <TableCell>Acme Corporation</TableCell>
                        <TableCell>
                          <Badge variant="default">Admin</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Active</Badge>
                        </TableCell>
                        <TableCell>2024-01-15 14:30</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
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
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="user-name">Name</Label>
                                    <Input id="user-name" defaultValue="John Smith" />
                                  </div>
                                  <div>
                                    <Label htmlFor="user-email">Email</Label>
                                    <Input id="user-email" defaultValue="john@acme.com" />
                                  </div>
                                  <div>
                                    <Label htmlFor="user-role">Role</Label>
                                    <Select defaultValue="Admin">
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
                                    <DialogTrigger asChild>
                                      <Button variant="outline">Cancel</Button>
                                    </DialogTrigger>
                                    <Button>Save Changes</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
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
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
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
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="client-name">Name</Label>
                                      <Input id="client-name" defaultValue={client.name} />
                                    </div>
                                    <div>
                                      <Label htmlFor="client-website">Website</Label>
                                      <Input id="client-website" defaultValue={client.websiteUrl} />
                                    </div>
                                    <div>
                                      <Label htmlFor="client-industry">Industry</Label>
                                      <Input id="client-industry" defaultValue={client.industryVertical} />
                                    </div>
                                    <div>
                                      <Label htmlFor="client-size">Business Size</Label>
                                      <Select defaultValue={client.businessSize}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="All">All</SelectItem>
                                          <SelectItem value="Medium Business (100–500 employees)">Medium Business (100–500 employees)</SelectItem>
                                          <SelectItem value="Large Business (500–1,000 employees)">Large Business (500–1,000 employees)</SelectItem>
                                          <SelectItem value="Enterprise (1,000–5,000 employees)">Enterprise (1,000–5,000 employees)</SelectItem>
                                          <SelectItem value="Large Enterprise (5,000+ employees)">Large Enterprise (5,000+ employees)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                      <DialogTrigger asChild>
                                        <Button variant="outline">Cancel</Button>
                                      </DialogTrigger>
                                      <Button>Save Changes</Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
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
                                  <div className="space-y-4">
                                    <div>
                                      <Label htmlFor="company-name">Name</Label>
                                      <Input id="company-name" defaultValue={company.name} />
                                    </div>
                                    <div>
                                      <Label htmlFor="company-website">Website</Label>
                                      <Input id="company-website" defaultValue={company.websiteUrl} />
                                    </div>
                                    <div>
                                      <Label htmlFor="company-industry">Industry</Label>
                                      <Input id="company-industry" defaultValue={company.industryVertical} />
                                    </div>
                                    <div>
                                      <Label htmlFor="company-size">Business Size</Label>
                                      <Input id="company-size" defaultValue={company.businessSize} />
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                      <Button variant="outline">Cancel</Button>
                                      <Button>Save Changes</Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
