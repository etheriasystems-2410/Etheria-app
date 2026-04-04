import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
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
      let sessionId: string | null = null;

      // First check expo-router params (works for both web and mobile deep links)
      if (params.session_id) {
        sessionId = params.session_id as string;
        console.log('Got session_id from params:', sessionId);
      }

      // On web, also check hash fragment and query params
      if (!sessionId && Platform.OS === 'web') {
        // Check the hash fragment (Emergent returns session_id here)
        const hash = window.location.hash;
        console.log('Checking hash:', hash);
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          sessionId = hashParams.get('session_id');
          console.log('Got session_id from hash:', sessionId);
        }
        
        // Also check query params as fallback
        if (!sessionId) {
          const urlParams = new URLSearchParams(window.location.search);
          sessionId = urlParams.get('session_id');
          console.log('Got session_id from query:', sessionId);
        }
      }

      // For mobile, check if we got it via deep link URL
      if (!sessionId && Platform.OS !== 'web') {
        try {
          const url = await Linking.getInitialURL();
          console.log('Initial URL:', url);
          if (url) {
            // Try to parse the URL
            const parsed = Linking.parse(url);
            console.log('Parsed URL:', JSON.stringify(parsed));
            
            // Check queryParams
            if (parsed.queryParams?.session_id) {
              sessionId = parsed.queryParams.session_id as string;
              console.log('Got session_id from parsed queryParams:', sessionId);
            }
            
            // Also check if session_id is in the path or fragment
            if (!sessionId && url.includes('session_id=')) {
              const match = url.match(/session_id=([^&\s#]+)/);
              if (match) {
                sessionId = match[1];
                console.log('Got session_id from URL regex:', sessionId);
              }
            }
          }
        } catch (e) {
          console.log('Error getting initial URL:', e);
        }
      }

      if (!sessionId) {
        console.log('No session ID found in any location');
        throw new Error('No session ID found. Please try logging in again.');
      }

      setStatus('Exchanging session...');

      // Exchange session_id for user data
      const response = await fetch(`${BACKEND_URL}/api/auth/google-callback?session_id=${sessionId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed');
      }

      const userData = await response.json();
      setStatus('Setting up session...');

      // Extract session token from response or cookies
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const tokenMatch = setCookie.match(/session_token=([^;]+)/);
        if (tokenMatch) {
          await AsyncStorage.setItem('session_token', tokenMatch[1]);
        }
      }

      // If the response includes a token directly, use it
      if (userData.session_token) {
        await AsyncStorage.setItem('session_token', userData.session_token);
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
    padding: 12,
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
