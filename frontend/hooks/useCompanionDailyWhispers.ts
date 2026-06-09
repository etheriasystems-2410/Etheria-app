/**
 * useCompanionDailyWhispers — schedules 3 LOCAL notifications per day from
 * the user's Companion Guide. These are scheduled client-side (no FCM/APNs
 * needed) so they work in Expo Go on iOS + Android without any push key
 * or google-services.json.
 *
 * Schedule (user can adjust in the Companion settings):
 *   • Morning whisper   ~ 8:00 AM local
 *   • Afternoon whisper ~ 2:00 PM local
 *   • Evening whisper   ~ 8:30 PM local
 *
 * The hook fetches three guide-voiced whispers from the backend each morning
 * and uses them to schedule notifications for the rest of the day. Tapping
 * one deep-links into /spirit-guides?guide=NAME.
 *
 * IMPORTANT — Platform notes:
 *   • Local notifications work in Expo Go (Android) and standalone builds.
 *   • iOS Expo Go has limited support — full reliability requires a built
 *     app, but scheduled notifications still fire in most cases.
 *   • On web, this hook is a no-op.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../contexts/AuthContext';
import { useCompanionGuide } from './useCompanionGuide';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const LAST_SCHEDULE_KEY = 'companion_whispers_last_schedule_v1';
const TAG = '[CompanionWhispers]';

// Hours (24h, local) when the three daily whispers fire.
const WHISPER_TIMES: { hour: number; minute: number; label: string }[] = [
  { hour: 8, minute: 0, label: 'morning' },
  { hour: 14, minute: 0, label: 'afternoon' },
  { hour: 20, minute: 30, label: 'evening' },
];

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function fetchWhispers(authToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/companion-guide/whispers/today`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.whispers) ? data.whispers.slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function cancelExistingCompanionNotifications() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ids = scheduled
      .filter((n) => (n.content?.data as any)?.type === 'companion_whisper')
      .map((n) => n.identifier);
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  } catch (e) {
    console.warn(TAG, 'cancel failed:', e);
  }
}

export function useCompanionDailyWhispers() {
  const { isAuthenticated, isPremium, authToken } = useAuth();
  const { state } = useCompanionGuide();
  const scheduledRef = useRef(false);

  const schedule = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) return; // simulators can't reliably fire local notifs
    if (!isAuthenticated || !isPremium || !state.companion || !authToken) return;

    // Throttle: schedule at most once per local day
    try {
      const last = await AsyncStorage.getItem(LAST_SCHEDULE_KEY);
      if (last === todayIsoLocal()) return;
    } catch {}

    // Make sure we have permission. Don't request it here — that should be a
    // contextual ask. If not granted, just skip silently.
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    const whispers = await fetchWhispers(authToken);
    if (whispers.length === 0) return;

    // Clear any leftover companion notifications from prior days first
    await cancelExistingCompanionNotifications();

    const now = new Date();
    const guideName = state.companion;

    for (let i = 0; i < Math.min(WHISPER_TIMES.length, whispers.length); i++) {
      const slot = WHISPER_TIMES[i];
      const fireAt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        slot.hour,
        slot.minute,
        0,
        0,
      );
      // If the time already passed today, skip this slot (don't bunch up at
      // launch). The next day's scheduler will cover it.
      if (fireAt.getTime() < now.getTime() + 60 * 1000) continue;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🌙 ${guideName}`,
            body: whispers[i],
            data: {
              type: 'companion_whisper',
              guide: guideName,
              slot: slot.label,
              deeplink: `/spirit-guides?guide=${encodeURIComponent(guideName)}`,
            },
          },
          trigger: {
            // typed loosely on purpose — expo-notifications types vary by SDK
            type: 'date',
            date: fireAt,
          } as any,
        });
      } catch (e) {
        console.warn(TAG, 'schedule failed:', e);
      }
    }

    try {
      await AsyncStorage.setItem(LAST_SCHEDULE_KEY, todayIsoLocal());
    } catch {}
  }, [isAuthenticated, isPremium, state.companion, authToken]);

  // Auto-schedule whenever Companion changes or app foregrounds
  useEffect(() => {
    if (scheduledRef.current) return;
    if (!state.companion) return;
    scheduledRef.current = true;
    schedule();
  }, [state.companion, schedule]);

  // Cancel notifications if Companion is cleared
  useEffect(() => {
    if (!state.companion) {
      cancelExistingCompanionNotifications();
      AsyncStorage.removeItem(LAST_SCHEDULE_KEY).catch(() => {});
      scheduledRef.current = false;
    }
  }, [state.companion]);

  return { schedule };
}

export default useCompanionDailyWhispers;
