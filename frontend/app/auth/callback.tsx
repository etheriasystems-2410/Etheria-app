import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AuthCallback() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, [session_id]);

  const handleCallback = async () => {
    if (!session_id || authLoading) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google-callback?session_id=${session_id}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const userData = await response.json();
      
      // Extract session token from response
      const sessionToken = response.headers.get('set-cookie')?.split('session_token=')[1]?.split(';')[0];
      if (sessionToken) {
        await AsyncStorage.setItem('session_token', sessionToken);
      }

      // Redirect to home
      router.replace('/');
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Authentication failed');
      setTimeout(() => router.replace('/auth/login'), 3000);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.redirectText}>Redirecting to login...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#b794f6" />
      <Text style={styles.loadingText}>Completing authentication...</Text>
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
  loadingText: {
    color: '#e9d5ff',
    fontSize: 16,
    marginTop: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  redirectText: {
    color: '#c4b5fd',
    fontSize: 14,
  },
});
