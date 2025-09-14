import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInWithRedirect, 
  getRedirectResult,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string; // Default role, can be customized later
  photoURL?: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result when user comes back from Google sign-in
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('Redirect result:', result.user);
        }
      } catch (error) {
        console.error('Redirect error:', error);
      }
    };

    handleRedirectResult();

    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      console.log('Firebase auth state changed:', firebaseUser);
      setIsLoading(true);

      if (firebaseUser) {
        // Convert Firebase user to our User interface
        const userData: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          fullName: firebaseUser.displayName || 'User',
          role: 'ministry', // Default role - can be customized based on email domain or other logic
          photoURL: firebaseUser.photoURL || undefined,
          isActive: true
        };
        
        setUser(userData);
        console.log('User authenticated:', userData);
      } else {
        setUser(null);
        console.log('User not authenticated');
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Google sign-in redirect...');
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      console.log('User signed out');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refetch = () => {
    // For Firebase, we don't need manual refetch as onAuthStateChanged handles this
    console.log('Firebase auth state is automatically managed');
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
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