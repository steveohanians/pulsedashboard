import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ViewAsSelectorProps {
  currentUserId: string;
  currentClientId: string;
  isAdmin: boolean;
  onViewAs: (clientId: string, userName: string) => void;
  onReset: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  clientId: string;
  clientName: string;
  role: string;
  label: string;
}

export function ViewAsSelector({ 
  currentUserId, 
  currentClientId,
  isAdmin, 
  onViewAs,
  onReset 
}: ViewAsSelectorProps) {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isViewingAs, setIsViewingAs] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      if (data.success && data.users) {
        setUsers(data.users);
        // Set current user as default selection
        setSelectedUserId(currentUserId);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: 'Failed to load users',
        description: 'Could not load user list for view-as feature',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewAs = async () => {
    if (!selectedUserId || selectedUserId === currentUserId) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/view-as/${selectedUserId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch view');
      }
      
      const data = await response.json();
      if (data.success) {
        const selectedUser = users.find(u => u.id === selectedUserId);
        onViewAs(data.clientId, data.userName);
        setIsViewingAs(true);
        
        toast({
          title: 'View switched',
          description: `Now viewing as ${selectedUser?.name}`,
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Failed to switch view:', error);
      toast({
        title: 'Failed to switch view',
        description: 'Could not switch to selected user view',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedUserId(currentUserId);
    setIsViewingAs(false);
    onReset();
    
    toast({
      title: 'View reset',
      description: 'Returned to your own view',
      duration: 3000
    });
  };

  if (!isAdmin) return null;

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">Admin View As:</span>
        </div>
        
        <Select
          value={selectedUserId}
          onValueChange={(value) => {
            setSelectedUserId(value);
            // Auto-trigger view change when different user is selected
            if (value && value !== currentUserId) {
              setTimeout(() => {
                // Use the new value directly since state might not be updated yet
                const targetUserId = value;
                const handleAutoViewAs = async () => {
                  try {
                    setLoading(true);
                    const response = await fetch(`/api/admin/view-as/${targetUserId}`, {
                      credentials: 'include'
                    });
                    
                    if (!response.ok) {
                      throw new Error('Failed to switch view');
                    }
                    
                    const data = await response.json();
                    if (data.success) {
                      const selectedUser = users.find(u => u.id === targetUserId);
                      onViewAs(data.clientId, data.userName);
                      setIsViewingAs(true);
                      
                      toast({
                        title: 'View switched',
                        description: `Now viewing as ${selectedUser?.name}`,
                        duration: 3000
                      });
                    }
                  } catch (error) {
                    console.error('Failed to switch view:', error);
                    toast({
                      title: 'Failed to switch view',
                      description: 'Could not switch to selected user view',
                      variant: 'destructive'
                    });
                  } finally {
                    setLoading(false);
                  }
                };
                handleAutoViewAs();
              }, 100);
            }
          }}
          disabled={loading}
        >
          <SelectTrigger className="flex-1 max-w-sm text-sm">
            <SelectValue placeholder="Select a user..." />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          size="sm"
          onClick={handleViewAs}
          disabled={loading || !selectedUserId || selectedUserId === currentUserId}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Eye className="h-3 w-3 mr-1" />
          View As User
        </Button>
        
        {isViewingAs && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="border-amber-600 text-amber-600 hover:bg-amber-50"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Reset to My View
          </Button>
        )}
      </div>
      
      {isViewingAs && (
        <div className="mt-2 text-xs text-amber-700">
          Currently viewing dashboard as: <strong>{users.find(u => u.id === selectedUserId)?.name}</strong>
        </div>
      )}
    </div>
  );
}