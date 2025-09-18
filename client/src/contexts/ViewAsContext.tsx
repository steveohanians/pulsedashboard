import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

interface ViewAsContextType {
  // State
  viewAsClientId: string | null;
  viewAsUserName: string | null;
  viewAsUserId: string | null;
  viewAsUser: any;
  
  // Actions
  setViewAs: (clientId: string, userName: string, userId: string, userData: any) => void;
  resetViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

interface ViewAsProviderProps {
  children: ReactNode;
}

// SessionStorage keys
const STORAGE_KEYS = {
  clientId: 'viewAsClientId',
  userName: 'viewAsUserName',
  userId: 'viewAsUserId',
  userData: 'viewAsUserData'
};

// Helper functions for sessionStorage
const loadFromSessionStorage = () => {
  try {
    return {
      clientId: sessionStorage.getItem(STORAGE_KEYS.clientId),
      userName: sessionStorage.getItem(STORAGE_KEYS.userName),
      userId: sessionStorage.getItem(STORAGE_KEYS.userId),
      userData: sessionStorage.getItem(STORAGE_KEYS.userData) ? 
        JSON.parse(sessionStorage.getItem(STORAGE_KEYS.userData)!) : null
    };
  } catch (error) {
    console.warn('Failed to load ViewAs state from sessionStorage:', error);
    return { clientId: null, userName: null, userId: null, userData: null };
  }
};

const saveToSessionStorage = (clientId: string, userName: string, userId: string, userData: any) => {
  try {
    sessionStorage.setItem(STORAGE_KEYS.clientId, clientId);
    sessionStorage.setItem(STORAGE_KEYS.userName, userName);
    sessionStorage.setItem(STORAGE_KEYS.userId, userId);
    sessionStorage.setItem(STORAGE_KEYS.userData, JSON.stringify(userData));
  } catch (error) {
    console.warn('Failed to save ViewAs state to sessionStorage:', error);
  }
};

const clearSessionStorage = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.clientId);
    sessionStorage.removeItem(STORAGE_KEYS.userName);
    sessionStorage.removeItem(STORAGE_KEYS.userId);
    sessionStorage.removeItem(STORAGE_KEYS.userData);
  } catch (error) {
    console.warn('Failed to clear ViewAs state from sessionStorage:', error);
  }
};

export function ViewAsProvider({ children }: ViewAsProviderProps) {
  const [viewAsClientId, setViewAsClientId] = useState<string | null>(null);
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUser, setViewAsUser] = useState<any>(null);

  // Load state from sessionStorage on initialization
  useEffect(() => {
    const stored = loadFromSessionStorage();
    if (stored.clientId && stored.userName && stored.userId) {
      setViewAsClientId(stored.clientId);
      setViewAsUserName(stored.userName);
      setViewAsUserId(stored.userId);
      setViewAsUser(stored.userData);
    }
  }, []);

  const setViewAs = useCallback((clientId: string, userName: string, userId: string, userData: any) => {
    setViewAsClientId(clientId);
    setViewAsUserName(userName);
    setViewAsUserId(userId);
    setViewAsUser(userData);
    
    // Save to sessionStorage
    saveToSessionStorage(clientId, userName, userId, userData);
  }, []);

  const resetViewAs = useCallback(() => {
    setViewAsClientId(null);
    setViewAsUserName(null);
    setViewAsUserId(null);
    setViewAsUser(null);
    
    // Clear sessionStorage
    clearSessionStorage();
  }, []);

  const value: ViewAsContextType = {
    viewAsClientId,
    viewAsUserName,
    viewAsUserId,
    viewAsUser,
    setViewAs,
    resetViewAs,
  };

  return (
    <ViewAsContext.Provider value={value}>
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    throw new Error('useViewAs must be used within a ViewAsProvider');
  }
  return context;
}