import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AuthCallback() {
  const router = useRouter();
  const hasProcessed = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Authenticating...');

  useEffect(() => {
    // Prevent double processing (StrictMode)
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Get session_id from URL hash (Emergent OAuth returns it in the hash fragment)
      let sessionId: string | null = null;

      if (Platform.OS === 'web') {
        // On web, check the hash fragment
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1)); // Remove the #
          sessionId = params.get('session_id');
        }
        
        // Also check query params as fallback
        if (!sessionId) {
          const urlParams = new URLSearchParams(window.location.search);
          sessionId = urlParams.get('session_id');
        }
      }

      if (!sessionId) {
        throw new Error('No session ID found in URL');
      }

      setStatus('Exchanging session...');

      // Exchange session_id for user data
      const response = await fetch(`${BACKEND_URL}/api/auth/google-callback?session_id=${sessionId}`, {
        method: 'POST',
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const userData = await response.json();
      setStatus('Setting up session...');

      // Try to get session token from response headers (for cookie)
      // On web, the cookie is set automatically by the browser
      // For React Native, we need to extract and store it
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const tokenMatch = setCookie.match(/session_token=([^;]+)/);
        if (tokenMatch) {
          await AsyncStorage.setItem('session_token', tokenMatch[1]);
        }
      }

      // Store user data for immediate access
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));

      setStatus('Success! Redirecting...');

      // Small delay to show success, then redirect
      setTimeout(() => {
        router.replace('/');
      }, 500);

    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Authentication failed');
      
      // Redirect to login after showing error
      setTimeout(() => {
        router.replace('/auth/login');
      }, 3000);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>❌</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.redirectText}>Redirecting to login...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#b794f6" />
        <Text style={styles.loadingText}>{status}</Text>
        <Text style={styles.subText}>Completing Google sign-in...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0321',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#e9d5ff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
  },
  subText: {
    color: '#9f7aea',
    fontSize: 14,
    marginTop: 8,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: '#1a0033',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  redirectText: {
    color: '#c4b5fd',
    fontSize: 14,
  },
});
