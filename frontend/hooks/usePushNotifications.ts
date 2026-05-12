/**
 * usePushNotifications - Registers an Expo push token with the backend and
 * routes notification taps to the right screen (e.g., a DM thread).
 *
 * Skips silently on web/simulator where push notifications aren't supported.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// Show notifications while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushTokenAsync(): Promise<string | null> {
  // Skip on web — Expo push is mobile-only
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null; // simulators can't get tokens

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7c3aed',
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResp.data;
  } catch (e) {
    console.warn('[Push] getExpoPushTokenAsync failed:', e);
    return null;
  }
}

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      const token = await registerForPushTokenAsync();
      if (!token) return;

      try {
        const auth = await AsyncStorage.getItem('session_token');
        if (!auth) return;
        await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/notifications/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
          body: JSON.stringify({ token, device_info: { os: Platform.OS } }),
        });
      } catch (e) {
        console.warn('[Push] register failed:', e);
      }
    })();

    // Handle notification taps — route to the right screen
    responseListener.current = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      if (data?.type === 'dm' && data?.thread_id) {
        router.push(`/messages/${data.thread_id}` as any);
      } else if (data?.type === 'dm') {
        router.push('/messages' as any);
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, router]);
}

export default usePushNotifications;
