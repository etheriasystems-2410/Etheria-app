import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

// Drawer-related components (extracted)
import MenuButton from '../components/drawer/MenuButton';
import MessagesDrawerLabel from '../components/drawer/MessagesDrawerLabel';
import CustomDrawerContent from '../components/drawer/CustomDrawerContent';
import usePushNotifications from '../hooks/usePushNotifications';
import SplashVideo from '../components/SplashVideo';

// ---------- Push notifications (Emergent playbook contract) -----------------
// 1) Foreground handler — MUST be at module scope so it's registered before
//    any push arrives. Guarded for web.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// 2) Android channel — MUST be at module scope so it exists before any push
//    arrives.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7c3aed',
  });
}


function ProtectedLayout() {  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const segments = useSegments();
  const router = useRouter();

  // Register for push notifications once authenticated (no-op on web/simulator)
  usePushNotifications(isAuthenticated);

  // Tap handlers (warm + cold-start) — route via deeplink/action_url
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleTap = (data: any) => {
      const url = data?.deeplink || data?.action_url;
      if (!url) return;
      if (typeof url === 'string') {
        if (url.startsWith('http')) {
          Linking.openURL(url);
        } else {
          router.push(url as any);
        }
      }
    };

    // Warm tap — user taps notification while app is open/backgrounded
    const tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleTap(response.notification.request.content.data || {});
    });

    // Cold-start tap — app was killed when the push arrived
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleTap(response.notification.request.content.data || {});
    });

    return () => {
      tapSub.remove();
    };
  }, [router]);

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
      drawerContent={(props) => <CustomDrawerContent {...props} />}
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
        name="messages"
        options={{
          drawerLabel: ({ color }) => <MessagesDrawerLabel color={color} />,
          title: 'Inbox',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="mail" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="users"
        options={{
          drawerLabel: 'Users',
          title: 'Users',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-circle" size={size} color={color} />
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
          title: 'Sign In',
        }}
      />
      <Drawer.Screen
        name="auth/signup"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Create Account',
        }}
      />
      <Drawer.Screen
        name="auth/callback"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Signing In…',
        }}
      />
      <Drawer.Screen
        name="files"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Files',
        }}
      />
      <Drawer.Screen
        name="feedback"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Feedback',
        }}
      />
      <Drawer.Screen
        name="meditation/timed"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Timed Meditation',
        }}
      />
      <Drawer.Screen
        name="meditation/astral"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Astral Meditation',
        }}
      />
      <Drawer.Screen
        name="meditation/chakra"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Chakra Meditation',
        }}
      />
      <Drawer.Screen
        name="meditation/binaural"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Binaural Meditation',
        }}
      />
      <Drawer.Screen
        name="meditation/ai-guided"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'AI Guided Meditation',
        }}
      />
      <Drawer.Screen
        name="notification-preferences"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Notifications',
        }}
      />
      <Drawer.Screen
        name="admin-panel"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Admin Panel',
        }}
      />
    </Drawer>
  );
}

export default function RootLayout() {
  const [splashDone, setSplashDone] = React.useState(false);
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <GestureHandlerRootView style={styles.container}>
            <ProtectedLayout />
            {!splashDone && <SplashVideo onDone={() => setSplashDone(true)} />}
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
