import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppUser } from '../types';

interface UserContextType {
  activeUser: string | null;
  activeUserRole: string | null;
  setActiveUser: (username: string | null) => void;
  appUsers: AppUser[];
  loading: boolean;
  refreshUsers: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUser, setActiveUserState] = useState<string | null>(null);
  const [activeUserRole, setActiveUserRole] = useState<string | null>(null);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all app_users
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/app_users');
      if (res.ok) {
        const data = await res.json();
        setAppUsers(data);
        
        // If activeUser is already set, update/find their role
        const savedUser = localStorage.getItem('active_user');
        if (savedUser) {
          const userObj = data.find((u: AppUser) => u.username.toLowerCase() === savedUser.toLowerCase());
          if (userObj) {
            setActiveUserRole(userObj.role);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load app users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial check of localStorage for active user
    const savedUser = localStorage.getItem('active_user');
    if (savedUser) {
      setActiveUserState(savedUser);
    }
    
    // 2. Fetch the actual user list from Supabase/API
    fetchUsers();
  }, []);

  const setActiveUser = (username: string | null) => {
    if (username) {
      localStorage.setItem('active_user', username);
      setActiveUserState(username);
      
      // Update role based on username
      const userObj = appUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (userObj) {
        setActiveUserRole(userObj.role);
      } else {
        setActiveUserRole('User');
      }
    } else {
      localStorage.removeItem('active_user');
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
