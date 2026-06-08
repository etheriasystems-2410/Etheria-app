/**
 * usePushNotifications — registers the device's NATIVE push token with the
 * Emergent push relay. Follows the Emergent push playbook contract:
 *
 *   1. Request permissions BEFORE getting the token
 *   2. Use `getDevicePushTokenAsync()` (NOT Expo's token API)
 *   3. POST {user_id, platform, device_token} to /api/register-push on every
 *      app open (tokens can rotate)
 *
 * Tap routing (warm + cold-start) is handled in `app/_layout.tsx`, not here.
 * This hook is purely about registration.
 *
 * Skips silently on web/simulator where native push isn't supported.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getNativeToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null; // simulators have no APNs/FCM token

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const tokenResp = await Notifications.getDevicePushTokenAsync();
    return tokenResp.data || null;
  } catch (e) {
    console.warn('[Push] getDevicePushTokenAsync failed:', e);
    return null;
  }
}

export function usePushNotifications(isAuthenticated: boolean) {
  const { user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user?.id && !(user as any)?.user_id) return;

    const userId: string = (user as any).user_id || user.id;

    (async () => {
      const token = await getNativeToken();
      if (!token) return;

      try {
        // Per playbook: POST to /api/register-push (Emergent relay route).
        // The backend stamps the user doc so the scheduler can target this
        // user. We also keep a quick local note for the settings screen.
        const auth = await AsyncStorage.getItem('session_token');
        await fetch(`${BACKEND_URL}/api/register-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          },
          body: JSON.stringify({
            user_id: userId,
            platform: Platform.OS,
            device_token: token,
          }),
        });
        await AsyncStorage.setItem('push_registered_at', String(Date.now()));
      } catch (e) {
        console.warn('[Push] register-push failed:', e);
      }
    })();
  }, [isAuthenticated, user]);
}

export default usePushNotifications;
