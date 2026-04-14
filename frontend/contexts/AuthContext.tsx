import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  admin_level?: string;
  display_name?: string;
}

interface SubscriptionStatus {
  is_premium: boolean;
  subscription_status: string;
  expires_at: string | null;
  features: {
    oracle_readings_unlimited: boolean;
    journal_entries_unlimited: boolean;
    all_training_modules: boolean;
    spirit_guides: boolean;
    binaural_meditation: boolean;
    astral_meditation: boolean;
    ai_guided_meditation: boolean;
    tts_enabled: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isPremium: boolean;
  subscription: SubscriptionStatus | null;
  refreshSubscription: () => Promise<void>;
  checkFeatureAccess: (feature: string) => boolean;
  refreshAuth: () => Promise<void>;
}

const defaultFeatures = {
  oracle_readings_unlimited: false,
  journal_entries_unlimited: false,
  all_training_modules: false,
  spirit_guides: false,
  binaural_meditation: false,
  astral_meditation: false,
  ai_guided_meditation: false,
  tts_enabled: false
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (typeof window !== 'undefined' && window.location?.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // First check if we have stored user data from OAuth
      const storedUserData = await AsyncStorage.getItem('user_data');
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        setUser(userData);
        await AsyncStorage.removeItem('user_data'); // Clear after use
      }

      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          // Fetch subscription status
          await fetchSubscriptionStatus(sessionToken);
        } else {
          await AsyncStorage.removeItem('session_token');
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionStatus = async (token?: string) => {
    try {
      const sessionToken = token || await AsyncStorage.getItem('session_token');
      if (!sessionToken) {
        setSubscription({
          is_premium: false,
          subscription_status: 'free',
          expires_at: null,
          features: defaultFeatures
        });
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/subscription/status`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      } else {
        setSubscription({
          is_premium: false,
          subscription_status: 'free',
          expires_at: null,
          features: defaultFeatures
        });
      }
    } catch (error) {
      console.error('Subscription check error:', error);
      setSubscription({
        is_premium: false,
        subscription_status: 'free',
        expires_at: null,
        features: defaultFeatures
      });
    }
  };

  const refreshSubscription = async () => {
    await fetchSubscriptionStatus();
  };

  const checkFeatureAccess = (feature: string): boolean => {
    if (!subscription) return false;
    if (subscription.is_premium) return true;
    return subscription.features[feature as keyof typeof subscription.features] || false;
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      
      console.log('LOGIN RESPONSE:', JSON.stringify(data, null, 2));
      
      // Get session token from response body (for mobile) or cookie (for web)
      const sessionToken = data.session_token || 
        response.headers.get('set-cookie')?.split('session_token=')[1]?.split(';')[0];
      
      if (sessionToken) {
        await AsyncStorage.setItem('session_token', sessionToken);
        await fetchSubscriptionStatus(sessionToken);
      }
      
      const userObj = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        picture: data.picture,
        is_admin: data.is_admin,
        admin_level: data.admin_level,
        display_name: data.display_name
      };
      
      console.log('SETTING USER:', JSON.stringify(userObj, null, 2));
      
      setUser(userObj);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Signup failed');
      }

      const data = await response.json();
      
      const sessionToken = response.headers.get('set-cookie')?.split('session_token=')[1]?.split(';')[0];
      if (sessionToken) {
        await AsyncStorage.setItem('session_token', sessionToken);
        await fetchSubscriptionStatus(sessionToken);
      }
      
      setUser(data);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      if (sessionToken) {
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
      
      await AsyncStorage.removeItem('session_token');
      setUser(null);
      setSubscription(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Method to refresh auth state (called after OAuth callback)
  const refreshAuth = async () => {
    setLoading(true);
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isPremium: subscription?.is_premium || false,
        subscription,
        refreshSubscription,
        checkFeatureAccess,
        refreshAuth
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
