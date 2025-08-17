import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, RefreshCw, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { userService } from '@/services/api';

interface ViewAsSelectorProps {
  currentUserId: string;
  currentClientId: string;
  viewAsUserId?: string | null; // The user currently being viewed as
  isAdmin: boolean;
  onViewAs: (clientId: string, userName: string, userId: string, userData: UserOption) => void;
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
  viewAsUserId,
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
      const usersData = await userService.getAll<UserOption>();
      console.log('ViewAsSelector users data:', usersData);
      console.log('ViewAsSelector users count:', usersData.length);
      console.log('Current user ID:', currentUserId);
      console.log('View as user ID:', viewAsUserId);
      setUsers(usersData);
      // Set the currently viewed user as selected, or default to current user
      const selectedUser = viewAsUserId || currentUserId;
      setSelectedUserId(selectedUser);
      setIsViewingAs(!!viewAsUserId);
      console.log('ViewAsSelector selectedUserId set to:', selectedUser);
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
    if (!selectedUserId) {
      return;
    }
    
    // Allow switching back to admin user or to any user
    if (selectedUserId === currentUserId && !isViewingAs) {
      return; // Already viewing as self and not in view-as mode
    }

    try {
      setLoading(true);
      console.log('Switching to view as user:', selectedUserId);
      const response = await fetch(`/api/admin/view-as/${selectedUserId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to switch view');
      }
      
      const data = await response.json();
      if (data.success) {
        const selectedUser = users.find(u => u.id === selectedUserId);
        
        // Update local state first
        setIsViewingAs(true);
        
        // Call the parent callback to update dashboard context
        onViewAs(data.clientId, data.userName, selectedUserId, selectedUser || {} as UserOption);
        
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

  const handleReset = async () => {
    try {
      setLoading(true);
      console.log('Returning to own view:', currentUserId);
      
      const response = await fetch(`/api/admin/view-as/${currentUserId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset view');
      }
      
      const data = await response.json();
      if (data.success) {
        // Update local state first
        setSelectedUserId(currentUserId);
        setIsViewingAs(false);
        
        // Call the parent callback to reset dashboard context
        onReset();
        
        toast({
          title: 'View reset',
          description: 'Returned to your own view',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Failed to reset view:', error);
      toast({
        title: 'Failed to reset view',
        description: 'Could not return to your own view',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  console.log('ViewAsSelector render:', { 
    usersCount: users.length, 
    selectedUserId, 
    currentUserId, 
    loading,
    isViewingAs 
  });

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-amber-700">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">Admin View As:</span>
        </div>
        
        <select
          value={selectedUserId}
          onChange={(e) => {
            const value = e.target.value;
            console.log('User selected in dropdown:', value, 'current users:', users.length);
            setSelectedUserId(value);
            // Note: Only update selection, don't auto-trigger view change
          }}
          disabled={loading}
          className="flex-1 max-w-sm text-sm border border-gray-300 rounded px-3 py-2"
        >
          {users.length === 0 ? (
            <option value="" disabled>Loading users...</option>
          ) : (
            users.map(user => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))
          )}
        </select>
        
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