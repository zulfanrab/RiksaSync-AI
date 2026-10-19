import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

export const DOMAIN_SUFFIX = '@aksarariksapjk3.com';

export const INITIAL_APP_USERS: AppUser[] = [
  { id: 'u1',  username: 'Angga',    role: 'Leader & Ahli Utama', email: 'angga@aksarariksapjk3.com',    full_name: 'Rama Regawa Sri Anggayana',       division: 'Ahli' },
  { id: 'u2',  username: 'Imam',     role: 'Ahli Spesialis',      email: 'imam@aksarariksapjk3.com',     full_name: 'Lalu Imam Taufik Rahman Hidayat', division: 'Ahli' },
  { id: 'u3',  username: 'Fauzan',   role: 'Ahli Spesialis',      email: 'fauzan@aksarariksapjk3.com',   full_name: 'Fauzan Akmaluddin',               division: 'Ahli' },
  { id: 'u4',  username: 'Fakhziar', role: 'Ahli Spesialis',      email: 'fakhziar@aksarariksapjk3.com', full_name: 'Fakhziar Wildan Hidayat',         division: 'Ahli' },
  { id: 'u5',  username: 'Fazar',    role: 'Ahli Spesialis',      email: 'fazar@aksarariksapjk3.com',    full_name: 'Muhammad Fazar Maulana',          division: 'Ahli' },
  { id: 'u6',  username: 'Arya',     role: 'Support Staff',       email: 'arya@aksarariksapjk3.com',     full_name: 'Arya Rizki Pratama',              division: 'Admin' },
  { id: 'u7',  username: 'Rio',      role: 'Support Staff',       email: 'rio@aksarariksapjk3.com',      full_name: 'Rio Andrian',                     division: 'Admin' },
  { id: 'u8',  username: 'Aulia',    role: 'Support Staff',       email: 'aulia@aksarariksapjk3.com',    full_name: 'Aulia Zahra Dikrika',             division: 'Admin' },
  { id: 'u9',  username: 'Disa',     role: 'Support Staff',       email: 'disa@aksarariksapjk3.com',     full_name: 'Disa Liestianie Putri',           division: 'Admin' },
  { id: 'u10', username: 'Marsya',   role: 'Support Staff',       email: 'marsya@aksarariksapjk3.com',   full_name: 'Marsya Aulia Rohman',             division: 'Admin' },
  { id: 'u11', username: 'Zulfan',   role: 'IT Staff',            email: 'zulfan@aksarariksapjk3.com',   full_name: 'Zulfan Rafly Baihaqi',            division: 'IT' }
];

interface UserContextType {
  activeUser: string | null;
  activeUserRole: string | null;
  activeUserEmail: string | null;
  currentUser: AppUser | null;
  session: Session | null;
  appUsers: AppUser[];
  loading: boolean;
  mounted: boolean;
  error: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveUser: (username: string | null) => void;
  refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Helper to format email identifier
export function formatEmailIdentifier(identifier: string): string {
  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}${DOMAIN_SUFFIX}`;
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [activeUser, setActiveUserState] = useState<string | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<string | null>(null);
  const [activeUserEmail, setActiveUserEmail] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [appUsers, setAppUsers] = useState<AppUser[]>(INITIAL_APP_USERS);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appUsersRef = useRef<AppUser[]>(INITIAL_APP_USERS);

  // Sync ref when appUsers state changes
  useEffect(() => {
    appUsersRef.current = appUsers;
  }, [appUsers]);

  // Apply user profile from session user
  const applyUserProfile = (authUser: User | null, list?: AppUser[]) => {
    if (!authUser) {
      setActiveUserState(null);
      setActiveUserRole(null);
      setActiveUserEmail(null);
      setCurrentUser(null);
      return;
    }

    const email = authUser.email?.toLowerCase() || '';
    setActiveUserEmail(email);

    const users = list || appUsersRef.current || INITIAL_APP_USERS;
    const found = users.find(
      (u) =>
        (u.auth_id && u.auth_id === authUser.id) ||
        (u.email && u.email.toLowerCase() === email) ||
        (u.username && email.startsWith(u.username.toLowerCase() + '@'))
    );

    if (found) {
      setActiveUserState(found.username);
      setActiveUserRole(found.role);
      setCurrentUser(found);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_user', found.username);
      }
    } else {
      const namePart = email.split('@')[0] || 'User';
      const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      const fallbackUser: AppUser = {
        id: authUser.id,
        auth_id: authUser.id,
        username: capitalized,
        email: email,
        role: 'Staff',
        division: 'Umum'
      };
      setActiveUserState(capitalized);
      setActiveUserRole('Staff');
      setCurrentUser(fallbackUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_user', capitalized);
      }
    }
  };

  // Fetch all app_users from Supabase
  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      return INITIAL_APP_USERS;
    }

    try {
      const { data, error: sbError } = await supabase.from('app_users').select('*');
      if (sbError) {
        console.warn('[UserContext] Could not fetch app_users from Supabase:', sbError.message);
        return INITIAL_APP_USERS;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        const mappedUsers = data as AppUser[];
        setAppUsers(mappedUsers);
        appUsersRef.current = mappedUsers;
        return mappedUsers;
      }
    } catch (err: any) {
      console.warn('[UserContext] Fetch users exception:', err?.message || err);
    }
    return INITIAL_APP_USERS;
  }, []);

  // Initialize session and listeners on mount - ONCE ONLY
  useEffect(() => {
    setMounted(true);
    let isMounted = true;

    async function initAuth() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch user list from DB
        let currentUsers = INITIAL_APP_USERS;
        if (isSupabaseConfigured && supabase) {
          try {
            const { data } = await supabase.from('app_users').select('*');
            if (data && Array.isArray(data) && data.length > 0) {
              currentUsers = data as AppUser[];
              if (isMounted) {
                setAppUsers(currentUsers);
                appUsersRef.current = currentUsers;
              }
            }
          } catch (e) {
            console.warn('[Auth] Error fetching initial app_users:', e);
          }
        }

        // 2. Check existing persistent Supabase Auth session
        if (isSupabaseConfigured && supabase) {
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          if (isMounted) {
            if (existingSession?.user) {
              setSession(existingSession);
              applyUserProfile(existingSession.user, currentUsers);
            } else {
              // Legacy localStorage check
              const savedUser = localStorage.getItem('active_user');
              if (savedUser) {
                const matched = currentUsers.find((u) => u.username.toLowerCase() === savedUser.toLowerCase());
                if (matched) {
                  setActiveUserState(matched.username);
                  setActiveUserRole(matched.role);
                  setActiveUserEmail(matched.email || `${matched.username.toLowerCase()}${DOMAIN_SUFFIX}`);
                  setCurrentUser(matched);
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[Auth Error] Session initialization failed:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // 3. Listen to Auth state changes
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;
        setSession(newSession);
        if (newSession?.user) {
          applyUserProfile(newSession.user);
        } else if (event === 'SIGNED_OUT') {
          setActiveUserState(null);
          setActiveUserRole(null);
          setActiveUserEmail(null);
          setCurrentUser(null);
          localStorage.removeItem('active_user');
        }
      });
      authListener = data;
    }

    return () => {
      isMounted = false;
      if (authListener) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []); // Run strictly once on mount to prevent infinite fetch loop

  // Sign in with email or username + password
  const login = async (identifier: string, password: string) => {
    setError(null);
    const cleanEmail = formatEmailIdentifier(identifier);

    if (!cleanEmail) {
      throw new Error('Username atau email tidak boleh kosong.');
    }
    if (!password) {
      throw new Error('Password tidak boleh kosong.');
    }

    if (!isSupabaseConfigured || !supabase) {
      // Offline fallback: match user from static list
      const usernamePart = identifier.split('@')[0].toLowerCase();
      const matched = appUsersRef.current.find(
        (u) => u.username.toLowerCase() === usernamePart || (u.email && u.email.toLowerCase() === cleanEmail)
      );
      if (matched) {
        setActiveUserState(matched.username);
        setActiveUserRole(matched.role);
        setActiveUserEmail(matched.email || cleanEmail);
        setCurrentUser(matched);
        localStorage.setItem('active_user', matched.username);
        return;
      }
      throw new Error('Supabase belum terkonfigurasi dan user tidak ditemukan di daftar.');
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (authError) {
      console.error('[Auth Login Error]', authError);
      let friendlyMessage = authError.message;
      if (authError.message.includes('Invalid login credentials')) {
        friendlyMessage = 'Username/email atau password salah. Pastikan password sudah diatur di akun Anda.';
      } else if (authError.message.includes('Email not confirmed')) {
        friendlyMessage = 'Konfirmasi email belum dimatikan di Supabase Auth Settings. Harap matikan "Confirm email" di dashboard.';
      }
      setError(friendlyMessage);
      throw new Error(friendlyMessage);
    }

    if (data.session) {
      setSession(data.session);
      applyUserProfile(data.session.user);
    }
  };

  // Sign out
  const logout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[Auth Logout Warning]', err);
    } finally {
      setSession(null);
      setActiveUserState(null);
      setActiveUserRole(null);
      setActiveUserEmail(null);
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('active_user');
      }
    }
  };

  // Backwards-compatible setActiveUser (for legacy callers)
  const setActiveUser = (username: string | null) => {
    if (username) {
      const found = appUsersRef.current.find((u) => u.username.toLowerCase() === username.toLowerCase());
      setActiveUserState(username);
      setActiveUserRole(found?.role || 'Staff');
      setActiveUserEmail(found?.email || `${username.toLowerCase()}${DOMAIN_SUFFIX}`);
      setCurrentUser(found || null);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_user', username);
      }
    } else {
      logout();
    }
  };

  return (
    <UserContext.Provider
      value={{
        activeUser,
        activeUserRole,
        activeUserEmail,
        currentUser,
        session,
        appUsers,
        loading,
        mounted,
        error,
        login,
        logout,
        setActiveUser,
        refreshUsers: fetchUsers
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
