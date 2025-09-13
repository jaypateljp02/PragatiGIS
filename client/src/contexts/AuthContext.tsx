import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  stateId?: number;
  districtId?: number;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);

  // Check authentication status
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false, // Don't retry on 401
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  useEffect(() => {
    console.log('Auth data changed:', { data, error, isLoading, hasUser: !!user });
    if (data && typeof data === 'object' && 'user' in data) {
      console.log('Setting user:', data.user);
      setUser(data.user as User);
    } else if (error) {
      console.log('Auth error, clearing user:', error);
      setUser(null);
    }
  }, [data, error, isLoading, user]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout call fails
      window.location.href = '/login';
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        logout,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}