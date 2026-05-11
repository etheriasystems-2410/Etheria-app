import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';

const ETHERIA_MENU_ICON = 'https://customer-assets.emergentagent.com/job_a75d84fa-0948-4f28-9189-c803d31a5037/artifacts/x7m8d3fn_8196.png';

function MenuButton({ navigation }: { navigation: any }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      style={menuStyles.button}
      hitSlop={8}
      activeOpacity={0.7}
    >
      <Image source={{ uri: ETHERIA_MENU_ICON }} style={menuStyles.image} />
    </TouchableOpacity>
  );
}

const menuStyles = StyleSheet.create({
  button: {
    marginLeft: 12,
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

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
      screenOptions={({ navigation }) => ({
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
        headerLeft: () => <MenuButton navigation={navigation} />,
      })}
    >
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: t('home'),
          title: 'Menu',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
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
        name="dreams"
        options={{
          drawerLabel: 'Dream Interpreter',
          title: 'Dream Interpreter',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="moon" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="astral-training"
        options={{
          drawerLabel: 'Astral Travel Self-Study',
          title: 'Astral Travel Self-Study',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="planet" size={size} color={color} />
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
        name="community"
        options={{
          drawerLabel: 'Community',
          title: 'Community',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
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
        name="terms"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="community-guidelines"
        options={{
          drawerItemStyle: { display: 'none' },
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
      <Drawer.Screen
        name="files"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="feedback"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="meditation/timed"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="meditation/astral"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="meditation/chakra"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="meditation/binaural"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="meditation/ai-guided"
        options={{
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="admin-panel"
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
