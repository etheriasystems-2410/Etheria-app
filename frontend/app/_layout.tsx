import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const isHomePage = segments.length === 0 || (segments.length === 1 && segments[0] === '(drawer)');
    const isIndexPage = segments[0] === 'index' || segments.length === 0;
    
    // Allow home page without authentication
    if (isIndexPage || isHomePage) {
      return;
    }

    // Redirect to login for protected routes
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, loading, segments]);

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <Drawer
      screenOptions={{
        drawerStyle: {
          backgroundColor: theme.cardBackground,
        },
        drawerActiveTintColor: theme.accentLight,
        drawerInactiveTintColor: theme.accent,
        headerStyle: {
          backgroundColor: theme.cardBackgroundAlt,
        },
        headerTintColor: '#e9d5ff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t('home'),
          title: t('welcomeMessage'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="training"
        options={{
          drawerLabel: t('psychicTraining'),
          title: t('psychicTraining'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="school" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="oracle"
        options={{
          drawerLabel: t('oracleTitle'),
          title: t('oracleTitle'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="spirit-guides"
        options={{
          drawerLabel: t('spiritGuidesTitle'),
          title: t('spiritGuidesTitle'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="meditation"
        options={{
          drawerLabel: t('meditationTitle'),
          title: t('meditationTitle'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="fitness" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="journal"
        options={{
          drawerLabel: t('journalTitle'),
          title: t('journalTitle'),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          drawerLabel: t('settingsTitle'),
          title: t('settingsTitle'),
          drawerIcon: ({ color, size}) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="auth/login"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="auth/signup"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="auth/callback"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <GestureHandlerRootView style={styles.container}>
            <ProtectedLayout />
          </GestureHandlerRootView>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
