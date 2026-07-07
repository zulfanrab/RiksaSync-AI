import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types';

interface UserContextType {
  activeUser: string | null;
  activeUserRole: string | null;
  setActiveUser: (username: string | null) => void;
  appUsers: AppUser[];
  loading: boolean;
  mounted: boolean;
  error: string | null;
  refreshUsers: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUser, setActiveUserState] = useState<string | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<string | null>(null);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all app_users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    console.log('[Auth Debug] Fetching app_users from API...');
    try {
      const res = await fetch('/api/app_users');
      if (res.ok) {
        const data = await res.json();
        if (!data || !Array.isArray(data)) {
          const emptyErrorMsg = 'Empty or invalid user data returned from database';
          setError(emptyErrorMsg);
          console.error('[Auth Error]', emptyErrorMsg, data);
          setAppUsers([]);
          return;
        }

        console.log(`[Auth Success] Loaded ${data.length} users successfully.`, data);
        setAppUsers(data);
        
        // If activeUser is already set, update/find their role
        if (typeof window !== 'undefined') {
          const savedUser = localStorage.getItem('active_user');
          if (savedUser) {
            const userObj = data.find((u: AppUser) => u.username.toLowerCase() === savedUser.toLowerCase());
            if (userObj) {
              setActiveUserRole(userObj.role);
            }
          }
        }
      } else {
        const statusText = res.statusText || 'Unknown Status';
        const errorText = `Failed with status ${res.status}: ${statusText}`;
        setError(errorText);
        console.error('[Auth Error] fetchUsers API call failed:', errorText);
      }
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      setError(exceptionMsg);
      console.error('[Auth Error] Exception caught in fetchUsers:', exceptionMsg, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    // 1. Initial check of localStorage for active user (Safely inside useEffect)
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('active_user');
        if (savedUser) {
          console.log('[Auth Debug] Found active user session in localStorage:', savedUser);
          setActiveUserState(savedUser);
        }
      } catch (err) {
        console.warn('[Auth Warning] Unable to access localStorage:', err);
      }
    }
    
    // 2. Fetch the actual user list from Supabase/API
    fetchUsers();
  }, []);

  const setActiveUser = (username: string | null) => {
    if (username) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('active_user', username);
        } catch (err) {
          console.warn('[Auth Warning] Unable to write to localStorage:', err);
        }
      }
      setActiveUserState(username);
      
      // Update role based on username
      const userObj = appUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (userObj) {
        setActiveUserRole(userObj.role);
      } else {
        setActiveUserRole('User');
      }
    } else {
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('active_user');
        } catch (err) {
          console.warn('[Auth Warning] Unable to remove from localStorage:', err);
        }
      }
      setActiveUserState(null);
      setActiveUserRole(null);
    }
  };

  const logout = () => {
    setActiveUser(null);
  };

  return (
    <UserContext.Provider
      value={{
        activeUser,
        activeUserRole,
        setActiveUser,
        appUsers,
        loading,
        mounted,
        error,
        refreshUsers: fetchUsers,
        logout
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
