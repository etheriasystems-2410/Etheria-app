import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import {
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
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

// Drawer label for Messages with an unread badge
import { Text } from 'react-native';
import useDMUnread from '../hooks/useDMUnread';
import usePushNotifications from '../hooks/usePushNotifications';
import SplashVideo from '../components/SplashVideo';

function MessagesDrawerLabel({ color }: { color: string }) {
  const { unread } = useDMUnread(true);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 14, fontWeight: '500', flex: 1 }}>Messages</Text>
      {unread > 0 && (
        <View
          style={{
            backgroundColor: '#fbbf24',
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
            marginRight: 8,
          }}
        >
          <Text style={{ color: '#1a0033', fontSize: 11, fontWeight: '800' }}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Custom drawer content — keeps every route working but inserts a stylish
 * silver divider directly above the Inbox row, separating the spiritual
 * content section from the social section.
 */
function CustomDrawerContent(props: any) {
  const { state, descriptors, navigation } = props;
  return (
    <DrawerContentScrollView {...props}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        // Respect drawerItemStyle: display none (hidden routes)
        if (options.drawerItemStyle && options.drawerItemStyle.display === 'none') {
          return null;
        }
        const focused = state.index === index;
        const labelEl =
          typeof options.drawerLabel === 'function'
            ? options.drawerLabel({
                color: focused ? '#fff' : options.drawerInactiveTintColor || '#c0c0c0',
                focused,
              })
            : options.drawerLabel ?? options.title ?? route.name;

        return (
          <React.Fragment key={route.key}>
            {route.name === 'messages' && (
              <View style={drawerExtraStyles.dividerWrap}>
                <View style={drawerExtraStyles.dividerLine} />
                <Ionicons
                  name="ellipse"
                  size={5}
                  color="#d1d5db"
                  style={drawerExtraStyles.dividerDot}
                />
                <View style={drawerExtraStyles.dividerLine} />
              </View>
            )}
            <DrawerItem
              label={() =>
                typeof labelEl === 'string' ? (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: focused ? '#fff' : '#c0c0c0', fontWeight: '600' }}>
                      {labelEl}
                    </Text>
                  </View>
                ) : (
                  labelEl
                )
              }
              icon={options.drawerIcon}
              focused={focused}
              activeTintColor={'#fff'}
              inactiveTintColor={'#c0c0c0'}
              onPress={() => {
                const event = navigation.emit({
                  type: 'drawerItemPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          </React.Fragment>
        );
      })}
    </DrawerContentScrollView>
  );
}

const drawerExtraStyles = StyleSheet.create({
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
    marginHorizontal: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.55)', // silver
  },
  dividerDot: {
    marginHorizontal: 8,
    opacity: 0.85,
  },
});


function ProtectedLayout() {  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const segments = useSegments();
  const router = useRouter();

  // Register for push notifications once authenticated (no-op on web/simulator)
  usePushNotifications(isAuthenticated);

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
