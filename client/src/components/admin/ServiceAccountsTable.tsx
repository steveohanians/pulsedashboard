import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Key, CheckCircle, XCircle, Loader2, RefreshCw, Power, PowerOff, Link, Link2Off } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceAccountForm } from "./ServiceAccountForm";

interface ServiceAccount {
  serviceAccount: {
    id: string;
    name: string;
    serviceAccountEmail: string;
    verified: boolean;
    active: boolean;
    createdAt: string;
    lastUsed?: string;
  };
  totalProperties: number;
  verifiedProperties: number;
  activeClients: number;
}

export function ServiceAccountsTable() {
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serviceAccounts, isLoading, error } = useQuery<ServiceAccount[]>({
    queryKey: ['/api/admin/ga4-service-accounts'],
    retry: false
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ accountId, active }: { accountId: string; active: boolean }) => {
      return await apiRequest('PUT', `/api/admin/ga4-service-accounts/${accountId}`, {
        active: active
      });
    },
    onSuccess: (_, { active }) => {
      toast({
        title: `Service account ${active ? 'activated' : 'deactivated'}`,
        description: `Service account has been successfully ${active ? 'activated' : 'deactivated'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ga4-service-accounts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service account status.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest('DELETE', `/api/admin/ga4-service-accounts/${accountId}`);
    },
    onSuccess: () => {
      toast({
        title: "Service account deleted",
        description: "Service account has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ga4-service-accounts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service account.",
        variant: "destructive",
      });
    }
  });

  const authorizeOAuthMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // Open OAuth authorization in new tab to avoid browser security restrictions
      window.open(`/api/oauth/google/authorize/${accountId}`, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
      return Promise.resolve();
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest('POST', `/api/oauth/google/test/${accountId}`);
    },
    onSuccess: () => {
      toast({
        title: "OAuth access verified",
        description: "Google account access is working properly.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "OAuth verification failed",
        description: error.message || "Please re-authorize this Google account.",
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-slate-600">Loading service accounts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-500">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            <p className="text-sm">Failed to load service accounts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!serviceAccounts?.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-slate-500">
            <Key className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-sm font-medium mb-2">No Service Accounts</h3>
            <p className="text-xs mb-4">
              Add your first Google service account to enable GA4 data access
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Service Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Account Name</TableHead>
                <TableHead className="text-xs">Google Account Email</TableHead>
                <TableHead className="text-xs">Properties</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Connection</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceAccounts.map((account) => (
                <TableRow key={account.serviceAccount.id}>
                  <TableCell>
                    <div className="font-medium text-xs">{account.serviceAccount.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{account.serviceAccount.serviceAccountEmail}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>{account.totalProperties} properties</div>
                      <div className="text-slate-500">
                        {account.verifiedProperties} verified
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={account.serviceAccount.active ? "default" : "outline"}
                      className="h-6 px-2 text-xs"
                      onClick={() => toggleActiveMutation.mutate({ 
                        accountId: account.serviceAccount.id, 
                        active: !account.serviceAccount.active 
                      })}
                      disabled={toggleActiveMutation.isPending}
                    >
                      {account.serviceAccount.active ? (
                        <><Power className="h-3 w-3 mr-1" />Active</>
                      ) : (
                        <><PowerOff className="h-3 w-3 mr-1" />Inactive</>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center justify-center w-8 h-6 rounded ${
                      account.serviceAccount.verified 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {account.serviceAccount.verified ? (
                        <Link className="h-3 w-3" />
                      ) : (
                        <Link2Off className="h-3 w-3" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      {account.serviceAccount.verified ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => testConnectionMutation.mutate(account.serviceAccount.id)}
                          disabled={testConnectionMutation.isPending}
                          title="Test OAuth Access"
                        >
                          {testConnectionMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 px-2 text-xs"
                          onClick={() => authorizeOAuthMutation.mutate(account.serviceAccount.id)}
                          title="Authorize Google Access"
                        >
                          <Key className="h-3 w-3 mr-1" />
                          Authorize
                        </Button>
                      )}
                      
                      <Dialog open={isEditDialogOpen && editingAccount?.id === account.serviceAccount.id} 
                             onOpenChange={(open) => {
                               setIsEditDialogOpen(open);
                               if (!open) setEditingAccount(null);
                             }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingAccount(account.serviceAccount);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Service Account</DialogTitle>
                          </DialogHeader>
                          <ServiceAccountForm 
                            serviceAccount={editingAccount}
                            onClose={() => {
                              setIsEditDialogOpen(false);
                              setEditingAccount(null);
                            }} 
                          />
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-black hover:text-red-600"
                            title="Delete Account Permanently"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Service Account</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{account.serviceAccount.name}" and all associated data. 
                              This action cannot be undone and may break existing client integrations.
                              <br /><br />
                              <strong>Warning:</strong> This could affect active clients using this service account for GA4 data access.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(account.serviceAccount.id)}
                              disabled={deleteMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Delete Permanently
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
        </CardContent>
      </Card>
    </>
  );
}