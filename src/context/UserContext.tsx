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
      const msg = 'Supabase is not configured. Please supply valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.';
      console.error('[Auth Error]', msg);
      setError(msg);
      setAppUsers([]);
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

      let users = data as AppUser[];
      if (users.length === 0) {
        console.log('[Auth] app_users table is empty. Auto-seeding initial user profiles...');
        const initialUsers = [
          { id: 'u1', username: 'Zulfan', role: 'IT Staff' },
          { id: 'u2', username: 'Angga', role: 'Leader & Ahli Utama' },
          { id: 'u3', username: 'Imam', role: 'Ahli Spesialis' },
          { id: 'u4', username: 'Fakhziar', role: 'Ahli Spesialis' },
          { id: 'u5', username: 'Fauzan', role: 'Ahli Spesialis' },
          { id: 'u6', username: 'Ajay', role: 'Support Staff' },
          { id: 'u7', username: 'Arya', role: 'Support Staff' }
        ];
        const { data: seedData, error: seedError } = await supabase.from('app_users').insert(initialUsers).select();
        if (seedError) {
          throw new Error(`The app_users table is empty and auto-seeding failed: ${seedError.message}`);
        }
        users = (seedData as AppUser[]) || initialUsers;
      }

      console.log(`[Auth Success] Loaded ${users.length} users successfully from Supabase.`, users);
      setAppUsers(users);
      
      // If activeUser is already set, update/find their role
      if (typeof window !== 'undefined') {
        const savedUser = localStorage.getItem('active_user');
        if (savedUser) {
          const userObj = users.find((u: any) => u.username.toLowerCase() === savedUser.toLowerCase());
          if (userObj) {
            setActiveUserRole(userObj.role);
          } else {
            // User in localStorage not found in real db, clear active user to prevent stale auth
            localStorage.removeItem('active_user');
            setActiveUserState(null);
            setActiveUserRole(null);
          }
        }
      }
    } catch (err: any) {
      const exceptionMsg = err?.message || String(err);
      console.warn('[Auth Warning] Direct Supabase app_users query failed/empty:', exceptionMsg);
      setError(`Database Error: ${exceptionMsg}`);
      setAppUsers([]);
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
