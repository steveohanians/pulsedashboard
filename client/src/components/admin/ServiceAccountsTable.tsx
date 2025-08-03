import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Key, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ServiceAccountForm } from "./ServiceAccountForm";

interface ServiceAccount {
  serviceAccount: {
    id: string;
    name: string;
    serviceAccountEmail: string;
    description?: string;
    maxProperties: number;
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

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest('DELETE', `/api/admin/ga4-service-accounts/${accountId}`);
    },
    onSuccess: () => {
      toast({
        title: "Service account deactivated",
        description: "Service account has been successfully deactivated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ga4-service-accounts'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate service account.",
        variant: "destructive",
      });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // This would test the service account credentials
      return await apiRequest('POST', `/api/admin/ga4-service-accounts/${accountId}/test-connection`);
    },
    onSuccess: () => {
      toast({
        title: "Connection successful",
        description: "Service account credentials are valid.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection failed",
        description: error.message || "Service account credentials are invalid.",
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
                <TableHead className="text-xs">Account</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Properties</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Last Used</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceAccounts.map((account) => (
                <TableRow key={account.serviceAccount.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-xs">{account.serviceAccount.name}</div>
                      {account.serviceAccount.description && (
                        <div className="text-xs text-slate-500">{account.serviceAccount.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-mono">{account.serviceAccount.serviceAccountEmail}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div>{account.totalProperties} / {account.serviceAccount.maxProperties}</div>
                      <div className="text-slate-500">
                        {account.verifiedProperties} verified
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={account.serviceAccount.active ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {account.serviceAccount.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-500">
                      {account.serviceAccount.lastUsed 
                        ? new Date(account.serviceAccount.lastUsed).toLocaleDateString()
                        : "Never"
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => testConnectionMutation.mutate(account.serviceAccount.id)}
                        disabled={testConnectionMutation.isPending}
                      >
                        {testConnectionMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      
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
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deactivate Service Account</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will deactivate the service account "{account.serviceAccount.name}". 
                              Existing property access will be preserved, but new assignments will not use this account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(account.serviceAccount.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                              Deactivate
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