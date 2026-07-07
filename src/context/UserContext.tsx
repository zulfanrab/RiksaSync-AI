import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const INITIAL_APP_USERS: AppUser[] = [
  { id: 'u1', username: 'Zulfan', role: 'IT Staff' },
  { id: 'u2', username: 'Angga', role: 'Leader & Ahli Utama' },
  { id: 'u3', username: 'Imam', role: 'Ahli Spesialis' },
  { id: 'u4', username: 'Fakhziar', role: 'Ahli Spesialis' },
  { id: 'u5', username: 'Fauzan', role: 'Ahli Spesialis' },
  { id: 'u6', username: 'Ajay', role: 'Support Staff' },
  { id: 'u7', username: 'Arya', role: 'Support Staff' }
];

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
    console.log('[Auth Debug] Fetching app_users directly from Supabase...');

    if (!isSupabaseConfigured || !supabase) {
      console.warn('[Auth Warning] Supabase is not configured. Falling back to local app users.');
      setAppUsers(INITIAL_APP_USERS);
      setLoading(false);
      return;
    }

    try {
      const { data, error: sbError } = await supabase.from('app_users').select('*');
      
      if (sbError) {
        throw new Error(sbError.message);
      }

      if (!data || !Array.isArray(data)) {
        throw new Error('Empty or invalid user data returned from database');
      }

      if (data.length === 0) {
        console.warn('[Auth Warning] Supabase app_users table is empty. Using local fallback.');
        setAppUsers(INITIAL_APP_USERS);
        return;
      }

      console.log(`[Auth Success] Loaded ${data.length} users successfully from Supabase.`, data);
      setAppUsers(data as AppUser[]);
      
      // If activeUser is already set, update/find their role
      if (typeof window !== 'undefined') {
        const savedUser = localStorage.getItem('active_user');
        if (savedUser) {
          const userObj = data.find((u: any) => u.username.toLowerCase() === savedUser.toLowerCase());
          if (userObj) {
            setActiveUserRole(userObj.role);
          }
        }
      }
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.warn('[Auth Warning] Direct Supabase app_users query failed, falling back to local users:', exceptionMsg);
      // Failover gracefully to local app users without setting the blocking error state
      setAppUsers(INITIAL_APP_USERS);
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
